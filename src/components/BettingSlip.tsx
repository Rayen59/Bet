import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Gift,
  Layers,
  Minus,
  RotateCcw,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSlip } from '../context/SlipContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { AppRoute, VirtualBetItem } from '../types/sportzone';

interface BettingSlipProps {
  onNavigate: (route: AppRoute) => void;
  onBetPlaced?: () => void;
}

const QUICK_STAKES = [1, 5, 10, 50];

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

export function BettingSlip({ onNavigate, onBetPlaced }: BettingSlipProps) {
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

  const insufficientBalance = Boolean(user && totalStake > user.virtualBalance);
  const invalidSystemCount =
    slipMode === 'system' && (matchGroups.length < 3 || matchGroups.length > 10);

  useEffect(() => {
    if (activeTab === 'mybets' && user) {
      apiFetch<{ bets: VirtualBetItem[] }>('/api/bets/history')
        .then((res) => setMyBets(res.bets.slice(0, 8)))
        .catch(() => {});
    }
  }, [activeTab, user]);

  const handleConfirmBet = async () => {
    if (!user) {
      showToast('Please sign in to place a virtual bet.', 'info');
      setMobileOpen(false);
      onNavigate('login');
      return;
    }
    if (selections.length === 0) {
      showToast('Select at least one match outcome first.', 'error');
      return;
    }
    if (stake < 0.2) {
      showToast('Minimum stake per bet is 0.20 DT.', 'error');
      return;
    }
    if (invalidSystemCount) {
      showToast('System bets require between 3 and 10 different matches.', 'error');
      return;
    }
    if (insufficientBalance) {
      showToast('Insufficient DT balance. Ask the administrator to credit your account.', 'error');
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
          ? `${refs.length} ${slipMode} tickets confirmed!`
          : `Ticket confirmed (${refs[0]})`,
        'success'
      );
      if (onBetPlaced) onBetPlaced();
    } catch (err: any) {
      showToast(err?.message || 'Failed to place virtual bet.', 'error');
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
    <div className="flex flex-col h-full bg-[#1a1a1d] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Gold Top Header matching screenshot 3151fa11 */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#f5b800] text-[#111111]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('betslip')}
            className={`flex items-center gap-1.5 font-heading text-xs font-extrabold tracking-wide uppercase transition-opacity ${
              activeTab === 'betslip' ? 'opacity-100' : 'opacity-65 hover:opacity-100'
            }`}
          >
            <span>BETSLIP</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111111] text-[#f5b800] font-mono-tabular text-[11px]">
              {selections.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mybets')}
            className={`font-heading text-xs font-extrabold tracking-wide uppercase transition-opacity ${
              activeTab === 'mybets' ? 'opacity-100 underline underline-offset-4' : 'opacity-65 hover:opacity-100'
            }`}
          >
            MY BETS
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded hover:bg-black/10"
          aria-label="Minimize betslip"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'betslip' ? (
        <>
          {/* Single / Multiple / System Mode Tabs */}
          <div className="grid grid-cols-3 border-b border-zinc-800 bg-[#141416] text-xs font-heading font-bold">
            {(['single', 'multiple', 'system'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSlipMode(mode)}
                className={`py-2.5 capitalize transition-colors border-b-2 ${
                  slipMode === mode
                    ? 'border-[#f5b800] text-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Selections List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {lastReceipt && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {lastReceipt.comboCount > 1
                      ? `${lastReceipt.comboCount} Tickets Confirmed (${lastReceipt.mode.toUpperCase()})`
                      : 'Ticket Confirmed'}
                  </span>
                  <button
                    type="button"
                    onClick={clearSlip}
                    className="text-[11px] text-zinc-400 hover:text-white"
                  >
                    New Ticket
                  </button>
                </div>
                <div className="text-[11px] font-mono-tabular space-y-0.5 text-zinc-300">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">Ref:</span>
                    <span className="text-white font-semibold truncate">
                      {lastReceipt.references[0]}
                      {lastReceipt.references.length > 1
                        ? ` (+${lastReceipt.references.length - 1})`
                        : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Stake:</span>
                    <span className="text-zinc-100">{lastReceipt.totalStake.toFixed(2)} DT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Max Win:</span>
                    <span className="text-emerald-400 font-bold">
                      {lastReceipt.potentialWinnings.toFixed(2)} DT
                    </span>
                  </div>
                </div>
              </div>
            )}

            {matchGroups.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="font-heading text-sm font-bold text-zinc-200">Your betslip is empty</p>
                <p className="text-xs text-zinc-400 max-w-[230px] mx-auto leading-relaxed">
                  Click any odds or tap <strong className="text-[#f5b800]">BB</strong> on a match to build a Bet Builder or multi-match slip.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {matchGroups.map((group) => {
                    const dt = new Date(group.startTime);
                    const dateStr = `${String(dt.getDate()).padStart(2, '0')}/${String(
                      dt.getMonth() + 1
                    ).padStart(2, '0')}/${dt.getFullYear()} • ${String(dt.getHours()).padStart(
                      2,
                      '0'
                    )}:${String(dt.getMinutes()).padStart(2, '0')}`;

                    if (group.isBetBuilder) {
                      return (
                        <div
                          key={group.matchId}
                          className="rounded-lg border border-[#f5b800]/55 bg-[#1b1912] p-2.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="inline-flex items-center gap-1 rounded bg-[#f5b800] px-1.5 py-0.5 text-[10px] font-extrabold text-[#111111] uppercase">
                                BB · {group.selections.length} Picks
                              </span>
                              <p className="font-heading text-xs font-bold text-white leading-snug mt-1 truncate">
                                {group.matchLabel}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-mono-tabular">{dateStr}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => clearMatchSelections(group.matchId)}
                              className="text-zinc-400 hover:text-rose-400 transition-colors shrink-0"
                              aria-label={`Remove Bet Builder for ${group.matchLabel}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="divide-y divide-zinc-800 rounded bg-[#141416] border border-zinc-800">
                            {group.selections.map((sel) => (
                              <div
                                key={sel.marketId}
                                className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="text-[11px] text-zinc-400 truncate">{sel.marketType}</p>
                                  <p className="font-semibold text-white truncate">{sel.selectionName}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono-tabular text-xs text-zinc-200 font-semibold">
                                    {sel.simulatedOdds.toFixed(2)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeSelection(sel.marketId)}
                                    className="text-zinc-500 hover:text-rose-400"
                                    aria-label={`Remove ${sel.selectionName}`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Logical combination
                            </span>
                            <span className="font-mono-tabular font-extrabold text-[#f5b800]">
                              {group.groupOdds.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const sel = group.selections[0];
                    return (
                      <div
                        key={sel.marketId}
                        className="rounded-lg border border-zinc-800 bg-[#141416] p-2.5 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-heading text-xs font-bold text-white leading-snug">
                            {sel.matchLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelection(sel.marketId)}
                            className="text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                            aria-label={`Remove ${sel.matchLabel}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-mono-tabular">{dateStr}</p>
                        <p className="text-[11px] text-zinc-400">{sel.marketType}</p>
                        <div className="flex items-center justify-between pt-0.5">
                          <div className="flex items-center gap-1.5">
                            {sel.status === 'live' && (
                              <span className="rounded bg-[#e11d2e] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                                LIVE
                              </span>
                            )}
                            <span className="text-xs font-semibold text-white">
                              {sel.selectionName}
                            </span>
                          </div>
                          <span className="font-mono-tabular text-xs font-bold text-white">
                            {sel.simulatedOdds.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* System Combination Selector */}
                {slipMode === 'system' && (
                  <div className="rounded-lg border border-zinc-800 bg-[#141416] p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-heading font-bold text-[#f5b800]">
                        <Layers className="w-3.5 h-3.5" />
                        System Type
                      </span>
                      {matchGroups.length >= 3 && (
                        <span className="font-mono-tabular text-zinc-400">
                          {systemSize}/{matchGroups.length} ({comboCount} combos)
                        </span>
                      )}
                    </div>

                    {matchGroups.length < 3 ? (
                      <p className="text-[11px] text-zinc-400">
                        Add at least <strong>3 matches</strong> to activate a System bet (2/3, 2/4, 3/4...).
                      </p>
                    ) : matchGroups.length > 10 ? (
                      <p className="text-[11px] text-rose-400">
                        Maximum 10 matches allowed for System bets.
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
                              className={`px-2.5 py-1 rounded text-xs font-mono-tabular font-bold transition-colors ${
                                active
                                  ? 'bg-[#f5b800] text-[#111111]'
                                  : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-[#f5b800]'
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

                {/* Green Combo Boost Box matching 3151fa11 */}
                {slipMode === 'multiple' && (
                  <div className="rounded-lg border border-[#16a34a]/70 bg-[#052e16]/50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-400">
                    <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {matchGroups.length < 3 || legsNeededFor10 > 0
                        ? `Add ${Math.max(1, legsNeededFor10)} event(s) with odds of 1.20 or higher to increase your winnings by 10%`
                        : '10% Extra Winnings boost active on your combo!'}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={clearSlip}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-zinc-600 bg-[#27272a] hover:bg-zinc-700 py-2 text-xs font-semibold text-white transition-colors"
                >
                  <span>Clear all</span>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Stake & Confirmation matching 3151fa11 */}
          <div className="border-t border-zinc-800 bg-[#141416] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#1f1f23] px-3 py-2">
              <span className="font-heading text-xs font-bold text-white capitalize">
                {matchGroups.length === 1 && matchGroups[0].isBetBuilder
                  ? 'Bet Builder'
                  : slipMode === 'multiple'
                  ? 'Combo'
                  : slipMode === 'system'
                  ? `System ${matchGroups.length >= 3 ? `${systemSize}/${matchGroups.length}` : ''}`
                  : 'Single'}
              </span>
              <div className="flex items-center gap-2">
                {boostPercent > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-mono-tabular text-xs font-bold">
                    <Gift className="w-3.5 h-3.5" />
                    {boostPercent}%
                  </span>
                )}
                <span className="text-xs text-zinc-400 font-mono-tabular">
                  {comboCount > 1 ? `${comboCount} ×` : '1 ×'}
                </span>
                <input
                  id="slip-stake-input"
                  type="number"
                  min={0.2}
                  max={100000}
                  step={0.5}
                  value={stake || ''}
                  onChange={(e) => setStake(Number(e.target.value))}
                  aria-label="Stake amount in DT"
                  className="w-24 rounded-md bg-white px-2.5 py-1.5 text-right text-xs font-mono-tabular font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f5b800]"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_STAKES.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStake(amt)}
                  className={`rounded-md border py-1 text-[11px] font-mono-tabular font-semibold transition-colors ${
                    stake === amt
                      ? 'border-[#f5b800] bg-[#f5b800]/15 text-[#f5b800]'
                      : 'border-zinc-800 bg-[#1c1c20] text-zinc-300 hover:text-white'
                  }`}
                >
                  {amt} DT
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-[#1c1c20] p-2.5 space-y-1 text-xs">
              {(slipMode === 'multiple' || matchGroups.length === 1) && (
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Total odds</span>
                  <span className="font-mono-tabular font-bold text-white">
                    {combinedOdds > 0 ? combinedOdds.toFixed(2) : '0.00'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-zinc-300 pb-1 border-b border-zinc-700/60">
                <span>Total stake</span>
                <span className="font-mono-tabular font-bold text-white">
                  DT {totalStake.toFixed(2)}
                </span>
              </div>
              {extraWinnings > 0 && (
                <div className="flex items-center justify-between text-zinc-300 pt-0.5">
                  <span>Extra Winnings</span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular font-bold text-emerald-400">
                    <Gift className="w-3.5 h-3.5" />
                    DT {extraWinnings.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between font-heading font-bold text-white pt-0.5">
                <span>{comboCount > 1 ? 'Max Total Win' : 'Total Win'}</span>
                <span className="font-mono-tabular font-extrabold text-white">
                  DT {potentialWinnings.toFixed(2)}
                </span>
              </div>
            </div>

            {insufficientBalance && (
              <p className="text-[11px] text-rose-400 font-medium">
                Balance is {user?.virtualBalance.toFixed(2)} DT (need {totalStake.toFixed(2)} DT).
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('history')}
                title="View Saved Bets"
                className="w-11 h-11 rounded-lg border border-zinc-600 bg-[#1c1c20] hover:border-[#f5b800] text-white flex items-center justify-center shrink-0"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={
                  submitting ||
                  selections.length === 0 ||
                  stake < 0.2 ||
                  invalidSystemCount ||
                  insufficientBalance
                }
                onClick={handleConfirmBet}
                className="flex-1 h-11 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#111111] font-heading font-extrabold tracking-wide uppercase px-4 text-xs sm:text-sm transition-colors"
              >
                {submitting
                  ? 'Placing Ticket...'
                  : user
                  ? `Place ${
                      slipMode === 'single' && matchGroups.length > 1
                        ? `${matchGroups.length} Singles`
                        : slipMode === 'system'
                        ? 'System Bet'
                        : matchGroups.length === 1 && matchGroups[0].isBetBuilder
                        ? 'Bet Builder'
                        : 'Bet'
                    }`
                  : 'Sign In to Bet'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAcceptOddsChange(!acceptOddsChange)}
              className="w-full rounded-lg border border-zinc-700 bg-[#1a1a1d] px-3 py-2 flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                <span>Accept any odds change</span>
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  acceptOddsChange
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {acceptOddsChange ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </>
      ) : (
        /* MY BETS Tab inside Slip */
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {!user ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs text-zinc-400">Sign in to view your active and settled tickets.</p>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onNavigate('login');
                }}
                className="rounded-lg bg-[#f5b800] text-[#111111] font-bold px-4 py-2 text-xs"
              >
                Sign In
              </button>
            </div>
          ) : myBets.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-500">No tickets placed yet.</p>
          ) : (
            myBets.map((bet) => (
              <div
                key={bet.id}
                className="rounded-lg border border-zinc-800 bg-[#141416] p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between font-mono-tabular">
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
                <div className="space-y-1 text-[11px] text-zinc-300">
                  {bet.selections.map((s) => (
                    <div key={s.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {s.matchLabel} · <strong className="text-white">{s.selectionName}</strong>
                      </span>
                      <span className="font-mono-tabular text-zinc-300">{s.simulatedOdds.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800 font-mono-tabular text-[11px]">
                  <span className="text-zinc-400">Stake: {bet.virtualStake.toFixed(2)} DT</span>
                  <span className="text-emerald-400 font-bold">
                    Win: {bet.potentialVirtualWinnings.toFixed(2)} DT
                  </span>
                </div>
              </div>
            ))
          )}
          {user && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onNavigate('history');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-[#222226] py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Full Betting History</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
