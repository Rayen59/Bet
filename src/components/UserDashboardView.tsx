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
        showToast(err?.message || 'Failed to load account records.', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, statusFilter, fromDate, toDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time refresh when balance or deposit updates via SSE
  useEffect(() => {
    if (!user?.id) return;
    const onBalanceEvent = () => {
      loadData(true);
    };
    window.addEventListener('sportzone:balance_updated', onBalanceEvent);
    window.addEventListener('sportzone:deposit_updated', onBalanceEvent);
    return () => {
      window.removeEventListener('sportzone:balance_updated', onBalanceEvent);
      window.removeEventListener('sportzone:deposit_updated', onBalanceEvent);
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
      showToast('Account balance & history refreshed.', 'success');
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-[#1a1a1d] p-10 text-center space-y-4">
        <p className="text-base font-bold text-white">Sign in required</p>
        <p className="text-sm text-zinc-400">
          Please sign in to view your DT account balance, betting slips, and preferences.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-md bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold text-sm"
        >
          Sign In
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
      showToast('Profile and favorite preferences updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile.', 'error');
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
      showToast('No active/open fixtures left from that ticket to re-use.', 'info');
      return;
    }

    addMultipleSelections(reusable);
    setMobileOpen(true);
    showToast(`Loaded ${reusable.length} active selection(s) into Betslip.`, 'success');
  };

  const pendingGainTotal = bets
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + b.potentialVirtualWinnings, 0);

  return (
    <div className="space-y-4">
      {/* Gold Account Card matching screenshots 27c1ef7e & 46f7db2f */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-b from-[#e0a119] to-[#c98b10] text-[#111111] shadow-xl">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-black/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#111111] flex items-center justify-center font-mono-tabular font-bold text-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-mono-tabular text-base font-bold leading-tight">
                #{user.id} · {user.username}
              </h1>
              <p className="text-xs font-medium text-[#111111]/80 capitalize">
                {user.role} · {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#f5cb42] hover:bg-[#fde047] text-[#111111] px-4 py-1.5 text-xs font-bold shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                showToast('Signed out.', 'info');
                onNavigate('home');
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-black/25 bg-black/10 hover:bg-black/20 text-[#111111] px-3 py-1.5 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-black/15 bg-black/5 text-xs">
          <div className="p-3">
            <span className="font-medium opacity-80 block">Cash:</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              DT {user.virtualBalance.toFixed(2)}
            </p>
          </div>
          <div className="p-3">
            <span className="font-medium opacity-80 block">Total Gain:</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              DT {(stats?.totalWonCredits ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="p-3">
            <span className="font-medium opacity-80 block">Pending Win:</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              DT {pendingGainTotal.toFixed(2)}
            </p>
          </div>
          <div className="p-3">
            <span className="font-medium opacity-80 block">Win Rate:</span>
            <p className="font-mono-tabular text-base font-extrabold mt-0.5">
              {stats?.winRate ?? 0}% ({stats?.totalBets ?? bets.length})
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#18191d] border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'dashboard'
                ? 'bg-[#f5b800] text-[#111111] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Aperçu
          </button>
          <button
            type="button"
            onClick={() => onNavigate('recharge')}
            className="px-3.5 py-1.5 rounded text-xs font-semibold text-[#f5b800] hover:bg-[#f5b800]/10 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Recharger / Contact</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'history'
                ? 'bg-[#f5b800] text-[#111111] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mes Paris
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'profile'
                ? 'bg-[#f5b800] text-[#111111] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Profil
          </button>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('promotions')}
          className="text-xs font-semibold text-[#f5b800] hover:underline"
        >
          Bonus & Récompenses →
        </button>
      </div>

      {/* Overview KPI + Ledger */}
      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-md border border-zinc-800 bg-[#17171a] p-3.5 space-y-1">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#f5b800]" />
                Available Cash
              </span>
              <p className="font-mono-tabular text-lg font-bold text-[#f5b800]">
                {user.virtualBalance.toFixed(2)} DT
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#17171a] p-3.5 space-y-1">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-300" />
                Total Tickets
              </span>
              <p className="font-mono-tabular text-lg font-bold text-white">
                {stats?.totalBets ?? bets.length}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#17171a] p-3.5 space-y-1">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                Total Gain
              </span>
              <p className="font-mono-tabular text-lg font-bold text-emerald-400">
                +{(stats?.totalWonCredits ?? 0).toFixed(2)} DT
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#17171a] p-3.5 space-y-1">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-zinc-300" />
                Total Staked
              </span>
              <p className="font-mono-tabular text-lg font-bold text-white">
                {(stats?.totalStaked ?? 0).toFixed(2)} DT
              </p>
            </div>
          </div>

          {/* Recharge & Contact Admin Card with Operator Logos & Real-Time Status */}
          {user.role !== 'admin' && (
            <div className="rounded-xl border border-[#f5b800]/35 bg-[#18191d] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-display text-base font-bold text-white uppercase flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#f5b800]" />
                    <span>Recharger mon compte (Min 5.00 DT pour parier)</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Tickets Ooredoo, Orange, Tunisie Telecom (2.00 DT / ticket) ou transfert D17 avec capture d’écran.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('recharge')}
                    className="rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-4 py-2 text-xs inline-flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Recharger maintenant</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('recharge')}
                    className="rounded-lg border border-zinc-700 hover:border-[#f5b800] text-zinc-200 font-semibold px-3.5 py-2 text-xs inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#f5b800]" />
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
                <div className="rounded-lg border border-zinc-800 bg-[#111215] divide-y divide-zinc-800/80">
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
                            <span className="font-bold text-white">{dep.operator}</span>
                            <span className="font-mono-tabular font-bold text-[#f5b800] ml-2">
                              +{dep.amount.toFixed(2)} DT
                            </span>
                            <span className="block text-[11px] text-zinc-500 font-mono-tabular">
                              {new Date(dep.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                            <Clock className="w-3 h-3 animate-pulse" />
                            <span>En cours de traitement</span>
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Accepté</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-400">
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

          <div className="rounded-xl border border-zinc-800 bg-[#18191d] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 bg-[#121316] flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-white uppercase">Transactions (DT)</h2>
              <span className="text-[11px] text-zinc-400">
                Historique en temps réel
              </span>
            </div>
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-400">
                Aucune transaction pour le moment. Rechargez votre compte via Tickets ou D17.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Description</th>
                      <th className="px-4 py-2.5 font-medium">Statut / Type</th>
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {transactions.slice(0, 15).map((tx) => {
                      const isPending = tx.transactionType === 'deposit_pending';
                      const isApproved = tx.transactionType === 'deposit_approved';
                      const isRejected = tx.transactionType === 'deposit_rejected';
                      return (
                        <tr key={tx.id} className="hover:bg-zinc-900/50">
                          <td className="px-4 py-2.5 text-zinc-200">{tx.description}</td>
                          <td className="px-4 py-2.5 capitalize">
                            {isPending ? (
                              <span className="rounded bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[11px] font-bold">
                                En cours de traitement
                              </span>
                            ) : isApproved ? (
                              <span className="rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[11px] font-bold">
                                Accepté
                              </span>
                            ) : isRejected ? (
                              <span className="rounded bg-rose-500/20 text-rose-400 px-2 py-0.5 text-[11px] font-bold">
                                Refusé
                              </span>
                            ) : (
                              <span className="text-zinc-400">{tx.transactionType.replace(/_/g, ' ')}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono-tabular text-zinc-400">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td
                            className={`px-4 py-2.5 font-mono-tabular font-semibold text-right ${
                              isRejected
                                ? 'text-rose-400 line-through'
                                : isPending
                                ? 'text-[#f5b800]'
                                : tx.amount >= 0
                                ? 'text-emerald-400'
                                : 'text-zinc-300'
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

      {/* MY BETS Ticket Cards matching screenshot b7a43b21 */}
      {(tab === 'history' || tab === 'dashboard') && (
        <div className="space-y-3">
          <div className="rounded-md border border-zinc-800 bg-[#17171a] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-bold text-white uppercase">
              {tab === 'dashboard' ? 'Recent Tickets' : 'My Bets'}
            </h2>

            {tab === 'history' && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Filter className="w-3.5 h-3.5" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded border border-zinc-700 bg-[#121214] px-2.5 py-1.5 text-zinc-200 focus:border-[#f5b800] focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label="From date"
                    className="rounded border border-zinc-700 bg-[#121214] px-2 py-1.5 text-zinc-200 focus:border-[#f5b800] focus:outline-none"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label="To date"
                    className="rounded border border-zinc-700 bg-[#121214] px-2 py-1.5 text-zinc-200 focus:border-[#f5b800] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2.5">
              <div className="h-24 bg-[#17171a] rounded-md animate-pulse" />
              <div className="h-24 bg-[#17171a] rounded-md animate-pulse" />
            </div>
          ) : bets.length === 0 ? (
            <div className="rounded-md border border-zinc-800 bg-[#17171a] p-8 text-center space-y-3">
              <p className="text-sm text-zinc-300 font-medium">No tickets match your filters</p>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="px-4 py-2 rounded-md bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold text-xs"
              >
                Explore Live & Upcoming Matches
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(tab === 'dashboard' ? bets.slice(0, 5) : bets).map((bet) => (
                <div
                  key={bet.id}
                  className="rounded-md border border-zinc-800 bg-[#131315] p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-mono-tabular border-b border-zinc-800/80 pb-2">
                    <span className="font-bold text-white">{bet.reference}</span>
                    <span
                      className={`font-bold uppercase ${
                        bet.status === 'won'
                          ? 'text-emerald-400'
                          : bet.status === 'lost'
                          ? 'text-rose-400'
                          : 'text-[#f5b800]'
                      }`}
                    >
                      {bet.status}
                    </span>
                  </div>

                  {/* Selection Cards matching screenshot b7a43b21 */}
                  <div className="space-y-2">
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
                        <div
                          key={sel.id}
                          className="rounded-md border border-zinc-800/80 bg-[#0b0b0d] p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span
                              className={`font-bold ${
                                bet.status === 'won' ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {sel.selectionName}
                            </span>
                            <span className="font-mono-tabular font-bold text-white">
                              {sel.simulatedOdds.toFixed(2)}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-400">{sel.marketType}</p>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-white truncate">
                              {liveMatch
                                ? `${liveMatch.homeTeam.name} ${
                                    liveMatch.status === 'upcoming'
                                      ? 'vs.'
                                      : `${liveMatch.homeScore}:${liveMatch.awayScore}`
                                  } ${liveMatch.awayTeam.name}`
                                : sel.matchLabel}
                            </span>
                            <span className="font-mono-tabular text-zinc-400 shrink-0">{dtShort}</span>
                          </div>

                          {liveMatch?.status === 'live' && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="rounded-xs bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                LIVE
                              </span>
                              <span className="font-mono-tabular text-xs font-bold text-white">
                                {liveMatch.matchTimer}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Full-width Re use selections button matching b7a43b21 */}
                  {matches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleReuseSelections(bet)}
                      className="w-full flex items-center justify-center gap-2 rounded-md border border-zinc-600 bg-[#1a1a1d] hover:border-[#f5b800] hover:text-[#f5b800] py-2 text-xs font-bold text-white transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re use selections</span>
                    </button>
                  )}

                  <div className="flex items-center justify-between text-xs font-mono-tabular pt-1 text-zinc-400">
                    <span>
                      Total odds <strong className="text-white ml-1">{bet.combinedOdds.toFixed(2)}</strong>
                    </span>
                    <span>
                      Stake: <strong className="text-white">{bet.virtualStake.toFixed(2)} DT</strong>
                    </span>
                    <span>
                      {bet.status === 'won' ? 'Gain:' : 'Win:'}{' '}
                      <strong className="text-emerald-400">
                        {bet.potentialVirtualWinnings.toFixed(2)} DT
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile & Favorites */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-md border border-zinc-800 bg-[#17171a] p-5 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-username" className="block text-xs font-medium text-zinc-300">
                Display Username
              </label>
              <input
                id="profile-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#121214] px-3.5 py-2.5 text-sm text-white focus:border-[#f5b800] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Email Address</label>
              <input
                type="text"
                disabled
                value={user.email}
                className="w-full rounded-md border border-zinc-800 bg-[#121214]/60 px-3.5 py-2.5 text-sm text-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-zinc-300">Favorite Sports</h3>
            <div className="flex flex-wrap gap-2">
              {sports.map((sp) => {
                const active = favSports.includes(sp.slug);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => toggleFavSport(sp.slug)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#f5b800] bg-[#f5b800]/15 text-[#f5b800]'
                        : 'border-zinc-800 bg-[#121214] text-zinc-400 hover:text-white'
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
            <h3 className="text-xs font-semibold text-zinc-300">Favorite Teams</h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TEAMS.map((team) => {
                const active = favTeams.includes(team);
                return (
                  <button
                    key={team}
                    type="button"
                    onClick={() => toggleFavTeam(team)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-zinc-800 bg-[#121214] text-zinc-400 hover:text-white'
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
            className="rounded-md bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-5 py-2.5 text-sm transition-colors"
          >
            {savingProfile ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      )}
    </div>
  );
}
