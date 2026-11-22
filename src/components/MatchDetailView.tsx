import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  Layers,
  MapPin,
  Receipt,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { computeGroupOdds } from '../lib/betBuilder';
import { useSlip } from '../context/SlipContext';
import { MarketItem, MatchCenterData, MatchItem } from '../types/sportzone';
import { TeamBadge } from './BrandLogo';

interface MatchDetailViewProps {
  matchId: number;
  onBack: () => void;
}

type CenterTab = 'markets' | 'stats' | 'form' | 'lineups';
type MarketFilter = 'all' | 'goals' | 'cards' | 'halves';

export function MatchDetailView({ matchId, onBack }: MatchDetailViewProps) {
  const [match, setMatch] = useState<MatchItem | null>(null);
  const [matchCenter, setMatchCenter] = useState<MatchCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCenter, setLoadingCenter] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CenterTab>('markets');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');
  const [hideIllogical, setHideIllogical] = useState(true);

  const {
    toggleSelection,
    removeSelection,
    clearMatchSelections,
    getMatchSelections,
    getMarketCompatibility,
    lastAutoCleaned,
    setMobileOpen,
  } = useSlip();

  useEffect(() => {
    let active = true;
    const fetchDetailAndCenter = (initial: boolean) => {
      if (initial) {
        setLoading(true);
        setLoadingCenter(true);
        setError(null);
        setMatchCenter(null);
      }

      apiFetch<{ match: MatchItem }>(`/api/matches/${matchId}`)
        .then((res) => {
          if (active) setMatch(res.match);
        })
        .catch((err) => {
          if (active && initial) setError(err?.message || 'Failed to load match details.');
        })
        .finally(() => {
          if (active && initial) setLoading(false);
        });

      apiFetch<{ matchCenter: MatchCenterData }>(`/api/matches/${matchId}/matchcenter`)
        .then((res) => {
          if (active) setMatchCenter(res.matchCenter);
        })
        .catch(() => {})
        .finally(() => {
          if (active && initial) setLoadingCenter(false);
        });
    };

    fetchDetailAndCenter(true);

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('matches_updated', () => {
        if (active) fetchDetailAndCenter(false);
      });
    } catch {
      // Fallback handled by interval
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDetailAndCenter(false);
      }
    }, 6_000);

    return () => {
      active = false;
      es?.close();
      clearInterval(interval);
    };
  }, [matchId]);

  const matchSelections = getMatchSelections(matchId);
  const betBuilderOdds = useMemo(
    () => computeGroupOdds(matchSelections),
    [matchSelections]
  );

  const { groupedMarkets, removedIllogicalCount } = useMemo(() => {
    if (!match) return { groupedMarkets: [] as Array<[string, MarketItem[]]>, removedIllogicalCount: 0 };

    const groups = new Map<string, MarketItem[]>();
    let hiddenCount = 0;

    for (const mkt of match.markets) {
      if (!mkt.active) continue;
      const mt = mkt.marketType.toLowerCase();

      if (marketFilter === 'goals') {
        if (
          !mt.includes('total') &&
          !mt.includes('1×2') &&
          !mt.includes('1x2') &&
          !mt.includes('double') &&
          !mt.includes('both teams') &&
          !mt.includes('winner')
        ) {
          continue;
        }
        if (mt.includes('card')) continue;
      } else if (marketFilter === 'cards') {
        if (!mt.includes('card') && !mt.includes('injur') && !mt.includes('foul')) continue;
      } else if (marketFilter === 'halves') {
        if (!mt.includes('half') && !mt.includes('score') && !mt.includes('set') && !mt.includes('handicap')) {
          continue;
        }
      }

      const compat = getMarketCompatibility(match.id, mkt, {
        homeName: match.homeTeam.name,
        awayName: match.awayTeam.name,
      });

      if (!compat.compatible) {
        hiddenCount++;
        if (hideIllogical) {
          continue;
        }
      }

      const list = groups.get(mkt.marketType) || [];
      list.push(mkt);
      groups.set(mkt.marketType, list);
    }

    return {
      groupedMarkets: Array.from(groups.entries()),
      removedIllogicalCount: hiddenCount,
    };
  }, [match, marketFilter, getMarketCompatibility, hideIllogical]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-2xl bg-[#13161d] border border-[#232734] animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#13161d] border border-[#232734] animate-pulse" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#1a1a1d] p-8 text-center space-y-3">
        <p className="text-sm text-rose-400">{error || 'Match not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-[#1d212b] hover:bg-[#252b38] text-sm text-white"
        >
          Back to Matches
        </button>
      </div>
    );
  }

  const isFinished = match.status === 'finished';
  const consensus = matchCenter?.consensusOdds;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-zinc-300 hover:text-[#f5b800] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Matchboard</span>
      </button>

      {/* Spacious Match Scoreboard Card */}
      <div className="rounded-2xl border border-zinc-800 bg-[#1a1a1d] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 pb-3.5 border-b border-[#222631]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-zinc-100 font-bold">{match.sportName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-zinc-300">{match.competitionName}</span>
            {match.competitionCountry && (
              <>
                <span aria-hidden="true">·</span>
                <span>{match.competitionCountry}</span>
              </>
            )}
            {matchCenter?.venue && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-zinc-400">
                  <MapPin className="w-3.5 h-3.5 text-[#f5b800]" />
                  {matchCenter.venue.name}
                  {matchCenter.venue.city ? `, ${matchCenter.venue.city}` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono-tabular">
            {match.status === 'live' ? (
              <span className="inline-flex items-center gap-2 font-bold">
                <span className="text-rose-400 uppercase">LIVE</span>
                <span className="text-white">{match.matchTimer}</span>
              </span>
            ) : (
              <span className="text-zinc-300">
                {match.status.toUpperCase()} · {new Date(match.startTime).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-4 py-3 text-center">
          <div className="flex flex-col items-center gap-3">
            <TeamBadge shortName={match.homeTeam.shortName} color={match.homeTeam.logo} size="lg" />
            <span className="font-display text-lg sm:text-2xl font-extrabold text-white tracking-wide leading-tight">
              {match.homeTeam.name}
            </span>
            {matchCenter && matchCenter.form.home.length > 0 && (
              <div className="flex items-center gap-1">
                {matchCenter.form.home.map((g, i) => (
                  <span
                    key={i}
                    title={`${g.opponent} (${g.score})`}
                    className={`w-5 h-5 rounded text-[10px] font-mono-tabular font-bold flex items-center justify-center ${
                      g.result === 'W'
                        ? 'bg-emerald-500 text-[#0b0c0f]'
                        : g.result === 'D'
                        ? 'bg-amber-400 text-[#0b0c0f]'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {g.result}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="font-mono-tabular text-4xl sm:text-5xl font-extrabold text-[#f5b800] tracking-tight">
              {match.status === 'upcoming' ? 'vs' : `${match.homeScore} : ${match.awayScore}`}
            </div>
            <span className="text-xs text-zinc-400 font-mono-tabular">{match.matchTimer}</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <TeamBadge shortName={match.awayTeam.shortName} color={match.awayTeam.logo} size="lg" />
            <span className="font-display text-lg sm:text-2xl font-extrabold text-white tracking-wide leading-tight">
              {match.awayTeam.name}
            </span>
            {matchCenter && matchCenter.form.away.length > 0 && (
              <div className="flex items-center gap-1">
                {matchCenter.form.away.map((g, i) => (
                  <span
                    key={i}
                    title={`${g.opponent} (${g.score})`}
                    className={`w-5 h-5 rounded text-[10px] font-mono-tabular font-bold flex items-center justify-center ${
                      g.result === 'W'
                        ? 'bg-emerald-500 text-[#0b0c0f]'
                        : g.result === 'D'
                        ? 'bg-amber-400 text-[#0b0c0f]'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {g.result}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Consensus Odds Bar */}
        {consensus && (consensus.homeDecimal || consensus.overUnderLine) && (
          <div className="rounded-xl border border-[#232734] bg-[#0e1015] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-heading font-bold text-[#f5b800]">
                <TrendingUp className="w-4 h-4" />
                <span>Market Consensus · {consensus.provider}</span>
              </span>
              {consensus.overUnderLine && (
                <span className="font-mono-tabular text-zinc-300">
                  O/U Line: <strong className="text-white">{consensus.overUnderLine}</strong>{' '}
                  {consensus.overDecimal ? `(O ${consensus.overDecimal.toFixed(2)}` : ''}
                  {consensus.underDecimal ? ` / U ${consensus.underDecimal.toFixed(2)})` : ''}
                </span>
              )}
            </div>

            {consensus.homeImpliedPct !== null && consensus.awayImpliedPct !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono-tabular">
                  <span className="text-emerald-400 font-semibold">
                    {match.homeTeam.shortName} {consensus.homeImpliedPct}%
                    {consensus.homeDecimal ? ` (${consensus.homeDecimal.toFixed(2)})` : ''}
                  </span>
                  {consensus.drawImpliedPct !== null && (
                    <span className="text-zinc-300">
                      Draw {consensus.drawImpliedPct}%
                      {consensus.drawDecimal ? ` (${consensus.drawDecimal.toFixed(2)})` : ''}
                    </span>
                  )}
                  <span className="text-[#f5b800] font-semibold">
                    {match.awayTeam.shortName} {consensus.awayImpliedPct}%
                    {consensus.awayDecimal ? ` (${consensus.awayDecimal.toFixed(2)})` : ''}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-[#1c202a]">
                  <div className="bg-emerald-500" style={{ width: `${consensus.homeImpliedPct}%` }} />
                  {consensus.drawImpliedPct !== null && (
                    <div className="bg-zinc-500" style={{ width: `${consensus.drawImpliedPct}%` }} />
                  )}
                  <div className="bg-[#f5b800]" style={{ width: `${consensus.awayImpliedPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
          <Info className="w-4 h-4 text-[#f5b800] shrink-0" />
          <span>
            Bet Builder lets you combine multiple logical choices in this match. Contradictory or redundant options are filtered automatically.
          </span>
        </div>
      </div>

      {/* Match Center Section Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-[#13161d] border border-[#232734] rounded-xl">
        {(
          [
            { id: 'markets', label: `Bet Builder & Markets (${match.markets.length})`, icon: Layers },
            { id: 'stats', label: 'Stats & Timeline', icon: BarChart3 },
            { id: 'form', label: 'Form & Standings', icon: Activity },
            { id: 'lineups', label: 'Lineups & Injuries', icon: Users },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-heading text-xs font-bold transition-colors ${
                active
                  ? 'bg-[#f5b800] text-[#0b0c0f]'
                  : 'text-zinc-300 hover:text-white hover:bg-[#1b1f29]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BET BUILDER & MARKETS */}
      {activeTab === 'markets' && (
        <div className="space-y-4">
          {/* Interactive Bet Builder Control Bar */}
          <div className="rounded-2xl border border-[#f5b800]/35 bg-gradient-to-br from-[#191813] via-[#14161d] to-[#13161d] p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#f5b800]/15 border border-[#f5b800]/40 flex items-center justify-center text-[#f5b800] shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold uppercase text-white tracking-wide flex items-center gap-2">
                    <span>Bet Builder</span>
                    {matchSelections.length > 0 && (
                      <span className="font-mono-tabular text-xs font-bold text-[#f5b800]">
                        {matchSelections.length} {matchSelections.length === 1 ? 'Pick' : 'Picks'}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Select multiple compatible markets on this match — illogical choices are automatically removed.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHideIllogical((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    hideIllogical
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-[#2d3343] bg-[#1b1f29] text-zinc-300'
                  }`}
                >
                  {hideIllogical ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>
                    {hideIllogical
                      ? `Auto-Filter Illogical: ON${removedIllogicalCount > 0 ? ` (${removedIllogicalCount} removed)` : ''}`
                      : `Showing Blocked (${removedIllogicalCount})`}
                  </span>
                </button>

                {matchSelections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearMatchSelections(match.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 hover:bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Match</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Bet Builder Picks Chips */}
            {matchSelections.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-[#262934]">
                <div className="flex flex-wrap gap-2">
                  {matchSelections.map((sel) => (
                    <div
                      key={sel.marketId}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#f5b800]/50 bg-[#1f1c12] px-3 py-1.5 text-xs"
                    >
                      <span className="text-zinc-400">{sel.marketType}:</span>
                      <span className="font-bold text-white">{sel.selectionName}</span>
                      <span className="font-mono-tabular font-extrabold text-[#f5b800]">
                        {sel.simulatedOdds.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelection(sel.marketId)}
                        className="text-zinc-400 hover:text-rose-400 ml-0.5"
                        aria-label={`Remove ${sel.selectionName}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0e1015] border border-[#232734] px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {matchSelections.length > 1
                        ? 'All selected choices are logically verified together.'
                        : 'Pick another compatible market below to build a same-match combo.'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-zinc-400 mr-2">
                        {matchSelections.length > 1 ? 'Bet Builder Odds' : 'Selection Odds'}
                      </span>
                      <span className="font-mono-tabular text-base font-extrabold text-[#f5b800]">
                        {betBuilderOdds.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileOpen(true)}
                      className="lg:hidden inline-flex items-center gap-1.5 rounded-lg bg-[#f5b800] text-[#0b0c0f] font-bold px-3 py-1.5 text-xs"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Open Slip</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
                <Sparkles className="w-4 h-4 text-[#f5b800] shrink-0" />
                <span>
                  Example logical combo: <strong className="text-zinc-200">1</strong> +{' '}
                  <strong className="text-zinc-200">Over 2.5 Goals</strong> +{' '}
                  <strong className="text-zinc-200">Both Teams to Score · Yes</strong> +{' '}
                  <strong className="text-zinc-200">Cards Over 2.5</strong>.
                </span>
              </div>
            )}

            {lastAutoCleaned.length > 0 && (
              <div className="rounded-lg border border-amber-500/35 bg-amber-950/30 px-3.5 py-2 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Auto-removed illogical choice(s): <strong>{lastAutoCleaned.join(', ')}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Market Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'All Markets' },
                  { id: 'goals', label: 'Result, Goals & Team Totals' },
                  { id: 'cards', label: 'Cards & Injuries' },
                  { id: 'halves', label: 'Halves, Handicap & Score' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMarketFilter(f.id)}
                  className={`px-3.5 py-2 rounded-lg border font-heading text-xs font-bold transition-colors ${
                    marketFilter === f.id
                      ? 'border-[#f5b800] bg-[#f5b800]/15 text-[#f5b800]'
                      : 'border-zinc-800 bg-[#1a1a1d] text-zinc-300 hover:text-white hover:border-zinc-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {removedIllogicalCount > 0 && hideIllogical && (
              <span className="text-xs text-zinc-400 font-medium">
                {removedIllogicalCount} incompatible options filtered out
              </span>
            )}
          </div>

          {groupedMarkets.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-[#1a1a1d] p-8 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                No compatible markets left in this category for your current selections.
              </p>
              <button
                type="button"
                onClick={() => setMarketFilter('all')}
                className="text-xs font-semibold text-[#f5b800] hover:underline"
              >
                Switch to All Markets
              </button>
            </div>
          ) : (
            groupedMarkets.map(([marketType, items]) => (
              <div
                key={marketType}
                className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden"
              >
                <div className="px-4 sm:px-5 py-3 border-b border-zinc-800 bg-[#141416] flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#f5b800]" />
                    <span>{marketType}</span>
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {items.length} logical {items.length === 1 ? 'option' : 'options'}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {items.map((mkt) => {
                    const compat = getMarketCompatibility(match.id, mkt, {
                      homeName: match.homeTeam.name,
                      awayName: match.awayTeam.name,
                    });
                    const active = compat.status === 'selected';
                    const blocked = !compat.compatible;

                    return (
                      <button
                        key={mkt.id}
                        type="button"
                        disabled={isFinished}
                        title={blocked ? compat.reason : undefined}
                        onClick={() =>
                          toggleSelection(
                            {
                              matchId: match.id,
                              marketId: mkt.id,
                              matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                              competitionName: match.competitionName,
                              marketType: mkt.marketType,
                              selectionName: mkt.selectionName,
                              simulatedOdds: mkt.simulatedOdds,
                              status: match.status,
                              startTime: match.startTime,
                            },
                            {
                              betBuilder: true,
                              homeName: match.homeTeam.name,
                              awayName: match.awayTeam.name,
                            }
                          )
                        }
                        className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm transition-all min-h-[46px] text-left ${
                          isFinished
                            ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                            : active
                            ? 'bg-[#f5b800] text-[#111111] font-bold shadow-sm'
                            : blocked
                            ? 'bg-[#141416] border border-rose-500/35 text-zinc-500 hover:border-amber-400/60'
                            : 'bg-[#ececef] hover:bg-white text-[#111111] font-medium'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className={`block truncate text-[13px] font-semibold ${active ? 'text-[#111111]' : blocked ? 'text-zinc-400' : 'text-zinc-700'}`}>
                            {mkt.selectionName}
                          </span>
                          {blocked && (
                            <span className="block text-[10px] text-rose-400 truncate">
                              {compat.status === 'redundant' ? 'Already implied (click to replace)' : 'Conflicts (click to replace)'}
                            </span>
                          )}
                        </div>
                        <span className={`font-mono-tabular text-sm font-extrabold shrink-0 ${blocked ? 'text-zinc-400' : ''}`}>
                          {mkt.simulatedOdds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Live Boxscore Stats & Timeline Events */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {loadingCenter ? (
            <div className="h-48 rounded-xl bg-[#13161d] border border-[#232734] animate-pulse" />
          ) : (
            <>
              <div className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141416] flex items-center justify-between font-heading text-xs sm:text-sm font-bold text-white">
                  <span>{match.homeTeam.name}</span>
                  <span className="text-[#f5b800]">Match Statistics</span>
                  <span>{match.awayTeam.name}</span>
                </div>

                {!matchCenter || matchCenter.stats.length === 0 ? (
                  <p className="p-8 text-center text-xs sm:text-sm text-zinc-400">
                    Detailed live boxscore statistics appear once kickoff begins or match statistics are published.
                  </p>
                ) : (
                  <div className="p-5 space-y-4">
                    {matchCenter.stats.map((st, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-mono-tabular">
                          <span className="font-bold text-white">{st.homeValue}</span>
                          <span className="font-sans text-zinc-300 font-medium">{st.label}</span>
                          <span className="font-bold text-[#f5b800]">{st.awayValue}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#1e222d] overflow-hidden flex">
                          <div className="bg-emerald-500" style={{ width: `${st.homePct}%` }} />
                          <div className="bg-[#f5b800]" style={{ width: `${100 - st.homePct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141416] flex items-center gap-2 font-heading text-xs sm:text-sm font-bold text-white">
                  <Clock className="w-4 h-4 text-[#f5b800]" />
                  <span>Match Events & Cards Timeline</span>
                </div>

                {!matchCenter || matchCenter.timeline.length === 0 ? (
                  <p className="p-8 text-center text-xs sm:text-sm text-zinc-400">
                    No match events recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#222631]">
                    {matchCenter.timeline.map((ev, idx) => (
                      <div key={idx} className="px-5 py-3 flex items-center gap-3 text-xs sm:text-sm">
                        <span className="font-mono-tabular font-bold text-[#f5b800] w-12 shrink-0">
                          {ev.clock || '–'}
                        </span>
                        <span
                          className={`w-2.5 h-3.5 rounded-xs shrink-0 ${
                            ev.type === 'goal'
                              ? 'bg-emerald-400'
                              : ev.type === 'yellow'
                              ? 'bg-amber-400'
                              : ev.type === 'red'
                              ? 'bg-rose-600'
                              : 'bg-zinc-500'
                          }`}
                          title={ev.type}
                        />
                        <span className="text-zinc-200">{ev.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Last 5 Form & League Standings */}
      {activeTab === 'form' && (
        <div className="space-y-4">
          {loadingCenter ? (
            <div className="h-48 rounded-xl bg-[#13161d] border border-[#232734] animate-pulse" />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: match.homeTeam.name, games: matchCenter?.form.home || [] },
                  { label: match.awayTeam.name, games: matchCenter?.form.away || [] },
                ].map((side, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden"
                  >
                    <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141416] font-heading text-xs sm:text-sm font-bold text-white">
                      {side.label} · Last 5 Games
                    </div>
                    {side.games.length === 0 ? (
                      <p className="p-6 text-center text-xs text-zinc-400">
                        Recent form data unavailable for this competition.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#222631]">
                        {side.games.map((g, idx) => (
                          <div
                            key={idx}
                            className="px-5 py-3 flex items-center justify-between gap-2 text-xs sm:text-sm"
                          >
                            <div className="min-w-0">
                              <span className="text-zinc-400 mr-2">{g.homeAway}</span>
                              <span className="font-semibold text-zinc-100 truncate">
                                {g.opponent}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="font-mono-tabular text-zinc-300">{g.score}</span>
                              <span
                                className={`w-6 h-6 rounded text-[11px] font-mono-tabular font-bold flex items-center justify-center ${
                                  g.result === 'W'
                                    ? 'bg-emerald-500 text-[#0b0c0f]'
                                    : g.result === 'D'
                                    ? 'bg-amber-400 text-[#0b0c0f]'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {g.result}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141416] font-heading text-xs sm:text-sm font-bold text-white">
                  {match.competitionName} Standings
                </div>
                {!matchCenter || matchCenter.standings.length === 0 ? (
                  <p className="p-6 text-center text-xs text-zinc-400">
                    League table data unavailable for this event.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-[#222631] text-zinc-400 bg-[#101218]">
                        <tr>
                          <th className="px-4 py-2.5">#</th>
                          <th className="px-4 py-2.5">Team</th>
                          <th className="px-4 py-2.5 text-right">MP</th>
                          <th className="px-4 py-2.5 text-right">W</th>
                          <th className="px-4 py-2.5 text-right">D</th>
                          <th className="px-4 py-2.5 text-right">L</th>
                          <th className="px-4 py-2.5 text-right">GD</th>
                          <th className="px-4 py-2.5 text-right">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222631] font-mono-tabular">
                        {matchCenter.standings.map((row) => (
                          <tr
                            key={row.rank + row.team}
                            className={row.isMatchTeam ? 'bg-[#f5b800]/15 text-white font-bold' : ''}
                          >
                            <td className="px-4 py-2.5 text-zinc-400">{row.rank}</td>
                            <td className="px-4 py-2.5 font-sans">{row.team}</td>
                            <td className="px-4 py-2.5 text-right">{row.played}</td>
                            <td className="px-4 py-2.5 text-right">{row.wins}</td>
                            <td className="px-4 py-2.5 text-right">{row.draws}</td>
                            <td className="px-4 py-2.5 text-right">{row.losses}</td>
                            <td className="px-4 py-2.5 text-right">{row.gd}</td>
                            <td className="px-4 py-2.5 text-right text-[#f5b800] font-bold">
                              {row.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: Lineups & Injuries Report */}
      {activeTab === 'lineups' && (
        <div className="space-y-4">
          {loadingCenter ? (
            <div className="h-48 rounded-xl bg-[#13161d] border border-[#232734] animate-pulse" />
          ) : (
            <>
              <div className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141416] flex items-center gap-2 font-heading text-xs sm:text-sm font-bold text-[#f5b800]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Injuries & Player Availability</span>
                </div>

                {!matchCenter ||
                (matchCenter.injuries.home.length === 0 && matchCenter.injuries.away.length === 0) ? (
                  <p className="p-6 text-center text-xs text-zinc-400">
                    No official pre-match injuries reported in the live feed for this fixture.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#222631]">
                    {[
                      { team: match.homeTeam.name, list: matchCenter.injuries.home },
                      { team: match.awayTeam.name, list: matchCenter.injuries.away },
                    ].map((side, idx) => (
                      <div key={idx} className="p-4 space-y-2.5">
                        <h4 className="font-heading text-sm font-bold text-white">{side.team}</h4>
                        {side.list.length === 0 ? (
                          <p className="text-xs text-zinc-500">No reported absences.</p>
                        ) : (
                          side.list.map((inj, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 rounded-lg bg-[#0e1015] border border-[#222631] px-3.5 py-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">
                                  {inj.player}{' '}
                                  {inj.position && (
                                    <span className="text-zinc-400">({inj.position})</span>
                                  )}
                                </p>
                                <p className="text-[11px] text-zinc-400 truncate">{inj.detail}</p>
                              </div>
                              <span className="rounded bg-rose-500/20 text-rose-400 px-2 py-0.5 text-[10px] font-bold uppercase shrink-0">
                                {inj.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { team: match.homeTeam.name, players: matchCenter?.lineups.home || [] },
                  { team: match.awayTeam.name, players: matchCenter?.lineups.away || [] },
                ].map((side, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-[#1a1a1d] overflow-hidden"
                  >
                    <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141416] font-heading text-xs sm:text-sm font-bold text-white">
                      {side.team} · Lineup & Squad
                    </div>
                    {side.players.length === 0 ? (
                      <p className="p-6 text-center text-xs text-zinc-400">
                        Lineups are typically published 45–60 minutes before kickoff.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#222631] max-h-80 overflow-y-auto">
                        {side.players.map((p, i) => (
                          <div
                            key={i}
                            className="px-5 py-2.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono-tabular text-zinc-400 w-5">
                                {p.jersey || '–'}
                              </span>
                              <span className="font-medium text-zinc-100 truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-zinc-400">{p.position}</span>
                              {p.starter && (
                                <span className="text-[10px] font-bold text-emerald-400">XI</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
