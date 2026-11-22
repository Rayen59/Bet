import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownCircle,
  Banknote,
  Check,
  Eye,
  Plus,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import {
  AdminUserSummary,
  AppRoute,
  AuditLogItem,
  CompetitionItem,
  DepositRequestItem,
  MatchItem,
  SportItem,
  TransactionItem,
  VirtualBetItem,
} from '../types/sportzone';

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
  const [processingDepositId, setProcessingDepositId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'matches' | 'odds' | 'catalog' | 'activity'>('users');

  // User Search & Inspector
  const [userSearch, setUserSearch] = useState('');
  const [inspectedUser, setInspectedUser] = useState<InspectedUserPayload | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState<string>('50');
  const [creditNote, setCreditNote] = useState<string>('Admin Credit Deposit');
  const [crediting, setCrediting] = useState(false);

  // Create match form
  const [sportId, setSportId] = useState<number>(1);
  const [competitionId, setCompetitionId] = useState<number>(1);
  const [homeTeamName, setHomeTeamName] = useState('');
  const [awayTeamName, setAwayTeamName] = useState('');
  const [newStatus, setNewStatus] = useState<'upcoming' | 'live'>('upcoming');
  const [newTimer, setNewTimer] = useState('20:00');

  // Create sport / competition forms
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
      const [data, depRes] = await Promise.all([
        apiFetch<AdminOverviewData>('/api/admin/overview'),
        apiFetch<{ deposits: DepositRequestItem[] }>('/api/admin/deposits'),
      ]);
      setOverview(data);
      setDeposits(depRes.deposits);
      if (data.sports.length > 0 && !data.sports.some((s) => s.id === sportId)) {
        setSportId(data.sports[0].id);
        setNewCompSportId(data.sports[0].id);
      }
      if (data.competitions.length > 0 && !data.competitions.some((c) => c.id === competitionId)) {
        setCompetitionId(data.competitions[0].id);
      }
    } catch (err: any) {
      if (!silent) {
        showToast(err?.message || 'Failed to load admin overview.', 'error');
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

  // Real-time SSE listener + 6s silent polling for new deposits & balance updates
  useEffect(() => {
    if (user?.role !== 'admin') return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('deposit_requested', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data || '{}') as {
            username?: string;
            amount?: number;
          };
          if (payload.username && payload.amount) {
            showToast(`New deposit request: ${payload.username} (+${payload.amount.toFixed(2)} DT)`, 'info');
          }
        } catch {
          // ignore
        }
        loadOverview(true);
      });
      es.addEventListener('balance_updated', () => {
        loadOverview(true);
      });
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
    }, 6_000);

    return () => {
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
      <div className="rounded-xl border border-rose-500/30 bg-[#18181b] p-10 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h1 className="font-display text-xl font-bold text-white">Restricted Admin Area</h1>
        <p className="text-sm text-zinc-400">
          Administrator credentials are required to manage users, balances, matches, and odds.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-4 py-2 rounded-lg bg-[#f5b800] text-[#111111] font-bold text-sm"
        >
          Sign In as Admin
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
      showToast(err?.message || 'Failed to load user details.', 'error');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleCreditUser = async (targetUserId: number, amountOverride?: number) => {
    const amt = amountOverride ?? Number(creditAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a positive DT amount to credit.', 'error');
      return;
    }
    setCrediting(true);
    try {
      await apiFetch(`/api/admin/users/${targetUserId}/credit`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt, note: creditNote }),
      });
      showToast(`Credited +${amt.toFixed(2)} DT to user account.`, 'success');
      await Promise.all([loadOverview(true), handleInspectUser(targetUserId), refreshProfile()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to credit account.', 'error');
    } finally {
      setCrediting(false);
    }
  };

  const handleApproveDeposit = async (depositId: number, targetUserId: number) => {
    setProcessingDepositId(depositId);
    try {
      await apiFetch(`/api/admin/deposits/${depositId}/approve`, { method: 'POST' });
      showToast('Deposit approved & DT balance credited in real time.', 'success');
      await Promise.all([
        loadOverview(true),
        inspectedUser?.user.id === targetUserId ? handleInspectUser(targetUserId) : Promise.resolve(),
        refreshProfile(),
      ]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to approve deposit.', 'error');
    } finally {
      setProcessingDepositId(null);
    }
  };

  const handleRejectDeposit = async (depositId: number) => {
    setProcessingDepositId(depositId);
    try {
      await apiFetch(`/api/admin/deposits/${depositId}/reject`, { method: 'POST' });
      showToast('Deposit request rejected.', 'info');
      await loadOverview(true);
    } catch (err: any) {
      showToast(err?.message || 'Failed to reject deposit.', 'error');
    } finally {
      setProcessingDepositId(null);
    }
  };

  const handleToggleRole = async (targetUserId: number, currentRole: string) => {
    try {
      await apiFetch(`/api/admin/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: currentRole === 'admin' ? 'user' : 'admin' }),
      });
      await Promise.all([loadOverview(), handleInspectUser(targetUserId)]);
      showToast('User role updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update role.', 'error');
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
      showToast('Match created.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create match.', 'error');
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
        edit.status === 'finished' ? 'Match finished and winnings settled.' : 'Match updated.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update match.', 'error');
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    try {
      await apiFetch(`/api/admin/matches/${matchId}`, { method: 'DELETE' });
      await Promise.all([onRefreshMatches(), loadOverview()]);
      showToast('Match removed.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete match.', 'error');
    }
  };

  const handleUpdateMarket = async (marketId: number) => {
    try {
      await apiFetch(`/api/admin/markets/${marketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ simulatedOdds: marketEdits[marketId] }),
      });
      await Promise.all([onRefreshMatches(), loadOverview()]);
      showToast('Market odds updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update market.', 'error');
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
      showToast('Sport added.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to add sport.', 'error');
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
      showToast('Competition created.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create competition.', 'error');
    }
  };

  const selectedOddsMatch = matches.find((m) => m.id === oddsMatchId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#f5b800]">SPORTZONE Admin Console</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Logged in as {user.email} · Manage users, credit DT balances, inspect winnings (Gain), and live matches
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4">
            <span className="text-xs text-zinc-400">Total Users</span>
            <p className="font-mono-tabular text-xl font-bold text-white mt-1">
              {overview.stats.totalUsers}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4">
            <span className="text-xs text-zinc-400">Real Matches</span>
            <p className="font-mono-tabular text-xl font-bold text-white mt-1">
              {overview.stats.totalMatches}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4">
            <span className="text-xs text-zinc-400">Live Now</span>
            <p className="font-mono-tabular text-xl font-bold text-[#dc2626] mt-1">
              {overview.stats.liveMatches}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4">
            <span className="text-xs text-zinc-400">Total Bets</span>
            <p className="font-mono-tabular text-xl font-bold text-[#f5b800] mt-1">
              {overview.stats.totalVirtualBets}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4 col-span-2 lg:col-span-1">
            <span className="text-xs text-zinc-400">Total Staked</span>
            <p className="font-mono-tabular text-xl font-bold text-emerald-400 mt-1">
              {overview.stats.totalVirtualVolume.toFixed(2)} DT
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#18181b] border border-zinc-800 rounded-lg w-fit">
        {(
          [
            {
              id: 'users',
              label: 'Users, Credits & Winnings (Gain)',
              badge: deposits.filter((d) => d.transactionType === 'deposit_pending').length,
            },
            { id: 'matches', label: 'Matches & Scores', badge: 0 },
            { id: 'odds', label: 'Odds Editor', badge: 0 },
            { id: 'catalog', label: 'Sports & Leagues', badge: 0 },
            { id: 'activity', label: 'Bets & Audit Log', badge: 0 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-[#f5b800] text-[#111111]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            {t.badge > 0 && (
              <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-mono-tabular font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && !overview ? (
        <div className="h-64 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
      ) : (
        <>
          {/* Tab 1: Users Search, List, Credit Top-Up & Gain Inspector */}
          {activeTab === 'users' && overview && (
            <div className="space-y-5">
              {/* Real-Time Deposit Requests Queue */}
              {deposits.length > 0 && (
                <div className="rounded-xl border border-[#f5b800]/40 bg-[#18181b] overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <ArrowDownCircle className="w-4 h-4 text-[#f5b800]" />
                      <span>Deposit Requests (Real-Time)</span>
                    </div>
                    <span className="text-xs font-mono-tabular text-[#f5b800]">
                      {deposits.filter((d) => d.transactionType === 'deposit_pending').length} pending
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-800/80 max-h-64 overflow-y-auto">
                    {deposits.slice(0, 15).map((dep) => {
                      const isPending = dep.transactionType === 'deposit_pending';
                      const isApproved = dep.transactionType === 'deposit_approved';
                      const busy = processingDepositId === dep.id;
                      return (
                        <div
                          key={dep.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{dep.username}</span>
                              <span className="text-zinc-400 truncate">({dep.email})</span>
                              <span className="font-mono-tabular font-extrabold text-[#f5b800]">
                                +{dep.amount.toFixed(2)} DT
                              </span>
                            </div>
                            <p className="text-zinc-300 truncate">{dep.description}</p>
                            <p className="text-[11px] font-mono-tabular text-zinc-500">
                              {new Date(dep.createdAt).toLocaleString()}
                            </p>
                          </div>

                          {isPending ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleApproveDeposit(dep.id, dep.userId)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#09100b] font-bold px-3 py-1.5 text-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{busy ? '...' : 'Approve & Credit'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRejectDeposit(dep.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-300 font-semibold px-3 py-1.5 text-xs"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase shrink-0 ${
                                isApproved
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {isApproved ? 'Approved' : 'Rejected'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user by username, email, or account ID..."
                    className="w-full rounded-lg border border-zinc-700 bg-[#121214] pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#f5b800] focus:outline-none"
                  />
                </div>
                <span className="text-xs font-mono-tabular text-zinc-400 shrink-0">
                  Showing {filteredUsers.length} of {overview.users.length} users
                </span>
              </div>

              <div className="grid xl:grid-cols-[1.2fr_1fr] gap-5 items-start">
                {/* Users List Table */}
                <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center gap-2 text-sm font-bold text-white">
                    <Users className="w-4 h-4 text-[#f5b800]" />
                    <span>Registered Users List</span>
                  </div>
                  <div className="divide-y divide-zinc-800/80 max-h-[560px] overflow-y-auto">
                    {filteredUsers.map((u) => {
                      const isSelected = inspectedUser?.user.id === u.id;
                      return (
                        <div
                          key={u.id}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                            isSelected ? 'bg-[#f5b800]/10' : 'hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular text-zinc-500">#{u.id}</span>
                              <span className="font-bold text-white truncate">{u.username}</span>
                              {u.role === 'admin' && (
                                <span className="rounded bg-[#f5b800] px-1.5 py-0.5 text-[10px] font-bold text-[#111111]">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-400 truncate mt-0.5">{u.email}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1 font-mono-tabular">
                              <span className="text-[#f5b800] font-bold">
                                Balance: {u.virtualBalance.toFixed(2)} DT
                              </span>
                              <span className="text-emerald-400 font-semibold">
                                Gain: +{u.totalGain.toFixed(2)} DT
                              </span>
                              {u.pendingPotentialGain > 0 && (
                                <span className="text-zinc-400">
                                  Pending: {u.pendingPotentialGain.toFixed(2)} DT
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInspectUser(u.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-[#222226] hover:border-[#f5b800] hover:text-[#f5b800] px-3 py-2 text-xs font-semibold text-white shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect & Credit</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* User Inspector & Credit Panel */}
                <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 bg-[#f5b800] text-[#111111] flex items-center justify-between">
                    <span className="font-display text-sm font-extrabold">
                      User Account & Winnings Inspector
                    </span>
                    {inspectedUser && (
                      <span className="font-mono-tabular text-xs font-bold">
                        ID #{inspectedUser.user.id}
                      </span>
                    )}
                  </div>

                  {inspectLoading ? (
                    <div className="p-6 space-y-3">
                      <div className="h-24 bg-zinc-900 rounded animate-pulse" />
                      <div className="h-32 bg-zinc-900 rounded animate-pulse" />
                    </div>
                  ) : !inspectedUser ? (
                    <div className="p-8 text-center space-y-2">
                      <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-sm font-semibold text-zinc-300">Select a User</p>
                      <p className="text-xs text-zinc-500">
                        Click "Inspect & Credit" on any user from the list to view their balance, tickets, total winnings (Gain), and credit DT to their account.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {/* Profile Summary */}
                      <div className="rounded-lg border border-zinc-800 bg-[#121214] p-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">
                            {inspectedUser.user.username}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">{inspectedUser.user.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleRole(inspectedUser.user.id, inspectedUser.user.role)
                          }
                          className="rounded border border-zinc-700 hover:border-[#f5b800] px-2.5 py-1 text-[11px] font-semibold text-zinc-300"
                        >
                          {inspectedUser.user.role === 'admin' ? 'Set User' : 'Make Admin'}
                        </button>
                      </div>

                      {/* Balance & Gain Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border border-zinc-800 bg-[#121214] p-2.5">
                          <span className="text-[11px] text-zinc-400 block">Balance</span>
                          <span className="font-mono-tabular text-sm font-bold text-[#f5b800]">
                            {inspectedUser.user.virtualBalance.toFixed(2)} DT
                          </span>
                        </div>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                          <span className="text-[11px] text-emerald-300 block">Total Gain</span>
                          <span className="font-mono-tabular text-sm font-bold text-emerald-400">
                            +{inspectedUser.metrics.totalGain.toFixed(2)} DT
                          </span>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-[#121214] p-2.5">
                          <span className="text-[11px] text-zinc-400 block">Pending Win</span>
                          <span className="font-mono-tabular text-sm font-bold text-white">
                            {inspectedUser.metrics.pendingGain.toFixed(2)} DT
                          </span>
                        </div>
                      </div>

                      {/* Credit Account Form */}
                      <div className="rounded-lg border border-[#f5b800]/40 bg-[#121214] p-3.5 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#f5b800]">
                          <Banknote className="w-4 h-4" />
                          <span>Credit DT to User Account</span>
                        </div>

                        <div className="grid grid-cols-5 gap-1.5">
                          {[10, 20, 50, 100, 500].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              disabled={crediting}
                              onClick={() => handleCreditUser(inspectedUser.user.id, amt)}
                              className="rounded border border-zinc-700 bg-zinc-900 hover:border-[#f5b800] hover:text-[#f5b800] py-1.5 text-xs font-mono-tabular font-bold text-white transition-colors"
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
                            placeholder="Amount DT"
                            className="w-28 rounded-lg border border-zinc-700 bg-[#18181b] px-2.5 py-2 text-xs font-mono-tabular text-white focus:border-[#f5b800] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={creditNote}
                            onChange={(e) => setCreditNote(e.target.value)}
                            placeholder="Note"
                            className="flex-1 rounded-lg border border-zinc-700 bg-[#18181b] px-2.5 py-2 text-xs text-white focus:border-[#f5b800] focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={crediting}
                            onClick={() => handleCreditUser(inspectedUser.user.id)}
                            className="rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-3.5 py-2 text-xs shrink-0"
                          >
                            {crediting ? '...' : 'Credit'}
                          </button>
                        </div>
                      </div>

                      {/* User Tickets & Winnings */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-[#f5b800]" />
                          <span>User Tickets & Winnings ({inspectedUser.bets.length})</span>
                        </h3>
                        <div className="max-h-56 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-[#121214]">
                          {inspectedUser.bets.length === 0 ? (
                            <p className="p-4 text-center text-xs text-zinc-500">
                              No betting tickets placed by this user yet.
                            </p>
                          ) : (
                            inspectedUser.bets.map((b) => (
                              <div key={b.id} className="p-2.5 text-xs space-y-1">
                                <div className="flex justify-between font-mono-tabular">
                                  <span className="font-bold text-white">{b.reference}</span>
                                  <span
                                    className={`font-bold uppercase ${
                                      b.status === 'won'
                                        ? 'text-emerald-400'
                                        : b.status === 'lost'
                                        ? 'text-rose-400'
                                        : 'text-[#f5b800]'
                                    }`}
                                  >
                                    {b.status}
                                  </span>
                                </div>
                                <div className="flex justify-between text-[11px] font-mono-tabular text-zinc-400">
                                  <span>Stake: {b.virtualStake.toFixed(2)} DT</span>
                                  <span className="text-emerald-400 font-semibold">
                                    Gain: {b.potentialVirtualWinnings.toFixed(2)} DT
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
                className="rounded-xl border border-zinc-800 bg-[#18181b] p-5 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Plus className="w-4 h-4 text-[#f5b800]" />
                  <span>Add Custom Match</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <select
                    value={sportId}
                    onChange={(e) => setSportId(Number(e.target.value))}
                    className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
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
                    className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
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
                    className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                  </select>

                  <input
                    type="text"
                    required
                    value={homeTeamName}
                    onChange={(e) => setHomeTeamName(e.target.value)}
                    placeholder="Home Team"
                    className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    required
                    value={awayTeamName}
                    onChange={(e) => setAwayTeamName(e.target.value)}
                    placeholder="Away Team"
                    className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newTimer}
                    onChange={(e) => setNewTimer(e.target.value)}
                    placeholder="Timer / Kickoff"
                    className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-4 py-2 text-xs"
                >
                  Create Match
                </button>
              </form>

              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] text-sm font-bold text-white">
                  Matches & Score Settlement ({matches.length})
                </div>
                <div className="divide-y divide-zinc-800/80 max-h-[540px] overflow-y-auto">
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
                          <p className="font-semibold text-white truncate">
                            {m.homeTeam.name} vs {m.awayTeam.name}
                          </p>
                          <p className="text-zinc-400 mt-0.5">
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
                            aria-label="Home score"
                            className="w-14 rounded border border-zinc-700 bg-[#121214] px-2 py-1.5 text-center font-mono-tabular text-white"
                          />
                          <span className="text-zinc-500">:</span>
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
                            aria-label="Away score"
                            className="w-14 rounded border border-zinc-700 bg-[#121214] px-2 py-1.5 text-center font-mono-tabular text-white"
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
                            aria-label="Match timer"
                            className="w-24 rounded border border-zinc-700 bg-[#121214] px-2 py-1.5 font-mono-tabular text-white"
                          />
                          <select
                            value={edit.status}
                            onChange={(e) =>
                              setScoreEdits((prev) => ({
                                ...prev,
                                [m.id]: { ...edit, status: e.target.value },
                              }))
                            }
                            className="rounded border border-zinc-700 bg-[#121214] px-2 py-1.5 text-white"
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="live">Live</option>
                            <option value="finished">Finished (Settle)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleUpdateMatch(m.id)}
                            className="rounded bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-3 py-1.5"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(m.id)}
                            className="rounded border border-zinc-700 hover:border-rose-500 text-zinc-400 hover:text-rose-400 p-1.5"
                            aria-label="Delete match"
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
            <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sliders className="w-4 h-4 text-[#f5b800]" />
                  <span>Edit Simulated Market Odds</span>
                </div>
                <select
                  value={oddsMatchId || ''}
                  onChange={(e) => setOddsMatchId(Number(e.target.value))}
                  className="rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white max-w-sm"
                >
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.homeTeam.name} vs {m.awayTeam.name} ({m.competitionName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedOddsMatch && (
                <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg">
                  {selectedOddsMatch.markets.map((mkt) => (
                    <div
                      key={mkt.id}
                      className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{mkt.selectionName}</span>
                        <span className="text-zinc-500 ml-2">({mkt.marketType})</span>
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
                          className="w-24 rounded border border-zinc-700 bg-[#121214] px-2.5 py-1.5 font-mono-tabular text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateMarket(mkt.id)}
                          className="rounded bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-3 py-1.5"
                        >
                          Update
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
                className="rounded-xl border border-zinc-800 bg-[#18181b] p-5 space-y-4"
              >
                <h2 className="font-display text-sm font-bold text-white">Add Sport</h2>
                <input
                  type="text"
                  required
                  value={newSportName}
                  onChange={(e) => setNewSportName(e.target.value)}
                  placeholder="Sport Name"
                  className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#f5b800] text-[#111111] font-bold px-4 py-2 text-xs"
                >
                  Create Sport
                </button>
              </form>

              <form
                onSubmit={handleCreateCompetition}
                className="rounded-xl border border-zinc-800 bg-[#18181b] p-5 space-y-4"
              >
                <h2 className="font-display text-sm font-bold text-white">Add Competition</h2>
                <select
                  value={newCompSportId}
                  onChange={(e) => setNewCompSportId(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
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
                  placeholder="Competition Name"
                  className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  required
                  value={newCompCountry}
                  onChange={(e) => setNewCompCountry(e.target.value)}
                  placeholder="Country"
                  className="w-full rounded-lg border border-zinc-700 bg-[#121214] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#f5b800] text-[#111111] font-bold px-4 py-2 text-xs"
                >
                  Create Competition
                </button>
              </form>
            </div>
          )}

          {/* Tab 5: Bets & Audit Log */}
          {activeTab === 'activity' && overview && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center gap-2 text-sm font-bold text-white">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Recent Platform Bets</span>
                </div>
                <div className="divide-y divide-zinc-800/80 max-h-[420px] overflow-y-auto">
                  {overview.bets.map((b) => (
                    <div key={b.id} className="p-3.5 text-xs flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white font-mono-tabular">
                          {b.reference} · {b.username}
                        </p>
                        <p className="text-zinc-400 mt-0.5">
                          Stake {b.virtualStake.toFixed(2)} DT @ {b.combinedOdds}x → Gain{' '}
                          {b.potentialVirtualWinnings.toFixed(2)} DT
                        </p>
                      </div>
                      <span className="font-semibold uppercase text-[#f5b800]">{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] text-sm font-bold text-white">
                  Administrative Audit Log
                </div>
                <div className="divide-y divide-zinc-800/80 max-h-[420px] overflow-y-auto">
                  {overview.auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#f5b800] font-mono-tabular">
                          {log.action}
                        </span>
                        <span className="text-zinc-500 font-mono-tabular">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-zinc-300">{log.details}</p>
                      <p className="text-zinc-500">By {log.adminName}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
