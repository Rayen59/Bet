import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  History,
  LogOut,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Trophy,
  User as UserIcon,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSlip } from '../context/SlipContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import {
  AppRoute,
  DepositRequestItem,
  MatchItem,
  SlipSelection,
  SportItem,
  TransactionItem,
  VirtualBetItem,
} from '../types/sportzone';
import { D17Logo, OoredooLogo, OperatorBadge, OrangeLogo, TunisieTelecomLogo } from './OperatorLogos';

interface UserDashboardViewProps {
  tab: 'dashboard' | 'history' | 'profile';
  sports: SportItem[];
  matches?: MatchItem[];
  onNavigate: (route: AppRoute) => void;
}

const POPULAR_TEAMS = [
  'Arsenal',
  'Liverpool',
  'Manchester City',
  'Real Madrid',
  'FC Barcelona',
  'Paris Saint-Germain',
  'Inter Milan',
  'Bayern Munich',
  'Boston Celtics',
  'Los Angeles Lakers',
];

export function UserDashboardView({
  tab,
  sports,
  matches = [],
  onNavigate,
}: UserDashboardViewProps) {
  const { user, stats, refreshProfile, logout } = useAuth();
  const { addMultipleSelections, setMobileOpen } = useSlip();
  const { showToast } = useToast();

  const [bets, setBets] = useState<VirtualBetItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [deposits, setDeposits] = useState<DepositRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [username, setUsername] = useState(user?.username || '');
  const [favSports, setFavSports] = useState<string[]>(user?.favoriteSports || []);
  const [favTeams, setFavTeams] = useState<string[]>(user?.favoriteTeams || []);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setFavSports(user.favoriteSports);
      setFavTeams(user.favoriteTeams);
    }
  }, [user]);

  const loadData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const [betRes, txRes, depRes] = await Promise.all([
        apiFetch<{ bets: VirtualBetItem[] }>(`/api/bets/history?${params.toString()}`),
        apiFetch<{ transactions: TransactionItem[] }>('/api/transactions'),
        apiFetch<{ deposits: DepositRequestItem[] }>('/api/deposits/mine'),
      ]);
      setBets(betRes.bets);
      setTransactions(txRes.transactions);
      setDeposits(depRes.deposits);
    } catch (err: any) {
      if (!silent) {
        showToast(err?.message || 'Impossible de charger les données du compte.', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, statusFilter, fromDate, toDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time refresh when balance, deposits, or live matches update
  useEffect(() => {
    if (!user?.id) return;
    const onLiveEvent = () => {
      loadData(true);
    };
    window.addEventListener('sportzone:balance_updated', onLiveEvent);
    window.addEventListener('sportzone:deposit_updated', onLiveEvent);
    window.addEventListener('sportzone:matches_updated', onLiveEvent);
    return () => {
      window.removeEventListener('sportzone:balance_updated', onLiveEvent);
      window.removeEventListener('sportzone:deposit_updated', onLiveEvent);
      window.removeEventListener('sportzone:matches_updated', onLiveEvent);
    };
  }, [user?.id, loadData]);

  useEffect(() => {
    if (user?.id) {
      loadData(true);
    }
  }, [user?.virtualBalance, user?.id, loadData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), loadData()]);
      showToast('Solde et historique actualisés.', 'success');
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4 shadow-xs">
        <p className="text-base font-bold text-slate-900">Connexion requise</p>
        <p className="text-sm text-slate-500">
          Connectez-vous pour consulter votre solde DT, vos paris en temps réel et vos préférences.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold text-sm"
        >
          Se Connecter
        </button>
      </div>
    );
  }

  const toggleFavSport = (slug: string) => {
    setFavSports((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const toggleFavTeam = (name: string) => {
    setFavTeams((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/api/user/favorites', {
        method: 'PATCH',
        body: JSON.stringify({
          username,
          favoriteSports: favSports,
          favoriteTeams: favTeams,
        }),
      });
      await refreshProfile();
      showToast('Profil et favoris mis à jour.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Échec de la mise à jour du profil.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleReuseSelections = (bet: VirtualBetItem) => {
    const reusable: SlipSelection[] = [];
    for (const sel of bet.selections) {
      const liveMatch = matches.find((m) => m.id === sel.matchId);
      if (liveMatch && liveMatch.status !== 'finished') {
        const liveMkt = liveMatch.markets.find((mk) => mk.id === sel.marketId);
        reusable.push({
          matchId: liveMatch.id,
          marketId: liveMkt?.id || sel.marketId,
          matchLabel: `${liveMatch.homeTeam.name} vs ${liveMatch.awayTeam.name}`,
          competitionName: liveMatch.competitionName,
          marketType: sel.marketType,
          selectionName: sel.selectionName,
          simulatedOdds: liveMkt?.simulatedOdds ?? sel.simulatedOdds,
          status: liveMatch.status,
          startTime: liveMatch.startTime,
        });
      }
    }

    if (reusable.length === 0) {
      showToast('Aucun match actif restant sur ce ticket.', 'info');
      return;
    }

    addMultipleSelections(reusable);
    setMobileOpen(true);
    showToast(`${reusable.length} sélection(s) ajoutée(s) au ticket.`, 'success');
  };

  const pendingGainTotal = bets
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + b.potentialVirtualWinnings, 0);

  return (
    <div className="space-y-4">
      {/* Crisp Royal Blue Account Card */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a58ca] to-[#084298] text-white shadow-sm">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/15 border border-white/30 flex items-center justify-center font-mono-tabular font-bold text-sm">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-mono-tabular text-base font-bold leading-tight">
                #{user.id} · {user.username}
              </h1>
              <p className="text-xs font-medium text-blue-100 capitalize">
                {user.role} · {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-blue-50 text-[#0a58ca] px-4 py-2 text-xs font-bold shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                showToast('Déconnecté.', 'info');
                onNavigate('home');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/15 bg-black/10 text-xs">
          <div className="p-3.5">
            <span className="font-medium text-blue-100 block">Solde disponible</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              {user.virtualBalance.toFixed(2)} DT
            </p>
          </div>
          <div className="p-3.5">
            <span className="font-medium text-blue-100 block">Gains totaux</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              {(stats?.totalWonCredits ?? 0).toFixed(2)} DT
            </p>
          </div>
          <div className="p-3.5">
            <span className="font-medium text-blue-100 block">Gains en cours</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              {pendingGainTotal.toFixed(2)} DT
            </p>
          </div>
          <div className="p-3.5">
            <span className="font-medium text-blue-100 block">Taux de réussite</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              {stats?.winRate ?? 0}% ({stats?.totalBets ?? bets.length})
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'dashboard'
                ? 'bg-[#0a58ca] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aperçu
          </button>
          <button
            type="button"
            onClick={() => onNavigate('recharge')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#059669] hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Recharger / Contact</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'history'
                ? 'bg-[#0a58ca] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mes Paris
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'profile'
                ? 'bg-[#0a58ca] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Profil
          </button>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('promotions')}
          className="text-xs font-bold text-[#0a58ca] hover:underline"
        >
          Bonus &amp; Récompenses →
        </button>
      </div>

      {/* Overview KPI + Ledger */}
      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <Wallet className="w-3.5 h-3.5 text-[#0a58ca]" />
                Solde disponible
              </span>
              <p className="font-mono-tabular text-lg font-extrabold text-[#0a58ca]">
                {user.virtualBalance.toFixed(2)} DT
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Tickets placés
              </span>
              <p className="font-mono-tabular text-lg font-extrabold text-slate-900">
                {stats?.totalBets ?? bets.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                Total Gains
              </span>
              <p className="font-mono-tabular text-lg font-extrabold text-emerald-600">
                +{(stats?.totalWonCredits ?? 0).toFixed(2)} DT
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                Total Misé
              </span>
              <p className="font-mono-tabular text-lg font-extrabold text-slate-900">
                {(stats?.totalStaked ?? 0).toFixed(2)} DT
              </p>
            </div>
          </div>

          {user.role !== 'admin' && (
            <div className="rounded-2xl border border-blue-200 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#0a58ca]" />
                    <span>Recharger mon compte (Min 5.00 DT pour parier)</span>
                  </h2>
                  <p className="text-xs font-bold text-slate-600">
                    Tickets Ooredoo, Orange, Tunisie Telecom (1.200 DT / ticket) ou transfert D17 avec capture d’écran.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('recharge')}
                    className="rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold px-4 py-2 text-xs inline-flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Recharger maintenant</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('recharge')}
                    className="rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold px-3.5 py-2 text-xs inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#0a58ca]" />
                    <span>Contacter l’Admin</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <OoredooLogo className="h-8 w-auto" />
                <OrangeLogo className="h-8 w-auto" />
                <TunisieTelecomLogo className="h-8 w-auto" />
                <D17Logo className="h-8 w-auto" />
              </div>

              {deposits.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
                  {deposits.slice(0, 5).map((dep) => {
                    const isPending = dep.status === 'pending';
                    const isApproved = dep.status === 'approved';
                    return (
                      <div
                        key={dep.id}
                        className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <OperatorBadge operator={dep.operator} size="sm" />
                          <div>
                            <span className="font-bold text-slate-900">{dep.operator}</span>
                            <span className="font-mono-tabular font-bold text-[#0a58ca] ml-2">
                              +{dep.amount.toFixed(2)} DT
                            </span>
                            <span className="block text-[11px] text-slate-500 font-mono-tabular">
                              {new Date(dep.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>En cours</span>
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Accepté</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                            <XCircle className="w-3 h-3" />
                            <span>Refusé</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <h2 className="font-heading text-sm font-extrabold text-slate-900">
                Transactions (DT)
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Historique en temps réel
              </span>
            </div>
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Aucune transaction pour le moment. Rechargez votre compte via Tickets ou D17.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Description</th>
                      <th className="px-4 py-2.5 font-bold">Statut / Type</th>
                      <th className="px-4 py-2.5 font-bold">Date</th>
                      <th className="px-4 py-2.5 font-bold text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.slice(0, 15).map((tx) => {
                      const isPending = tx.transactionType === 'deposit_pending';
                      const isApproved = tx.transactionType === 'deposit_approved';
                      const isRejected = tx.transactionType === 'deposit_rejected';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-800 font-medium">{tx.description}</td>
                          <td className="px-4 py-3 capitalize">
                            {isPending ? (
                              <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
                                En cours
                              </span>
                            ) : isApproved ? (
                              <span className="rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-bold">
                                Accepté
                              </span>
                            ) : isRejected ? (
                              <span className="rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[11px] font-bold">
                                Refusé
                              </span>
                            ) : (
                              <span className="text-slate-500">{tx.transactionType.replace(/_/g, ' ')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono-tabular text-slate-500">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td
                            className={`px-4 py-3 font-mono-tabular font-bold text-right ${
                              isRejected
                                ? 'text-rose-500 line-through'
                                : isPending
                                ? 'text-amber-600'
                                : tx.amount >= 0
                                ? 'text-emerald-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {tx.amount >= 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} DT
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* REAL-TIME MY BETS Cards matching screenshot b7a43b21 in Crisp Light Design */}
      {(tab === 'history' || tab === 'dashboard') && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <h2 className="font-heading text-base font-extrabold text-slate-900">
              {tab === 'dashboard' ? 'Tickets Récents en Temps Réel' : 'Mes Paris en Temps Réel'}
            </h2>

            {tab === 'history' && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Filter className="w-3.5 h-3.5" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-slate-800 font-medium focus:border-[#0a58ca] focus:outline-none"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="pending">En direct / En attente</option>
                    <option value="won">Gagnés</option>
                    <option value="lost">Perdus</option>
                    <option value="cancelled">Annulés</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label="Date début"
                    className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-800 focus:border-[#0a58ca] focus:outline-none"
                  />
                  <span>au</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label="Date fin"
                    className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-800 focus:border-[#0a58ca] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2.5">
              <div className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
              <div className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            </div>
          ) : bets.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
              <p className="text-sm text-slate-600 font-medium">
                Aucun ticket ne correspond à vos filtres
              </p>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="px-4 py-2 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold text-xs"
              >
                Explorer les matchs en direct
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {(tab === 'dashboard' ? bets.slice(0, 5) : bets).map((bet) => {
                const isWon = bet.status === 'won';
                const isLost = bet.status === 'lost';
                return (
                  <div
                    key={bet.id}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                  >
                    {/* Header Strip */}
                    <div className="flex items-center justify-between text-xs font-mono-tabular border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                      <span className="font-bold text-slate-800">{bet.reference}</span>
                      <span
                        className={`font-extrabold uppercase px-2 py-0.5 rounded text-[11px] ${
                          isWon
                            ? 'bg-emerald-100 text-emerald-700'
                            : isLost
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-blue-100 text-[#0a58ca]'
                        }`}
                      >
                        {isWon ? 'Gagné' : isLost ? 'Perdu' : 'En direct'}
                      </span>
                    </div>

                    {/* Selection Cards matching Screenshot 4 (b7a43b21) in Light Theme */}
                    <div className="divide-y divide-slate-100">
                      {bet.selections.map((sel) => {
                        const liveMatch = matches.find((m) => m.id === sel.matchId);
                        const dt = liveMatch
                          ? new Date(liveMatch.startTime)
                          : new Date(bet.createdAt);
                        const dtShort = `${String(dt.getDate()).padStart(2, '0')}/${String(
                          dt.getMonth() + 1
                        ).padStart(2, '0')} • ${String(dt.getHours()).padStart(2, '0')}:${String(
                          dt.getMinutes()
                        ).padStart(2, '0')}`;

                        return (
                          <div key={sel.id} className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span
                                className={`font-bold ${
                                  isWon ? 'text-emerald-600' : 'text-slate-900'
                                }`}
                              >
                                {sel.selectionName}
                              </span>
                              <span className="font-mono-tabular font-extrabold text-slate-900">
                                {sel.simulatedOdds.toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{sel.marketType}</span>
                              {isWon && (
                                <span className="rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-emerald-700 leading-none">
                                  EP
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm pt-0.5">
                              <span className="font-semibold text-slate-900 truncate">
                                {liveMatch
                                  ? `${liveMatch.homeTeam.name} ${
                                      liveMatch.status === 'upcoming'
                                        ? 'vs.'
                                        : `${liveMatch.homeScore}:${liveMatch.awayScore}`
                                    } ${liveMatch.awayTeam.name}`
                                  : sel.matchLabel.replace(' vs ', ' vs. ')}
                              </span>
                              <span className="font-mono-tabular text-xs text-slate-500 shrink-0">
                                {dtShort}
                              </span>
                            </div>

                            {liveMatch?.status === 'live' && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                  LIVE
                                </span>
                                <span className="font-mono-tabular text-xs font-bold text-slate-800">
                                  {liveMatch.matchTimer}
                                </span>
                              </div>
                            )}

                            {isWon && liveMatch?.status !== 'live' && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="rounded bg-[#059669] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                  EP
                                </span>
                                <span className="text-xs font-semibold text-emerald-600">
                                  Validé · Gain crédité
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Full-width Re use selections button + Total Odds Footer */}
                    <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 space-y-2.5">
                      {matches.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleReuseSelections(bet)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 py-2.5 text-xs font-bold text-slate-800 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Réutiliser les sélections</span>
                        </button>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular pt-0.5 text-slate-600">
                        <span>
                          Cote totale{' '}
                          <strong className="text-slate-900 ml-1">
                            {bet.combinedOdds.toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          Mise :{' '}
                          <strong className="text-slate-900">
                            {bet.virtualStake.toFixed(2)} DT
                          </strong>
                        </span>
                        <span>
                          {bet.status === 'won' ? 'Gain :' : 'Potentiel :'}{' '}
                          <strong className="text-emerald-600">
                            {bet.potentialVirtualWinnings.toFixed(2)} DT
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Profile & Favorites */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-username" className="block text-xs font-semibold text-slate-700">
                Nom d&apos;utilisateur
              </label>
              <input
                id="profile-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0a58ca] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Adresse E-mail</label>
              <input
                type="text"
                disabled
                value={user.email}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Sports Favoris
            </h3>
            <div className="flex flex-wrap gap-2">
              {sports.map((sp) => {
                const active = favSports.includes(sp.slug);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => toggleFavSport(sp.slug)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#0a58ca] bg-[#0a58ca] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{sp.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Équipes Favorites
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TEAMS.map((team) => {
                const active = favTeams.includes(team);
                return (
                  <button
                    key={team}
                    type="button"
                    onClick={() => toggleFavTeam(team)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#059669] bg-[#059669] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{team}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold px-5 py-2.5 text-sm transition-colors"
          >
            {savingProfile ? 'Enregistrement...' : 'Enregistrer les préférences'}
          </button>
        </form>
      )}
    </div>
  );
}
