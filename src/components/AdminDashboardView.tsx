import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownCircle,
  Banknote,
  Check,
  Clock,
  Eye,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sliders,
  Trash2,
  Trophy,
  Users,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import {
  AdminUserSummary,
  AppRoute,
  AuditLogItem,
  CompetitionItem,
  ContactMessageItem,
  DepositRequestItem,
  MatchItem,
  SportItem,
  TransactionItem,
  VirtualBetItem,
} from '../types/sportzone';
import { OperatorBadge } from './OperatorLogos';

interface AdminDashboardViewProps {
  matches: MatchItem[];
  onRefreshMatches: () => Promise<void>;
  onNavigate: (route: AppRoute) => void;
}

interface AdminOverviewData {
  stats: {
    totalUsers: number;
    totalMatches: number;
    liveMatches: number;
    totalVirtualBets: number;
    totalVirtualVolume: number;
  };
  users: AdminUserSummary[];
  bets: Array<{
    id: number;
    reference: string;
    username: string;
    virtualStake: number;
    combinedOdds: number;
    potentialVirtualWinnings: number;
    status: string;
    createdAt: string;
  }>;
  auditLogs: AuditLogItem[];
  sports: SportItem[];
  competitions: CompetitionItem[];
}

interface InspectedUserPayload {
  user: AdminUserSummary;
  metrics: {
    totalBets: number;
    wonBets: number;
    lostBets: number;
    pendingBets: number;
    totalGain: number;
    pendingGain: number;
    totalStaked: number;
  };
  bets: VirtualBetItem[];
  transactions: TransactionItem[];
}

export function AdminDashboardView({
  matches,
  onRefreshMatches,
  onNavigate,
}: AdminDashboardViewProps) {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [deposits, setDeposits] = useState<DepositRequestItem[]>([]);
  const [depositNotes, setDepositNotes] = useState<Record<number, string>>({});
  const [processingDepositId, setProcessingDepositId] = useState<number | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const [messages, setMessages] = useState<ContactMessageItem[]>([]);
  const [selectedChatUserId, setSelectedChatUserId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'deposits' | 'messages' | 'users' | 'matches' | 'odds' | 'catalog' | 'activity'
  >('deposits');

  const [userSearch, setUserSearch] = useState('');
  const [inspectedUser, setInspectedUser] = useState<InspectedUserPayload | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState<string>('50');
  const [creditNote, setCreditNote] = useState<string>('Admin Credit Deposit');
  const [crediting, setCrediting] = useState(false);

  const [sportId, setSportId] = useState<number>(1);
  const [competitionId, setCompetitionId] = useState<number>(1);
  const [homeTeamName, setHomeTeamName] = useState('');
  const [awayTeamName, setAwayTeamName] = useState('');
  const [newStatus, setNewStatus] = useState<'upcoming' | 'live'>('upcoming');
  const [newTimer, setNewTimer] = useState('20:00');

  const [newSportName, setNewSportName] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompCountry, setNewCompCountry] = useState('');
  const [newCompSportId, setNewCompSportId] = useState<number>(1);

  const [scoreEdits, setScoreEdits] = useState<
    Record<number, { homeScore: number; awayScore: number; status: string; matchTimer: string }>
  >({});

  const [oddsMatchId, setOddsMatchId] = useState<number | null>(null);
  const [marketEdits, setMarketEdits] = useState<Record<number, number>>({});

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, depRes, msgRes] = await Promise.all([
        apiFetch<AdminOverviewData>('/api/admin/overview'),
        apiFetch<{ deposits: DepositRequestItem[] }>('/api/admin/deposits'),
        apiFetch<{ messages: ContactMessageItem[] }>('/api/contact/messages'),
      ]);
      setOverview(data);
      setDeposits(depRes.deposits);
      setMessages(msgRes.messages);
      if (data.sports.length > 0 && !data.sports.some((s) => s.id === sportId)) {
        setSportId(data.sports[0].id);
        setNewCompSportId(data.sports[0].id);
      }
      if (data.competitions.length > 0 && !data.competitions.some((c) => c.id === competitionId)) {
        setCompetitionId(data.competitions[0].id);
      }
    } catch (err: any) {
      if (!silent) {
        showToast(err?.message || 'Impossible de charger la console admin.', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast, sportId, competitionId]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadOverview();
    }
  }, [user, loadOverview]);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const onDepositReq = (ev: Event) => {
      const payload = (ev as CustomEvent<{
        username?: string;
        operator?: string;
        amount?: number;
      }>).detail;
      if (payload?.username && payload?.amount) {
        showToast(
          `Nouvelle recharge (${payload.operator || 'Dépôt'}) : ${payload.username} (+${Number(
            payload.amount
          ).toFixed(2)} DT)`,
          'info'
        );
      }
      loadOverview(true);
    };

    const onDepositUpd = () => loadOverview(true);
    const onBalanceUpd = () => loadOverview(true);
    const onMessageRec = (ev: Event) => {
      const payload = (ev as CustomEvent<{ senderRole?: string; senderName?: string }>).detail;
      if (payload?.senderRole === 'user' && payload?.senderName) {
        showToast(`Nouveau message de ${payload.senderName}`, 'info');
      }
      loadOverview(true);
    };

    window.addEventListener('sportzone:deposit_requested', onDepositReq);
    window.addEventListener('sportzone:deposit_updated', onDepositUpd);
    window.addEventListener('sportzone:balance_updated', onBalanceUpd);
    window.addEventListener('sportzone:message_received', onMessageRec);

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('matches_updated', () => {
        loadOverview(true);
      });
    } catch {
      // Fallback handled by interval
    }

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadOverview(true);
      }
    }, 5_000);

    return () => {
      window.removeEventListener('sportzone:deposit_requested', onDepositReq);
      window.removeEventListener('sportzone:deposit_updated', onDepositUpd);
      window.removeEventListener('sportzone:balance_updated', onBalanceUpd);
      window.removeEventListener('sportzone:message_received', onMessageRec);
      es?.close();
      clearInterval(poll);
    };
  }, [user?.role, loadOverview, showToast]);

  useEffect(() => {
    const map: Record<number, { homeScore: number; awayScore: number; status: string; matchTimer: string }> = {};
    matches.forEach((m) => {
      map[m.id] = {
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        matchTimer: m.matchTimer,
      };
    });
    setScoreEdits(map);
    if (!oddsMatchId && matches.length > 0) {
      setOddsMatchId(matches[0].id);
    }
  }, [matches, oddsMatchId]);

  useEffect(() => {
    const target = matches.find((m) => m.id === oddsMatchId);
    if (target) {
      const edits: Record<number, number> = {};
      target.markets.forEach((mkt) => {
        edits[mkt.id] = mkt.simulatedOdds;
      });
      setMarketEdits(edits);
    }
  }, [oddsMatchId, matches]);

  const filteredUsers = useMemo(() => {
    if (!overview) return [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return overview.users;
    return overview.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.id).includes(q)
    );
  }, [overview, userSearch]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-10 text-center space-y-3 shadow-xs">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h1 className="font-heading text-xl font-extrabold text-slate-900">
          Accès Administrateur Restreint
        </h1>
        <p className="text-sm text-slate-600">
          Des identifiants administrateur sont requis pour gérer les utilisateurs, soldes, matchs et cotes.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-xl bg-[#0a58ca] text-white font-bold text-sm"
        >
          Connexion Admin
        </button>
      </div>
    );
  }

  const handleInspectUser = async (targetUserId: number) => {
    setInspectLoading(true);
    try {
      const data = await apiFetch<InspectedUserPayload>(`/api/admin/users/${targetUserId}`);
      setInspectedUser(data);
    } catch (err: any) {
      showToast(err?.message || 'Impossible de charger les détails du joueur.', 'error');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleCreditUser = async (targetUserId: number, amountOverride?: number) => {
    const amt = amountOverride ?? Number(creditAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Entrez un montant DT positif.', 'error');
      return;
    }
    setCrediting(true);
    try {
      await apiFetch(`/api/admin/users/${targetUserId}/credit`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt, note: creditNote }),
      });
      showToast(`+${amt.toFixed(2)} DT crédités sur le compte du joueur.`, 'success');
      await Promise.all([loadOverview(true), handleInspectUser(targetUserId), refreshProfile()]);
    } catch (err: any) {
      showToast(err?.message || 'Échec du crédit.', 'error');
    } finally {
      setCrediting(false);
    }
  };

  const handleApproveDeposit = async (depositId: number, targetUserId: number) => {
    setProcessingDepositId(depositId);
    try {
      const adminNote = (depositNotes[depositId] || '').trim();
      await apiFetch(`/api/admin/deposits/${depositId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: adminNote || undefined }),
      });
      showToast('Recharge acceptée & solde crédité en temps réel.', 'success');
      await Promise.all([
        loadOverview(true),
        inspectedUser?.user.id === targetUserId ? handleInspectUser(targetUserId) : Promise.resolve(),
        refreshProfile(),
      ]);
    } catch (err: any) {
      showToast(err?.message || 'Impossible d’accepter la recharge.', 'error');
    } finally {
      setProcessingDepositId(null);
    }
  };

  const handleRejectDeposit = async (depositId: number) => {
    setProcessingDepositId(depositId);
    try {
      const adminNote = (depositNotes[depositId] || '').trim();
      await apiFetch(`/api/admin/deposits/${depositId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: adminNote || undefined }),
      });
      showToast('Demande de recharge refusée.', 'info');
      await loadOverview(true);
    } catch (err: any) {
      showToast(err?.message || 'Impossible de refuser la recharge.', 'error');
    } finally {
      setProcessingDepositId(null);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUserId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await apiFetch('/api/contact/messages', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedChatUserId,
          message: replyText.trim(),
        }),
      });
      setReplyText('');
      await loadOverview(true);
    } catch (err: any) {
      showToast(err?.message || 'Impossible d’envoyer la réponse.', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleToggleRole = async (targetUserId: number, currentRole: string) => {
    try {
      await apiFetch(`/api/admin/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: currentRole === 'admin' ? 'user' : 'admin' }),
      });
      await Promise.all([loadOverview(), handleInspectUser(targetUserId)]);
      showToast('Rôle mis à jour.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Impossible de modifier le rôle.', 'error');
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/matches', {
        method: 'POST',
        body: JSON.stringify({
          sportId,
          competitionId,
          homeTeamName,
          awayTeamName,
          status: newStatus,
          matchTimer: newTimer,
        }),
      });
      setHomeTeamName('');
      setAwayTeamName('');
      await Promise.all([onRefreshMatches(), loadOverview()]);
      showToast('Match créé.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Échec de la création du match.', 'error');
    }
  };

  const handleUpdateMatch = async (matchId: number) => {
    const edit = scoreEdits[matchId];
    if (!edit) return;
    try {
      await apiFetch(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify(edit),
      });
      await Promise.all([onRefreshMatches(), loadOverview()]);
      showToast(
        edit.status === 'finished' ? 'Match terminé et gains réglés.' : 'Match mis à jour.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Échec de la mise à jour.', 'error');
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    try {
      await apiFetch(`/api/admin/matches/${matchId}`, { method: 'DELETE' });
      await Promise.all([onRefreshMatches(), loadOverview()]);
      showToast('Match supprimé.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Échec de la suppression.', 'error');
    }
  };

  const handleUpdateMarket = async (marketId: number) => {
    try {
      await apiFetch(`/api/admin/markets/${marketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ simulatedOdds: marketEdits[marketId] }),
      });
      await Promise.all([onRefreshMatches(), loadOverview()]);
      showToast('Cote mise à jour.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Échec de la mise à jour de la cote.', 'error');
    }
  };

  const handleCreateSport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/sports', {
        method: 'POST',
        body: JSON.stringify({ name: newSportName, icon: 'trophy' }),
      });
      setNewSportName('');
      await loadOverview();
      showToast('Sport ajouté.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Échec de l’ajout du sport.', 'error');
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/competitions', {
        method: 'POST',
        body: JSON.stringify({
          name: newCompName,
          country: newCompCountry,
          sportId: newCompSportId,
        }),
      });
      setNewCompName('');
      setNewCompCountry('');
      await loadOverview();
      showToast('Compétition créée.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Échec de la création.', 'error');
    }
  };

  const selectedOddsMatch = matches.find((m) => m.id === oddsMatchId);
  const pendingDepositsCount = deposits.filter((d) => d.status === 'pending').length;

  const filteredDeposits = deposits.filter((d) =>
    depositFilter === 'all' ? true : d.status === depositFilter
  );

  const conversations = (() => {
    const map = new Map<
      number,
      {
        userId: number;
        userName: string;
        userEmail: string;
        userBalance: number;
        lastMessage: string;
        lastAt: string;
        items: ContactMessageItem[];
      }
    >();
    const chronological = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const m of chronological) {
      const existing = map.get(m.userId);
      if (existing) {
        existing.items.push(m);
        existing.lastMessage = m.message;
        existing.lastAt = m.createdAt;
      } else {
        map.set(m.userId, {
          userId: m.userId,
          userName: m.userName || `Joueur #${m.userId}`,
          userEmail: m.userEmail || '',
          userBalance: m.userBalance ?? 0,
          lastMessage: m.message,
          lastAt: m.createdAt,
          items: [m],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  })();

  const activeConversation =
    conversations.find((c) => c.userId === selectedChatUserId) || conversations[0] || null;

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900">
            Console Admin · Gestion Temps Réel
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {user.email} · Validez les recharges (Tickets / D17), gérez les cotes et répondez aux joueurs en direct.
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-[#0a58ca]">
          {pendingDepositsCount} recharge(s) en attente
        </div>
      </div>

      {/* KPI Strip */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Joueurs</span>
            <p className="font-mono-tabular text-xl font-extrabold text-slate-900 mt-1">
              {overview.stats.totalUsers}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
            <span className="text-xs text-amber-800 font-medium">Recharges en attente</span>
            <p className="font-mono-tabular text-xl font-extrabold text-amber-700 mt-1">
              {pendingDepositsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Conversations</span>
            <p className="font-mono-tabular text-xl font-extrabold text-slate-900 mt-1">
              {conversations.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Total Paris</span>
            <p className="font-mono-tabular text-xl font-extrabold text-[#0a58ca] mt-1">
              {overview.stats.totalVirtualBets}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 col-span-2 lg:col-span-1 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Volume Misé</span>
            <p className="font-mono-tabular text-xl font-extrabold text-emerald-600 mt-1">
              {overview.stats.totalVirtualVolume.toFixed(2)} DT
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-xs">
        {(
          [
            { id: 'deposits', label: 'Recharges (Tickets & D17)', badge: pendingDepositsCount },
            { id: 'messages', label: 'Messages Joueurs', badge: conversations.length },
            { id: 'users', label: 'Joueurs & Soldes', badge: 0 },
            { id: 'matches', label: 'Matchs & Scores', badge: 0 },
            { id: 'odds', label: 'Cotes', badge: 0 },
            { id: 'catalog', label: 'Sports & Ligues', badge: 0 },
            { id: 'activity', label: 'Activité', badge: 0 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-[#0a58ca] text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>{t.label}</span>
            {t.badge > 0 && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono-tabular font-bold ${
                  t.id === 'deposits'
                    ? 'bg-[#dc2626] text-white'
                    : activeTab === t.id
                    ? 'bg-white text-[#0a58ca]'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && !overview ? (
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      ) : (
        <>
          {/* Tab 0: Real-Time Deposits Queue */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  {(
                    [
                      { id: 'all', label: `Toutes (${deposits.length})` },
                      { id: 'pending', label: `En attente (${pendingDepositsCount})` },
                      {
                        id: 'approved',
                        label: `Acceptées (${deposits.filter((d) => d.status === 'approved').length})`,
                      },
                      {
                        id: 'rejected',
                        label: `Refusées (${deposits.filter((d) => d.status === 'rejected').length})`,
                      },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDepositFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        depositFilter === f.id
                          ? 'bg-[#0a58ca] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredDeposits.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2 shadow-xs">
                  <ArrowDownCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    Aucune demande de recharge dans cette catégorie
                  </p>
                  <p className="text-xs text-slate-500">
                    Dès qu’un joueur envoie des tickets Ooredoo/Orange/Telecom ou une capture D17, elle apparaît ici en temps réel.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDeposits.map((dep) => {
                    const isPending = dep.status === 'pending';
                    const isApproved = dep.status === 'approved';
                    const busy = processingDepositId === dep.id;
                    return (
                      <div
                        key={dep.id}
                        className={`rounded-2xl border bg-white p-4 sm:p-5 space-y-3 shadow-xs ${
                          isPending ? 'border-blue-300' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <OperatorBadge operator={dep.operator} size="md" />
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-bold text-slate-900 text-sm">
                                  {dep.username || `User #${dep.userId}`}
                                </span>
                                {dep.email && <span className="text-slate-500">({dep.email})</span>}
                                <span className="font-mono-tabular font-extrabold text-[#0a58ca] text-sm">
                                  +{dep.amount.toFixed(2)} DT
                                </span>
                              </div>
                              <p className="text-[11px] font-mono-tabular text-slate-500">
                                Demande #{dep.id} · {dep.operator} ({dep.method}) ·{' '}
                                {new Date(dep.createdAt).toLocaleString()}
                              </p>

                              {dep.method === 'tickets' && dep.ticketCodes.length > 0 && (
                                <div className="pt-1 space-y-1">
                                  <p className="text-[11px] font-semibold text-slate-600">
                                    Codes Tickets ({dep.ticketCodes.length} × 2.00 DT) :
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {dep.ticketCodes.map((code, i) => (
                                      <span
                                        key={i}
                                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono-tabular text-xs font-bold text-slate-900 select-all"
                                      >
                                        {code}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {dep.method === 'D17' && (
                                <div className="pt-1 space-y-1.5 text-xs">
                                  <p className="text-slate-600 font-mono-tabular">
                                    Numéro D17 du joueur :{' '}
                                    <strong className="text-[#0a58ca] select-all">
                                      {dep.phoneNumber || 'Non fourni'}
                                    </strong>
                                  </p>
                                </div>
                              )}

                              {dep.note && (
                                <p className="text-xs text-slate-500">Note joueur : {dep.note}</p>
                              )}
                            </div>
                          </div>

                          {dep.screenshotData && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshot(dep.screenshotData!)}
                                className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-[#0a58ca] w-24 h-24 shrink-0 bg-slate-100"
                                title="Agrandir la capture d'écran D17"
                              >
                                <img
                                  src={dep.screenshotData}
                                  alt="Capture D17"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-white transition-opacity">
                                  <ZoomIn className="w-4 h-4" />
                                  <span>Agrandir</span>
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        {isPending ? (
                          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <input
                              type="text"
                              value={depositNotes[dep.id] || ''}
                              onChange={(e) =>
                                setDepositNotes((prev) => ({ ...prev, [dep.id]: e.target.value }))
                              }
                              placeholder="Note optionnelle (ex: Code vérifié, Reçu D17 invalide...)"
                              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:bg-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleApproveDeposit(dep.id, dep.userId)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-bold px-4 py-2 text-xs"
                              >
                                <Check className="w-4 h-4" />
                                <span>{busy ? '...' : `Accepter (+${dep.amount.toFixed(2)} DT)`}</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRejectDeposit(dep.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 font-semibold px-4 py-2 text-xs"
                              >
                                <X className="w-4 h-4" />
                                <span>Refuser</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500">
                              {dep.adminNote ? `Note : ${dep.adminNote}` : ''}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {isApproved ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Accepté</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Refusé</span>
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Real-Time User Contact Messages */}
          {activeTab === 'messages' && (
            <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
                  <MessageCircle className="w-4 h-4 text-[#0a58ca]" />
                  <span>Conversations ({conversations.length})</span>
                </div>
                {conversations.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500">
                    Aucun message reçu pour le moment.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                    {conversations.map((conv) => {
                      const active = activeConversation?.userId === conv.userId;
                      return (
                        <button
                          key={conv.userId}
                          type="button"
                          onClick={() => setSelectedChatUserId(conv.userId)}
                          className={`w-full text-left p-3.5 space-y-1 transition-colors ${
                            active ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-900 truncate">{conv.userName}</span>
                            <span className="font-mono-tabular text-[#0a58ca] font-bold shrink-0">
                              {conv.userBalance.toFixed(2)} DT
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{conv.lastMessage}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[460px] shadow-xs">
                {!activeConversation ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                    <Clock className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">
                      En attente de messages des joueurs
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Les joueurs peuvent vous contacter depuis la page Recharger pour envoyer leur argent ou demander assistance en temps réel.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <p className="font-bold text-slate-900 text-sm">{activeConversation.userName}</p>
                        <p className="text-slate-500">{activeConversation.userEmail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('users');
                          handleInspectUser(activeConversation.userId);
                        }}
                        className="rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-bold text-[#0a58ca]"
                      >
                        Inspecter / Créditer ({activeConversation.userBalance.toFixed(2)} DT)
                      </button>
                    </div>

                    <div className="flex-1 p-4 space-y-2.5 max-h-[340px] overflow-y-auto bg-[#f8fafc]">
                      {activeConversation.items.map((msg) => {
                        const isAdmin = msg.senderRole === 'admin';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs space-y-1 shadow-2xs ${
                                isAdmin
                                  ? 'bg-[#0a58ca] text-white font-medium'
                                  : 'bg-white border border-slate-200 text-slate-900'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 font-bold">
                                <span>{isAdmin ? 'Vous (Admin)' : msg.senderName}</span>
                                <span className="font-mono-tabular">
                                  {new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={handleSendAdminReply}
                      className="p-3 border-t border-slate-100 bg-white flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Répondre à ${activeConversation.userName} en temps réel...`}
                        className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !replyText.trim()}
                        onClick={() => {
                          if (!selectedChatUserId) {
                            setSelectedChatUserId(activeConversation.userId);
                          }
                        }}
                        className="h-9 px-4 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Envoyer</span>
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 1: Users Search & Credit Inspector */}
          {activeTab === 'users' && overview && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Rechercher un joueur par nom, e-mail ou ID..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:bg-white focus:outline-none"
                  />
                </div>
                <span className="text-xs font-mono-tabular text-slate-500 shrink-0">
                  {filteredUsers.length} sur {overview.users.length} joueurs
                </span>
              </div>

              <div className="grid xl:grid-cols-[1.2fr_1fr] gap-5 items-start">
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Users className="w-4 h-4 text-[#0a58ca]" />
                    <span>Liste des Comptes</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                    {filteredUsers.map((u) => {
                      const isSelected = inspectedUser?.user.id === u.id;
                      return (
                        <div
                          key={u.id}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular text-slate-400">#{u.id}</span>
                              <span className="font-bold text-slate-900 truncate">{u.username}</span>
                              {u.role === 'admin' && (
                                <span className="rounded bg-[#0a58ca] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 truncate mt-0.5">{u.email}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1 font-mono-tabular">
                              <span className="text-[#0a58ca] font-bold">
                                Solde : {u.virtualBalance.toFixed(2)} DT
                              </span>
                              <span className="text-emerald-600 font-semibold">
                                Gain : +{u.totalGain.toFixed(2)} DT
                              </span>
                              {u.pendingPotentialGain > 0 && (
                                <span className="text-slate-500">
                                  En cours : {u.pendingPotentialGain.toFixed(2)} DT
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInspectUser(u.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:border-[#0a58ca] hover:text-[#0a58ca] px-3 py-2 text-xs font-semibold text-slate-800 shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspecter &amp; Créditer</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-4 py-3.5 border-b border-slate-100 bg-[#0a58ca] text-white flex items-center justify-between">
                    <span className="font-heading text-sm font-extrabold">
                      Inspecteur &amp; Crédit Joueur
                    </span>
                    {inspectedUser && (
                      <span className="font-mono-tabular text-xs font-bold">
                        ID #{inspectedUser.user.id}
                      </span>
                    )}
                  </div>

                  {inspectLoading ? (
                    <div className="p-6 space-y-3">
                      <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                      <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
                    </div>
                  ) : !inspectedUser ? (
                    <div className="p-8 text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-700">Sélectionnez un joueur</p>
                      <p className="text-xs text-slate-500">
                        Cliquez sur &quot;Inspecter &amp; Créditer&quot; sur un joueur de la liste pour gérer son solde et voir ses tickets.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">
                            {inspectedUser.user.username}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{inspectedUser.user.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleRole(inspectedUser.user.id, inspectedUser.user.role)
                          }
                          className="rounded-lg border border-slate-300 bg-white hover:border-[#0a58ca] px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {inspectedUser.user.role === 'admin' ? 'Passer Joueur' : 'Passer Admin'}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <span className="text-[11px] text-slate-500 block">Solde</span>
                          <span className="font-mono-tabular text-sm font-extrabold text-[#0a58ca]">
                            {inspectedUser.user.virtualBalance.toFixed(2)} DT
                          </span>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                          <span className="text-[11px] text-emerald-700 block">Total Gains</span>
                          <span className="font-mono-tabular text-sm font-extrabold text-emerald-700">
                            +{inspectedUser.metrics.totalGain.toFixed(2)} DT
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <span className="text-[11px] text-slate-500 block">En attente</span>
                          <span className="font-mono-tabular text-sm font-extrabold text-slate-900">
                            {inspectedUser.metrics.pendingGain.toFixed(2)} DT
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0a58ca]">
                          <Banknote className="w-4 h-4" />
                          <span>Créditer des DT au joueur</span>
                        </div>

                        <div className="grid grid-cols-5 gap-1.5">
                          {[10, 20, 50, 100, 500].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              disabled={crediting}
                              onClick={() => handleCreditUser(inspectedUser.user.id, amt)}
                              className="rounded-lg border border-slate-300 bg-white hover:border-[#0a58ca] hover:text-[#0a58ca] py-1.5 text-xs font-mono-tabular font-bold text-slate-800 transition-colors"
                            >
                              +{amt}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                            placeholder="DT"
                            className="w-24 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono-tabular text-slate-900 focus:border-[#0a58ca] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={creditNote}
                            onChange={(e) => setCreditNote(e.target.value)}
                            placeholder="Note"
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0a58ca] focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={crediting}
                            onClick={() => handleCreditUser(inspectedUser.user.id)}
                            className="rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold px-3.5 py-2 text-xs shrink-0"
                          >
                            {crediting ? '...' : 'Créditer'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-[#0a58ca]" />
                          <span>Tickets du joueur ({inspectedUser.bets.length})</span>
                        </h3>
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50">
                          {inspectedUser.bets.length === 0 ? (
                            <p className="p-4 text-center text-xs text-slate-500">
                              Aucun ticket placé par ce joueur.
                            </p>
                          ) : (
                            inspectedUser.bets.map((b) => (
                              <div key={b.id} className="p-2.5 text-xs space-y-1">
                                <div className="flex justify-between font-mono-tabular">
                                  <span className="font-bold text-slate-900">{b.reference}</span>
                                  <span
                                    className={`font-bold uppercase ${
                                      b.status === 'won'
                                        ? 'text-emerald-600'
                                        : b.status === 'lost'
                                        ? 'text-rose-600'
                                        : 'text-[#0a58ca]'
                                    }`}
                                  >
                                    {b.status}
                                  </span>
                                </div>
                                <div className="flex justify-between text-[11px] font-mono-tabular text-slate-500">
                                  <span>Mise : {b.virtualStake.toFixed(2)} DT</span>
                                  <span className="text-emerald-600 font-semibold">
                                    Gain : {b.potentialVirtualWinnings.toFixed(2)} DT
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Matches & Scores */}
          {activeTab === 'matches' && overview && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateMatch}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs"
              >
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Plus className="w-4 h-4 text-[#0a58ca]" />
                  <span>Ajouter un Match Personnalisé</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <select
                    value={sportId}
                    onChange={(e) => setSportId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                  >
                    {overview.sports.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={competitionId}
                    onChange={(e) => setCompetitionId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                  >
                    {overview.competitions
                      .filter((c) => c.sportId === sportId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>

                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'upcoming' | 'live')}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="upcoming">À venir</option>
                    <option value="live">En direct</option>
                  </select>

                  <input
                    type="text"
                    required
                    value={homeTeamName}
                    onChange={(e) => setHomeTeamName(e.target.value)}
                    placeholder="Équipe Domicile"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    required
                    value={awayTeamName}
                    onChange={(e) => setAwayTeamName(e.target.value)}
                    placeholder="Équipe Extérieur"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    value={newTimer}
                    onChange={(e) => setNewTimer(e.target.value)}
                    placeholder="Minute / Heure"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold px-4 py-2 text-xs"
                >
                  Créer le Match
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 text-sm font-extrabold text-slate-900">
                  Matchs &amp; Règlement des Scores ({matches.length})
                </div>
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                  {matches.map((m) => {
                    const edit = scoreEdits[m.id] || {
                      homeScore: m.homeScore,
                      awayScore: m.awayScore,
                      status: m.status,
                      matchTimer: m.matchTimer,
                    };
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {m.homeTeam.name} vs {m.awayTeam.name}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {m.sportName} · {m.competitionName}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={edit.homeScore}
                            onChange={(e) =>
                              setScoreEdits((prev) => ({
                                ...prev,
                                [m.id]: { ...edit, homeScore: Number(e.target.value) },
                              }))
                            }
                            aria-label="Score domicile"
                            className="w-14 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center font-mono-tabular text-slate-900 font-bold"
                          />
                          <span className="text-slate-400">:</span>
                          <input
                            type="number"
                            min={0}
                            value={edit.awayScore}
                            onChange={(e) =>
                              setScoreEdits((prev) => ({
                                ...prev,
                                [m.id]: { ...edit, awayScore: Number(e.target.value) },
                              }))
                            }
                            aria-label="Score extérieur"
                            className="w-14 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center font-mono-tabular text-slate-900 font-bold"
                          />
                          <input
                            type="text"
                            value={edit.matchTimer}
                            onChange={(e) =>
                              setScoreEdits((prev) => ({
                                ...prev,
                                [m.id]: { ...edit, matchTimer: e.target.value },
                              }))
                            }
                            aria-label="Chrono du match"
                            className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono-tabular text-slate-900"
                          />
                          <select
                            value={edit.status}
                            onChange={(e) =>
                              setScoreEdits((prev) => ({
                                ...prev,
                                [m.id]: { ...edit, status: e.target.value },
                              }))
                            }
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-900"
                          >
                            <option value="upcoming">À venir</option>
                            <option value="live">En direct</option>
                            <option value="finished">Terminé (Régler)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleUpdateMatch(m.id)}
                            className="rounded-lg bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold px-3 py-1.5"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(m.id)}
                            className="rounded-lg border border-slate-300 hover:border-rose-500 text-slate-400 hover:text-rose-600 p-1.5"
                            aria-label="Supprimer le match"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Odds */}
          {activeTab === 'odds' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Sliders className="w-4 h-4 text-[#0a58ca]" />
                  <span>Modifier les Cotes des Marchés</span>
                </div>
                <select
                  value={oddsMatchId || ''}
                  onChange={(e) => setOddsMatchId(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 max-w-sm"
                >
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.homeTeam.name} vs {m.awayTeam.name} ({m.competitionName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedOddsMatch && (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {selectedOddsMatch.markets.map((mkt) => (
                    <div
                      key={mkt.id}
                      className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{mkt.selectionName}</span>
                        <span className="text-slate-500 ml-2">({mkt.marketType})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="1.01"
                          value={marketEdits[mkt.id] ?? mkt.simulatedOdds}
                          onChange={(e) =>
                            setMarketEdits((prev) => ({
                              ...prev,
                              [mkt.id]: Number(e.target.value),
                            }))
                          }
                          className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono-tabular text-slate-900 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateMarket(mkt.id)}
                          className="rounded-lg bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold px-3 py-1.5"
                        >
                          Appliquer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Sports & Competitions */}
          {activeTab === 'catalog' && overview && (
            <div className="grid md:grid-cols-2 gap-4">
              <form
                onSubmit={handleCreateSport}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs"
              >
                <h2 className="font-heading text-sm font-extrabold text-slate-900">Ajouter un Sport</h2>
                <input
                  type="text"
                  required
                  value={newSportName}
                  onChange={(e) => setNewSportName(e.target.value)}
                  placeholder="Nom du sport"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#0a58ca] text-white font-bold px-4 py-2 text-xs"
                >
                  Créer le Sport
                </button>
              </form>

              <form
                onSubmit={handleCreateCompetition}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs"
              >
                <h2 className="font-heading text-sm font-extrabold text-slate-900">
                  Ajouter une Compétition
                </h2>
                <select
                  value={newCompSportId}
                  onChange={(e) => setNewCompSportId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                >
                  {overview.sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="Nom de la compétition"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  required
                  value={newCompCountry}
                  onChange={(e) => setNewCompCountry(e.target.value)}
                  placeholder="Pays"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#0a58ca] text-white font-bold px-4 py-2 text-xs"
                >
                  Créer la Compétition
                </button>
              </form>
            </div>
          )}

          {/* Tab 5: Bets & Audit Log */}
          {activeTab === 'activity' && overview && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Derniers Paris sur la Plateforme</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {overview.bets.map((b) => (
                    <div key={b.id} className="p-3.5 text-xs flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900 font-mono-tabular">
                          {b.reference} · {b.username}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          Mise {b.virtualStake.toFixed(2)} DT @ {b.combinedOdds}x → Gain{' '}
                          {b.potentialVirtualWinnings.toFixed(2)} DT
                        </p>
                      </div>
                      <span className="font-bold uppercase text-[#0a58ca]">{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 text-sm font-extrabold text-slate-900">
                  Journal d&apos;Audit Administrateur
                </div>
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {overview.auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0a58ca] font-mono-tabular">
                          {log.action}
                        </span>
                        <span className="text-slate-400 font-mono-tabular">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700">{log.details}</p>
                      <p className="text-slate-400">Par {log.adminName}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Full-Size Screenshot Lightbox for D17 Receipts */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div
            className="relative max-w-xl w-full rounded-2xl bg-white border border-slate-200 p-2.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewScreenshot(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#0a58ca] text-white flex items-center justify-center shadow-lg font-bold"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewScreenshot}
              alt="Capture D17"
              className="w-full max-h-[82vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
