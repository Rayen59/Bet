import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  Info,
  MapPin,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
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
  const { toggleSelection, isSelected } = useSlip();

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
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDetailAndCenter(false);
      }
    }, 10_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [matchId]);

  const groupedMarkets = useMemo(() => {
    if (!match) return [];
    const groups = new Map<string, MarketItem[]>();
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

      const list = groups.get(mkt.marketType) || [];
      list.push(mkt);
      groups.set(mkt.marketType, list);
    }
    return Array.from(groups.entries());
  }, [match, marketFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-44 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
        <div className="h-64 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-8 text-center space-y-3">
        <p className="text-sm text-rose-400">{error || 'Match not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-white"
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
        className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-zinc-400 hover:text-[#f5b800] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Matches</span>
      </button>

      {/* FlashScore / SofaScore Style Scoreboard Header Card */}
      <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 pb-3.5 border-b border-zinc-800">
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
                  <MapPin className="w-3 h-3 text-[#f5b800]" />
                  {matchCenter.venue.name}
                  {matchCenter.venue.city ? `, ${matchCenter.venue.city}` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono-tabular">
            {match.status === 'live' ? (
              <span className="inline-flex items-center gap-2">
                <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  LIVE
                </span>
                <span className="text-white font-semibold">{match.matchTimer}</span>
              </span>
            ) : (
              <span>
                {match.status.toUpperCase()} · {new Date(match.startTime).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-4 py-3 text-center">
          <div className="flex flex-col items-center gap-2.5">
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
                        ? 'bg-emerald-500 text-[#111111]'
                        : g.result === 'D'
                        ? 'bg-amber-400 text-[#111111]'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {g.result}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-1">
            <div className="font-mono-tabular text-4xl sm:text-5xl font-extrabold text-[#f5b800] tracking-tight">
              {match.status === 'upcoming' ? 'vs' : `${match.homeScore} : ${match.awayScore}`}
            </div>
            <span className="text-xs text-zinc-400 font-mono-tabular">{match.matchTimer}</span>
          </div>

          <div className="flex flex-col items-center gap-2.5">
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
                        ? 'bg-emerald-500 text-[#111111]'
                        : g.result === 'D'
                        ? 'bg-amber-400 text-[#111111]'
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

        {/* Pronostic / Bookmaker Market Consensus Strip */}
        {consensus && (consensus.homeDecimal || consensus.overUnderLine) && (
          <div className="rounded-lg border border-zinc-800 bg-[#121214] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-heading font-bold text-[#f5b800]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Market Consensus ({consensus.provider})</span>
              </span>
              {consensus.overUnderLine && (
                <span className="font-mono-tabular text-zinc-300">
                  O/U Line: <strong>{consensus.overUnderLine}</strong>{' '}
                  {consensus.overDecimal ? `(O ${consensus.overDecimal.toFixed(2)}` : ''}
                  {consensus.underDecimal ? ` / U ${consensus.underDecimal.toFixed(2)})` : ''}
                </span>
              )}
            </div>

            {consensus.homeImpliedPct !== null && consensus.awayImpliedPct !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono-tabular">
                  <span className="text-emerald-400 font-semibold">
                    {match.homeTeam.shortName} {consensus.homeImpliedPct}%
                    {consensus.homeDecimal ? ` (${consensus.homeDecimal.toFixed(2)})` : ''}
                  </span>
                  {consensus.drawImpliedPct !== null && (
                    <span className="text-zinc-400">
                      Draw {consensus.drawImpliedPct}%
                      {consensus.drawDecimal ? ` (${consensus.drawDecimal.toFixed(2)})` : ''}
                    </span>
                  )}
                  <span className="text-[#f5b800] font-semibold">
                    {match.awayTeam.shortName} {consensus.awayImpliedPct}%
                    {consensus.awayDecimal ? ` (${consensus.awayDecimal.toFixed(2)})` : ''}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800">
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

        <div className="flex items-center gap-1.5 text-xs text-zinc-400 pt-1">
          <Info className="w-3.5 h-3.5 text-[#f5b800]" />
          <span>Live scoreboard, stats, form, lineups & injuries powered by real match feeds.</span>
        </div>
      </div>

      {/* Match Center Section Tabs (FlashScore / SofaScore Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-[#18181b] border border-zinc-800 rounded-xl">
        {(
          [
            { id: 'markets', label: `Markets (${match.markets.length})`, icon: Shield },
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
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-heading text-xs font-bold transition-colors ${
                active ? 'bg-[#f5b800] text-[#111111]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Betting Markets (with 1st Team Total, 2nd Team Total, Cards, Injuries) */}
      {activeTab === 'markets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Markets' },
                { id: 'goals', label: 'Goals & 1st/2nd Team Total' },
                { id: 'cards', label: 'Cards & Injuries' },
                { id: 'halves', label: 'Halves & Correct Score' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setMarketFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg border font-heading text-xs font-semibold transition-colors ${
                  marketFilter === f.id
                    ? 'border-[#f5b800] bg-[#f5b800]/15 text-[#f5b800]'
                    : 'border-zinc-800 bg-[#18181b] text-zinc-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {groupedMarkets.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-8 text-center text-xs text-zinc-400">
              No markets in this filter for {match.sportName}.
            </div>
          ) : (
            groupedMarkets.map(([marketType, items]) => (
              <div
                key={marketType}
                className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold text-white">{marketType}</h3>
                  <span className="text-xs text-zinc-500">Odds</span>
                </div>
                <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {items.map((mkt) => {
                    const active = isSelected(mkt.id);
                    return (
                      <button
                        key={mkt.id}
                        type="button"
                        disabled={isFinished}
                        onClick={() =>
                          toggleSelection({
                            matchId: match.id,
                            marketId: mkt.id,
                            matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                            competitionName: match.competitionName,
                            marketType: mkt.marketType,
                            selectionName: mkt.selectionName,
                            simulatedOdds: mkt.simulatedOdds,
                            status: match.status,
                            startTime: match.startTime,
                          })
                        }
                        className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm transition-all min-h-[42px] ${
                          isFinished
                            ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                            : active
                            ? 'bg-[#f5b800] text-[#111111] font-bold'
                            : 'bg-[#f4f4f5] hover:bg-white text-[#111111] font-medium'
                        }`}
                      >
                        <span className="truncate pr-2 text-xs">{mkt.selectionName}</span>
                        <span className="font-mono-tabular text-xs font-bold shrink-0">
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

      {/* TAB 2: Live Boxscore Stats & Timeline Events (FlashScore Style) */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {loadingCenter ? (
            <div className="h-48 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ) : (
            <>
              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center justify-between font-heading text-xs font-bold text-white">
                  <span>{match.homeTeam.name}</span>
                  <span className="text-[#f5b800]">Match Statistics</span>
                  <span>{match.awayTeam.name}</span>
                </div>

                {!matchCenter || matchCenter.stats.length === 0 ? (
                  <p className="p-6 text-center text-xs text-zinc-400">
                    Detailed live boxscore statistics appear once kickoff begins or match statistics are published.
                  </p>
                ) : (
                  <div className="p-4 space-y-3.5">
                    {matchCenter.stats.map((st, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono-tabular">
                          <span className="font-bold text-white">{st.homeValue}</span>
                          <span className="font-sans text-zinc-400 font-medium">{st.label}</span>
                          <span className="font-bold text-[#f5b800]">{st.awayValue}</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
                          <div className="bg-emerald-500" style={{ width: `${st.homePct}%` }} />
                          <div className="bg-[#f5b800]" style={{ width: `${100 - st.homePct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Match Timeline */}
              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center gap-2 font-heading text-xs font-bold text-white">
                  <Clock className="w-4 h-4 text-[#f5b800]" />
                  <span>Match Events & Cards Timeline</span>
                </div>

                {!matchCenter || matchCenter.timeline.length === 0 ? (
                  <p className="p-6 text-center text-xs text-zinc-400">
                    No match events recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-800/70">
                    {matchCenter.timeline.map((ev, idx) => (
                      <div key={idx} className="px-4 py-2.5 flex items-center gap-3 text-xs">
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
            <div className="h-48 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: match.homeTeam.name, games: matchCenter?.form.home || [] },
                  { label: match.awayTeam.name, games: matchCenter?.form.away || [] },
                ].map((side, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] font-heading text-xs font-bold text-white">
                      {side.label} · Last 5 Games
                    </div>
                    {side.games.length === 0 ? (
                      <p className="p-5 text-center text-xs text-zinc-400">
                        Recent form data unavailable for this competition.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800/70">
                        {side.games.map((g, idx) => (
                          <div
                            key={idx}
                            className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="text-zinc-400 mr-1.5">{g.homeAway}</span>
                              <span className="font-semibold text-zinc-100 truncate">
                                {g.opponent}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono-tabular text-zinc-300">{g.score}</span>
                              <span
                                className={`w-5 h-5 rounded text-[10px] font-mono-tabular font-bold flex items-center justify-center ${
                                  g.result === 'W'
                                    ? 'bg-emerald-500 text-[#111111]'
                                    : g.result === 'D'
                                    ? 'bg-amber-400 text-[#111111]'
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

              {/* League Standings */}
              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] font-heading text-xs font-bold text-white">
                  {match.competitionName} Standings
                </div>
                {!matchCenter || matchCenter.standings.length === 0 ? (
                  <p className="p-5 text-center text-xs text-zinc-400">
                    League table data unavailable for this event.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-zinc-800 text-zinc-400">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Team</th>
                          <th className="px-3 py-2 text-right">MP</th>
                          <th className="px-3 py-2 text-right">W</th>
                          <th className="px-3 py-2 text-right">D</th>
                          <th className="px-3 py-2 text-right">L</th>
                          <th className="px-3 py-2 text-right">GD</th>
                          <th className="px-3 py-2 text-right">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70 font-mono-tabular">
                        {matchCenter.standings.map((row) => (
                          <tr
                            key={row.rank + row.team}
                            className={row.isMatchTeam ? 'bg-[#f5b800]/15 text-white font-bold' : ''}
                          >
                            <td className="px-3 py-2 text-zinc-400">{row.rank}</td>
                            <td className="px-3 py-2 font-sans">{row.team}</td>
                            <td className="px-3 py-2 text-right">{row.played}</td>
                            <td className="px-3 py-2 text-right">{row.wins}</td>
                            <td className="px-3 py-2 text-right">{row.draws}</td>
                            <td className="px-3 py-2 text-right">{row.losses}</td>
                            <td className="px-3 py-2 text-right">{row.gd}</td>
                            <td className="px-3 py-2 text-right text-[#f5b800] font-bold">
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
            <div className="h-48 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ) : (
            <>
              {/* Injuries & Suspensions */}
              <div className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] flex items-center gap-2 font-heading text-xs font-bold text-[#f5b800]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Injuries & Player Availability</span>
                </div>

                {!matchCenter ||
                (matchCenter.injuries.home.length === 0 && matchCenter.injuries.away.length === 0) ? (
                  <p className="p-5 text-center text-xs text-zinc-400">
                    No official pre-match injuries reported in the live feed for this fixture.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                    {[
                      { team: match.homeTeam.name, list: matchCenter.injuries.home },
                      { team: match.awayTeam.name, list: matchCenter.injuries.away },
                    ].map((side, idx) => (
                      <div key={idx} className="p-4 space-y-2.5">
                        <h4 className="font-heading text-xs font-bold text-white">{side.team}</h4>
                        {side.list.length === 0 ? (
                          <p className="text-xs text-zinc-500">No reported absences.</p>
                        ) : (
                          side.list.map((inj, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 rounded-lg bg-[#121214] border border-zinc-800 px-3 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">
                                  {inj.player}{' '}
                                  {inj.position && (
                                    <span className="text-zinc-500">({inj.position})</span>
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

              {/* Lineups / Squads */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { team: match.homeTeam.name, players: matchCenter?.lineups.home || [] },
                  { team: match.awayTeam.name, players: matchCenter?.lineups.away || [] },
                ].map((side, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-zinc-800 bg-[#141416] font-heading text-xs font-bold text-white">
                      {side.team} · Lineup & Squad
                    </div>
                    {side.players.length === 0 ? (
                      <p className="p-5 text-center text-xs text-zinc-400">
                        Lineups are typically published 45–60 minutes before kickoff.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800/70 max-h-80 overflow-y-auto">
                        {side.players.map((p, i) => (
                          <div
                            key={i}
                            className="px-4 py-2 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono-tabular text-zinc-500 w-5">
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
