import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Gift,
  Layers,
  Minus,
  Radio,
  RotateCcw,
  Settings,
  Shield,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSlip } from '../context/SlipContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { AppRoute, MatchItem, SlipSelection, VirtualBetItem } from '../types/sportzone';

interface BettingSlipProps {
  matches?: MatchItem[];
  onNavigate: (route: AppRoute) => void;
  onBetPlaced?: () => void;
}

const QUICK_STAKES = [5, 10, 20, 50];

function nCr(n: number, r: number): number {
  if (r > n || r < 0) return 0;
  let num = 1;
  let den = 1;
  for (let i = 0; i < r; i++) {
    num *= n - i;
    den *= i + 1;
  }
  return Math.round(num / den);
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(
    2,
    '0'
  )} • ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

function formatMatchupWithScore(matchLabel: string, liveMatch?: MatchItem): string {
  if (!liveMatch) return matchLabel.replace(' vs ', ' vs. ');
  if (liveMatch.status === 'live' || liveMatch.status === 'finished') {
    return `${liveMatch.homeTeam.name} ${liveMatch.homeScore}:${liveMatch.awayScore} ${liveMatch.awayTeam.name}`;
  }
  return `${liveMatch.homeTeam.name} vs. ${liveMatch.awayTeam.name}`;
}

export function BettingSlip({ matches = [], onNavigate, onBetPlaced }: BettingSlipProps) {
  const { user, updateLocalBalance, refreshProfile } = useAuth();
  const {
    selections,
    matchGroups,
    stake,
    slipMode,
    systemSize,
    comboCount,
    totalStake,
    combinedOdds,
    boostPercent,
    extraWinnings,
    potentialWinnings,
    qualifyingLegs,
    lastReceipt,
    setSlipMode,
    setSystemSize,
    addMultipleSelections,
    removeSelection,
    clearMatchSelections,
    clearSlip,
    setStake,
    setLastReceipt,
    setMobileOpen,
  } = useSlip();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'betslip' | 'mybets'>('betslip');
  const [submitting, setSubmitting] = useState(false);
  const [acceptOddsChange, setAcceptOddsChange] = useState(true);
  const [myBets, setMyBets] = useState<VirtualBetItem[]>([]);

  const matchById = useMemo(() => {
    const map = new Map<number, MatchItem>();
    for (const m of matches) {
      map.set(m.id, m);
    }
    return map;
  }, [matches]);

  const insufficientBalance = Boolean(user && totalStake > user.virtualBalance);
  const invalidSystemCount =
    slipMode === 'system' && (matchGroups.length < 3 || matchGroups.length > 10);

  const loadMyBets = useCallback(() => {
    if (!user) return;
    apiFetch<{ bets: VirtualBetItem[] }>('/api/bets/history')
      .then((res) => setMyBets(res.bets.slice(0, 10)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (activeTab === 'mybets' && user) {
      loadMyBets();
    }
  }, [activeTab, user, loadMyBets]);

  useEffect(() => {
    if (!user) return;
    const onSync = () => {
      if (activeTab === 'mybets') {
        loadMyBets();
      }
    };
    window.addEventListener('sportzone:matches_updated', onSync);
    window.addEventListener('sportzone:balance_updated', onSync);
    return () => {
      window.removeEventListener('sportzone:matches_updated', onSync);
      window.removeEventListener('sportzone:balance_updated', onSync);
    };
  }, [user, activeTab, loadMyBets]);

  const handleReuseSelections = (bet: VirtualBetItem) => {
    const reused: SlipSelection[] = [];
    for (const sel of bet.selections) {
      const liveMatch = matchById.get(sel.matchId);
      if (liveMatch && liveMatch.status === 'finished') continue;
      const liveMarket = liveMatch?.markets.find((mk) => mk.id === sel.marketId);
      reused.push({
        matchId: sel.matchId,
        marketId: sel.marketId,
        matchLabel: liveMatch
          ? `${liveMatch.homeTeam.name} vs ${liveMatch.awayTeam.name}`
          : sel.matchLabel,
        competitionName: liveMatch?.competitionName || '',
        marketType: sel.marketType,
        selectionName: sel.selectionName,
        simulatedOdds: liveMarket ? liveMarket.simulatedOdds : sel.simulatedOdds,
        status: liveMatch?.status || 'upcoming',
        startTime: liveMatch?.startTime || new Date().toISOString(),
      });
    }
    if (reused.length === 0) {
      showToast('Les matchs de ce ticket sont déjà terminés.', 'info');
      return;
    }
    addMultipleSelections(reused);
    setActiveTab('betslip');
    showToast(`${reused.length} sélection(s) ajoutée(s) au ticket.`, 'success');
  };

  const handleConfirmBet = async () => {
    if (!user) {
      showToast('Veuillez vous connecter pour placer un pari.', 'info');
      setMobileOpen(false);
      onNavigate('login');
      return;
    }
    if (user.role === 'admin') {
      showToast('Les administrateurs ne peuvent pas placer de paris.', 'error');
      return;
    }
    if (selections.length === 0) {
      showToast('Sélectionnez au moins un choix de match.', 'error');
      return;
    }
    if (stake < 5) {
      showToast('La mise minimum est de 5.00 DT.', 'error');
      return;
    }
    if (invalidSystemCount) {
      showToast('Les paris Système nécessitent entre 3 et 10 matchs différents.', 'error');
      return;
    }
    if (insufficientBalance) {
      showToast('Solde insuffisant. Rechargez votre compte via Tickets ou D17.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `slip-${user.id}-${slipMode}-${Date.now()}-${selections
        .map((s) => s.marketId)
        .join('-')}`;

      const res = await apiFetch<{
        references?: string[];
        bet?: { reference: string; virtualStake: number; potentialVirtualWinnings: number };
        comboCount?: number;
        systemLabel?: string;
        totalStake?: number;
        totalPotentialWinnings?: number;
        updatedBalance?: number;
      }>('/api/bets', {
        method: 'POST',
        body: JSON.stringify({
          stake,
          marketIds: selections.map((s) => s.marketId),
          mode: slipMode,
          systemSize,
          idempotencyKey,
        }),
      });

      if (typeof res.updatedBalance === 'number') {
        updateLocalBalance(res.updatedBalance);
      } else {
        await refreshProfile();
      }

      const refs = res.references?.length
        ? res.references
        : res.bet
        ? [res.bet.reference]
        : ['SZ-CONFIRMED'];

      setLastReceipt({
        references: refs,
        mode: slipMode,
        systemLabel: res.systemLabel,
        comboCount: res.comboCount ?? refs.length,
        totalStake: res.totalStake ?? totalStake,
        potentialWinnings: res.totalPotentialWinnings ?? potentialWinnings,
      });

      showToast(
        refs.length > 1
          ? `${refs.length} tickets ${slipMode} confirmés !`
          : `Ticket confirmé (${refs[0]})`,
        'success'
      );
      loadMyBets();
      if (onBetPlaced) onBetPlaced();
    } catch (err: any) {
      showToast(err?.message || 'Échec du placement du pari.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const legsNeededFor10 = Math.max(0, 4 - qualifyingLegs);
  const systemOptions =
    matchGroups.length >= 3
      ? Array.from({ length: matchGroups.length - 2 }, (_, i) => i + 2)
      : [];

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Crisp Cobalt Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a58ca] text-white">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('betslip')}
            className={`flex items-center gap-1.5 font-heading text-xs font-extrabold tracking-wide uppercase transition-opacity ${
              activeTab === 'betslip' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <span>TICKET</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#0a58ca] font-mono-tabular text-[11px] font-extrabold">
              {selections.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mybets')}
            className={`inline-flex items-center gap-1.5 font-heading text-xs font-extrabold tracking-wide uppercase transition-opacity ${
              activeTab === 'mybets'
                ? 'opacity-100 underline underline-offset-4'
                : 'opacity-75 hover:opacity-100'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-300" />
            <span>MES PARIS</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-lg hover:bg-white/15"
          aria-label="Fermer le ticket"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {user?.role === 'admin' ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0a58ca]">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-heading text-sm font-extrabold uppercase text-slate-900">
              Mode Administrateur
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-[260px]">
              Les administrateurs ne placent pas de paris. Validez les recharges (Tickets / D17) et échangez avec les joueurs en temps réel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('admin');
            }}
            className="w-full h-11 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-heading font-extrabold text-xs uppercase tracking-wide transition-colors"
          >
            Ouvrir la Console Admin
          </button>
        </div>
      ) : activeTab === 'betslip' ? (
        <>
          {/* Simple / Combiné / Système Tabs */}
          <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-heading font-bold">
            {(
              [
                { id: 'single', label: 'Simple' },
                { id: 'multiple', label: 'Combiné' },
                { id: 'system', label: 'Système' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSlipMode(mode.id)}
                className={`py-2.5 transition-colors border-b-2 -mb-px ${
                  slipMode === mode.id
                    ? 'border-[#0a58ca] text-[#0a58ca] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Real-Time Selections List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#f8fafc]">
            {lastReceipt && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    {lastReceipt.comboCount > 1
                      ? `${lastReceipt.comboCount} Tickets Confirmés`
                      : 'Ticket Confirmé'}
                  </span>
                  <button
                    type="button"
                    onClick={clearSlip}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Nouveau
                  </button>
                </div>
                <div className="text-[11px] font-mono-tabular space-y-0.5 text-slate-700">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Réf :</span>
                    <span className="text-slate-900 font-bold truncate">
                      {lastReceipt.references[0]}
                      {lastReceipt.references.length > 1
                        ? ` (+${lastReceipt.references.length - 1})`
                        : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mise totale :</span>
                    <span className="text-slate-900 font-semibold">
                      {lastReceipt.totalStake.toFixed(2)} DT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gain max :</span>
                    <span className="text-emerald-700 font-extrabold">
                      {lastReceipt.potentialWinnings.toFixed(2)} DT
                    </span>
                  </div>
                </div>
              </div>
            )}

            {matchGroups.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <p className="font-heading text-sm font-bold text-slate-800">
                  Votre ticket est vide
                </p>
                <p className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                  Cliquez sur n&apos;importe quelle cote ou ouvrez{' '}
                  <strong className="text-[#0a58ca]">Bet Builder</strong> sur un match pour construire votre pari en temps réel.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {matchGroups.map((group) => {
                    const liveMatch = matchById.get(group.matchId);
                    const dateStr = formatShortDate(liveMatch?.startTime || group.startTime);

                    if (group.isBetBuilder) {
                      return (
                        <div
                          key={group.matchId}
                          className="rounded-xl border border-blue-200 bg-white p-3.5 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded bg-[#0a58ca] px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase">
                                  Bet Builder · {group.selections.length}
                                </span>
                                {liveMatch?.status === 'live' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular font-bold text-[#dc2626]">
                                    <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                      LIVE
                                    </span>
                                    <span>{liveMatch.matchTimer}</span>
                                  </span>
                                )}
                              </div>
                              <p className="font-heading text-xs font-bold text-slate-900 leading-snug">
                                {formatMatchupWithScore(group.matchLabel, liveMatch)}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono-tabular">{dateStr}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => clearMatchSelections(group.matchId)}
                              className="text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                              aria-label={`Supprimer Bet Builder ${group.matchLabel}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="divide-y divide-slate-100 rounded-lg bg-slate-50 border border-slate-200">
                            {group.selections.map((sel) => {
                              const liveMkt = liveMatch?.markets.find((mk) => mk.id === sel.marketId);
                              const currentOdd = liveMkt ? liveMkt.simulatedOdds : sel.simulatedOdds;
                              return (
                                <div
                                  key={sel.marketId}
                                  className="px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">
                                      {sel.selectionName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate">
                                      {sel.marketType}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono-tabular text-xs text-slate-900 font-bold">
                                      {currentOdd.toFixed(2)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeSelection(sel.marketId)}
                                      className="text-slate-400 hover:text-rose-600"
                                      aria-label={`Retirer ${sel.selectionName}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Combinaison logique
                            </span>
                            <span className="font-mono-tabular font-extrabold text-[#0a58ca]">
                              {group.groupOdds.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const sel = group.selections[0];
                    const liveMkt = liveMatch?.markets.find((mk) => mk.id === sel.marketId);
                    const currentOdd = liveMkt ? liveMkt.simulatedOdds : sel.simulatedOdds;
                    const isLive = liveMatch ? liveMatch.status === 'live' : sel.status === 'live';

                    return (
                      <div
                        key={sel.marketId}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-heading text-sm font-bold text-slate-900 leading-snug">
                            {sel.selectionName}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono-tabular text-sm font-extrabold text-slate-900">
                              {currentOdd.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSelection(sel.marketId)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                              aria-label={`Retirer ${sel.matchLabel}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500">{sel.marketType}</p>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {formatMatchupWithScore(sel.matchLabel, liveMatch)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono-tabular shrink-0">
                            {dateStr}
                          </span>
                        </div>

                        {isLive && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase">
                              LIVE
                            </span>
                            <span className="font-mono-tabular text-xs font-bold text-[#dc2626]">
                              {liveMatch?.matchTimer || 'En cours'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* System Combination Selector */}
                {slipMode === 'system' && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-heading font-bold text-[#0a58ca]">
                        <Layers className="w-3.5 h-3.5" />
                        Type Système
                      </span>
                      {matchGroups.length >= 3 && (
                        <span className="font-mono-tabular text-slate-500">
                          {systemSize}/{matchGroups.length} ({comboCount} combos)
                        </span>
                      )}
                    </div>

                    {matchGroups.length < 3 ? (
                      <p className="text-[11px] text-slate-500">
                        Ajoutez au moins <strong>3 matchs</strong> pour activer un pari Système (2/3, 2/4, 3/4...).
                      </p>
                    ) : matchGroups.length > 10 ? (
                      <p className="text-[11px] text-rose-600 font-semibold">
                        Maximum 10 matchs autorisés pour les paris Système.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {systemOptions.map((k) => {
                          const count = nCr(matchGroups.length, k);
                          const active = systemSize === k;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setSystemSize(k)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular font-bold transition-colors ${
                                active
                                  ? 'bg-[#0a58ca] text-white'
                                  : 'bg-slate-100 border border-slate-200 text-slate-700 hover:border-[#0a58ca]'
                              }`}
                            >
                              {k}/{matchGroups.length} ({count}×)
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Combo Boost Info Box */}
                {slipMode === 'multiple' && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-2 text-xs text-emerald-800">
                    <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">
                      {matchGroups.length < 3 || legsNeededFor10 > 0
                        ? `Ajoutez ${Math.max(1, legsNeededFor10)} match(s) avec cote ≥ 1.20 pour +10% de bonus`
                        : 'Bonus +10% gains supplémentaires actif sur votre combiné !'}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={clearSlip}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 py-2 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <span>Tout effacer</span>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Stake & Confirmation */}
          <div className="border-t border-slate-200 bg-white p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="font-heading text-xs font-bold text-slate-800">
                {matchGroups.length === 1 && matchGroups[0].isBetBuilder
                  ? 'Bet Builder'
                  : slipMode === 'multiple'
                  ? 'Combiné'
                  : slipMode === 'system'
                  ? `Système ${matchGroups.length >= 3 ? `${systemSize}/${matchGroups.length}` : ''}`
                  : 'Simple'}
              </span>
              <div className="flex items-center gap-2">
                {boostPercent > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-mono-tabular text-xs font-bold">
                    <Gift className="w-3.5 h-3.5" />
                    +{boostPercent}%
                  </span>
                )}
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {comboCount > 1 ? `${comboCount} ×` : '1 ×'}
                </span>
                <input
                  id="slip-stake-input"
                  type="number"
                  min={5}
                  max={100000}
                  step={1}
                  value={stake || ''}
                  onChange={(e) => setStake(Number(e.target.value))}
                  aria-label="Mise en DT"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-xs font-mono-tabular font-bold text-slate-900 focus:outline-none focus:border-[#0a58ca] focus:ring-2 focus:ring-[#0a58ca]/15"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_STAKES.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStake(amt)}
                  className={`rounded-lg border py-1.5 text-[11px] font-mono-tabular font-bold transition-colors ${
                    stake === amt
                      ? 'border-[#0a58ca] bg-blue-50 text-[#0a58ca]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {amt} DT
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-xs">
              {(slipMode === 'multiple' || matchGroups.length === 1) && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Cote totale</span>
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {combinedOdds > 0 ? combinedOdds.toFixed(2) : '0.00'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-600 pb-1.5 border-b border-slate-200">
                <span>Mise totale (min 5 DT)</span>
                <span className="font-mono-tabular font-bold text-slate-900">
                  {totalStake.toFixed(2)} DT
                </span>
              </div>
              {extraWinnings > 0 && (
                <div className="flex items-center justify-between text-emerald-700 pt-0.5">
                  <span>Bonus combiné</span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular font-bold">
                    <Gift className="w-3.5 h-3.5" />
                    +{extraWinnings.toFixed(2)} DT
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between font-heading font-bold text-slate-900 pt-0.5">
                <span>{comboCount > 1 ? 'Gain Max Total' : 'Gain Potentiel'}</span>
                <span className="font-mono-tabular font-extrabold text-emerald-600 text-sm">
                  {potentialWinnings.toFixed(2)} DT
                </span>
              </div>
            </div>

            {stake > 0 && stake < 5 && (
              <p className="text-[11px] text-amber-700 font-semibold">
                Mise minimum requise : 5.00 DT
              </p>
            )}

            {insufficientBalance && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] text-rose-700 font-medium">
                  Solde : {user?.virtualBalance.toFixed(2)} DT (requis {totalStake.toFixed(2)} DT)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onNavigate('recharge');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold px-2.5 py-1 text-[11px] shrink-0"
                >
                  <Wallet className="w-3 h-3" />
                  <span>Recharger</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('history')}
                title="Voir tous mes paris"
                className="w-11 h-11 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={
                  submitting ||
                  selections.length === 0 ||
                  stake < 5 ||
                  invalidSystemCount ||
                  insufficientBalance
                }
                onClick={handleConfirmBet}
                className="flex-1 h-11 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:bg-slate-200 disabled:text-slate-400 text-white font-heading font-extrabold tracking-wide uppercase px-4 text-xs sm:text-sm transition-colors shadow-xs"
              >
                {submitting
                  ? 'Validation...'
                  : user
                  ? `Valider le Pari`
                  : 'Connexion pour Parier'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAcceptOddsChange(!acceptOddsChange)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Accepter les variations de cotes</span>
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  acceptOddsChange
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {acceptOddsChange ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </>
      ) : (
        /* REAL-TIME MY BETS TAB matching Reference Screenshot 4 (b7a43b21) in Light Theme */
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8fafc]">
          {!user ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs text-slate-600">
                Connectez-vous pour suivre vos paris et scores en temps réel.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onNavigate('login');
                }}
                className="rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold px-5 py-2.5 text-xs"
              >
                Connexion
              </button>
            </div>
          ) : myBets.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              Aucun ticket placé pour le moment.
            </p>
          ) : (
            myBets.map((bet) => {
              const isWon = bet.status === 'won';
              const isLost = bet.status === 'lost';
              return (
                <div
                  key={bet.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                >
                  {/* Ticket Status Header */}
                  <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
                    <span className="font-mono-tabular font-bold text-slate-800">
                      {bet.reference}
                    </span>
                    <span
                      className={`font-extrabold uppercase text-[11px] px-2 py-0.5 rounded ${
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

                  {/* Stacked Live Leg Cards (Reference Screenshot 4 anatomy) */}
                  <div className="divide-y divide-slate-100">
                    {bet.selections.map((s) => {
                      const liveMatch = matchById.get(s.matchId);
                      const isMatchLive = liveMatch?.status === 'live';
                      const dtStr = formatShortDate(liveMatch?.startTime || bet.createdAt);

                      return (
                        <div key={s.id} className="p-3.5 space-y-1.5">
                          {/* Row 1: Selection Name + Right-aligned Odds */}
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`font-heading text-sm font-bold leading-snug ${
                                isWon ? 'text-emerald-600' : 'text-slate-900'
                              }`}
                            >
                              {s.selectionName}
                            </span>
                            <span className="font-mono-tabular text-sm font-extrabold text-slate-900 shrink-0">
                              {s.simulatedOdds.toFixed(2)}
                            </span>
                          </div>

                          {/* Row 2: Market Type */}
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{s.marketType}</span>
                            {isWon && (
                              <span className="rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-emerald-700 leading-none">
                                EP
                              </span>
                            )}
                          </div>

                          {/* Row 3: Live Matchup + Inline Score + Date/Time */}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[13px] font-semibold text-slate-900 leading-snug">
                              {formatMatchupWithScore(s.matchLabel, liveMatch)}
                            </span>
                            <span className="text-[11px] font-mono-tabular text-slate-500 shrink-0">
                              {dtStr}
                            </span>
                          </div>

                          {/* Row 4: Live Clock or Early Payout */}
                          {isMatchLive && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase">
                                LIVE
                              </span>
                              <span className="font-mono-tabular text-xs font-bold text-slate-800">
                                {liveMatch.matchTimer}
                              </span>
                            </div>
                          )}

                          {isWon && !isMatchLive && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="rounded bg-[#059669] px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase">
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

                  {/* Re use selections + Total Odds Footer */}
                  <div className="p-3 bg-slate-50/70 border-t border-slate-100 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleReuseSelections(bet)}
                      className="w-full rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold py-2 text-xs transition-colors"
                    >
                      Réutiliser les sélections
                    </button>

                    <div className="space-y-1 text-xs font-mono-tabular">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Cote totale</span>
                        <span className="font-bold text-slate-900">
                          {bet.combinedOdds.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Mise : {bet.virtualStake.toFixed(2)} DT</span>
                        <span className="font-extrabold text-emerald-600">
                          Gain : {bet.potentialVirtualWinnings.toFixed(2)} DT
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {user && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onNavigate('history');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Historique complet des paris</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
