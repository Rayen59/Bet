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
import { useAuth } from '../context/AuthContext';
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

  const { user } = useAuth();
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
          if (active && initial) setError(err?.message || 'Impossible de charger ce match.');
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
        <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
        <p className="text-sm text-rose-600 font-medium">{error || 'Match introuvable.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[#0a58ca] hover:bg-[#0847a8] text-sm font-bold text-white"
        >
          Retour aux matchs
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
        className="inline-flex items-center gap-2 font-heading text-sm font-bold text-slate-600 hover:text-[#0a58ca] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour aux matchs</span>
      </button>

      {/* Crisp White Match Scoreboard Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pb-3.5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-slate-900 font-bold">{match.sportName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-700">{match.competitionName}</span>
            {match.competitionCountry && (
              <>
                <span aria-hidden="true">·</span>
                <span>{match.competitionCountry}</span>
              </>
            )}
            {matchCenter?.venue && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-[#0a58ca]" />
                  {matchCenter.venue.name}
                  {matchCenter.venue.city ? `, ${matchCenter.venue.city}` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono-tabular">
            {match.status === 'live' ? (
              <span className="inline-flex items-center gap-2 font-bold">
                <span className="rounded bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                  LIVE
                </span>
                <span className="text-[#dc2626]">{match.matchTimer}</span>
              </span>
            ) : (
              <span className="text-slate-600 font-semibold">
                {match.status.toUpperCase()} · {new Date(match.startTime).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-4 py-3 text-center">
          <div className="flex flex-col items-center gap-3">
            <TeamBadge shortName={match.homeTeam.shortName} color={match.homeTeam.logo} size="lg" />
            <span className="font-heading text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
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
                        ? 'bg-emerald-600 text-white'
                        : g.result === 'D'
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {g.result}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="font-mono-tabular text-4xl sm:text-5xl font-extrabold text-[#0a58ca] tracking-tight">
              {match.status === 'upcoming' ? 'vs' : `${match.homeScore} : ${match.awayScore}`}
            </div>
            <span className="text-xs text-slate-500 font-mono-tabular font-semibold">
              {match.matchTimer}
            </span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <TeamBadge shortName={match.awayTeam.shortName} color={match.awayTeam.logo} size="lg" />
            <span className="font-heading text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
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
                        ? 'bg-emerald-600 text-white'
                        : g.result === 'D'
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-rose-600 text-white'
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-heading font-bold text-[#0a58ca]">
                <TrendingUp className="w-4 h-4" />
                <span>Consensus Marché · {consensus.provider}</span>
              </span>
              {consensus.overUnderLine && (
                <span className="font-mono-tabular text-slate-600">
                  Ligne O/U : <strong className="text-slate-900">{consensus.overUnderLine}</strong>{' '}
                  {consensus.overDecimal ? `(O ${consensus.overDecimal.toFixed(2)}` : ''}
                  {consensus.underDecimal ? ` / U ${consensus.underDecimal.toFixed(2)})` : ''}
                </span>
              )}
            </div>

            {consensus.homeImpliedPct !== null && consensus.awayImpliedPct !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono-tabular">
                  <span className="text-emerald-700 font-bold">
                    {match.homeTeam.shortName} {consensus.homeImpliedPct}%
                    {consensus.homeDecimal ? ` (${consensus.homeDecimal.toFixed(2)})` : ''}
                  </span>
                  {consensus.drawImpliedPct !== null && (
                    <span className="text-slate-600 font-semibold">
                      Nul {consensus.drawImpliedPct}%
                      {consensus.drawDecimal ? ` (${consensus.drawDecimal.toFixed(2)})` : ''}
                    </span>
                  )}
                  <span className="text-[#0a58ca] font-bold">
                    {match.awayTeam.shortName} {consensus.awayImpliedPct}%
                    {consensus.awayDecimal ? ` (${consensus.awayDecimal.toFixed(2)})` : ''}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-200">
                  <div className="bg-emerald-500" style={{ width: `${consensus.homeImpliedPct}%` }} />
                  {consensus.drawImpliedPct !== null && (
                    <div className="bg-slate-400" style={{ width: `${consensus.drawImpliedPct}%` }} />
                  )}
                  <div className="bg-[#0a58ca]" style={{ width: `${consensus.awayImpliedPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
          <Info className="w-4 h-4 text-[#0a58ca] shrink-0" />
          <span>
            Le Bet Builder permet de combiner plusieurs choix logiques sur ce match. Les options contradictoires sont filtrées automatiquement.
          </span>
        </div>
      </div>

      {/* Match Center Section Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
        {(
          [
            { id: 'markets', label: `Marchés & BB (${match.markets.length})`, icon: Layers },
            { id: 'stats', label: 'Stats & Chronologie', icon: BarChart3 },
            { id: 'form', label: 'Forme & Classement', icon: Activity },
            { id: 'lineups', label: 'Compos & Blessures', icon: Users },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-heading text-xs font-bold transition-colors ${
                active
                  ? 'bg-[#0a58ca] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0a58ca] flex items-center justify-center text-white shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>Bet Builder</span>
                    {matchSelections.length > 0 && (
                      <span className="font-mono-tabular text-xs font-bold text-[#0a58ca]">
                        ({matchSelections.length} sélection{matchSelections.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {user?.role === 'admin'
                      ? 'Mode Admin : aperçu des marchés uniquement.'
                      : 'Sélectionnez plusieurs choix logiques sur ce match — les contradictions sont filtrées automatiquement.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHideIllogical((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    hideIllogical
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {hideIllogical ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>
                    {hideIllogical
                      ? `Filtre auto: ON${removedIllogicalCount > 0 ? ` (${removedIllogicalCount})` : ''}`
                      : `Afficher bloqués (${removedIllogicalCount})`}
                  </span>
                </button>

                {matchSelections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearMatchSelections(match.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vider le match</span>
                  </button>
                )}
              </div>
            </div>

            {matchSelections.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-blue-200/70">
                <div className="flex flex-wrap gap-2">
                  {matchSelections.map((sel) => (
                    <div
                      key={sel.marketId}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs shadow-2xs"
                    >
                      <span className="text-slate-500">{sel.marketType}:</span>
                      <span className="font-bold text-slate-900">{sel.selectionName}</span>
                      <span className="font-mono-tabular font-extrabold text-[#0a58ca]">
                        {sel.simulatedOdds.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelection(sel.marketId)}
                        className="text-slate-400 hover:text-rose-600 ml-0.5"
                        aria-label={`Retirer ${sel.selectionName}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white border border-blue-200 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {matchSelections.length > 1
                        ? 'Tous les choix sélectionnés sont compatibles.'
                        : 'Ajoutez un autre marché compatible pour créer un Bet Builder.'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 mr-2">
                        {matchSelections.length > 1 ? 'Cote Bet Builder' : 'Cote'}
                      </span>
                      <span className="font-mono-tabular text-base font-extrabold text-[#0a58ca]">
                        {betBuilderOdds.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileOpen(true)}
                      className="lg:hidden inline-flex items-center gap-1.5 rounded-xl bg-[#0a58ca] text-white font-bold px-3 py-1.5 text-xs"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Ouvrir Ticket</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                <Sparkles className="w-4 h-4 text-[#0a58ca] shrink-0" />
                <span>
                  Exemple logique : <strong className="text-slate-900">1</strong> +{' '}
                  <strong className="text-slate-900">Over 2.5</strong> +{' '}
                  <strong className="text-slate-900">Les 2 équipes marquent · Oui</strong>.
                </span>
              </div>
            )}

            {lastAutoCleaned.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Choix incompatible(s) retiré(s) : <strong>{lastAutoCleaned.join(', ')}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'Tous les marchés' },
                  { id: 'goals', label: 'Résultat & Buts' },
                  { id: 'cards', label: 'Cartons & Fautes' },
                  { id: 'halves', label: 'Mi-temps & Handicaps' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMarketFilter(f.id)}
                  className={`px-3.5 py-2 rounded-full font-heading text-xs font-bold transition-colors ${
                    marketFilter === f.id
                      ? 'bg-[#0a58ca] text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {removedIllogicalCount > 0 && hideIllogical && (
              <span className="text-xs text-slate-500 font-medium">
                {removedIllogicalCount} option(s) incompatible(s) masquée(s)
              </span>
            )}
          </div>

          {groupedMarkets.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-2 shadow-xs">
              <p className="text-sm font-medium text-slate-600">
                Aucun marché compatible dans cette catégorie pour vos sélections actuelles.
              </p>
              <button
                type="button"
                onClick={() => setMarketFilter('all')}
                className="text-xs font-bold text-[#0a58ca] hover:underline"
              >
                Afficher tous les marchés
              </button>
            </div>
          ) : (
            groupedMarkets.map(([marketType, items]) => (
              <div
                key={marketType}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
              >
                <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-heading text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#0a58ca]" />
                    <span>{marketType}</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    {items.length} option{items.length > 1 ? 's' : ''}
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
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all min-h-[48px] text-left ${
                          isFinished
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : active
                            ? 'bg-[#0a58ca] border-[#0a58ca] text-white font-bold shadow-xs'
                            : blocked
                            ? 'bg-rose-50/50 border-rose-200 text-slate-500 hover:border-amber-400'
                            : 'bg-slate-100/90 hover:bg-blue-50 border-slate-200 hover:border-[#0a58ca]/40 text-slate-900 font-medium'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span
                            className={`block truncate text-[13px] font-semibold ${
                              active ? 'text-white' : blocked ? 'text-slate-500' : 'text-slate-800'
                            }`}
                          >
                            {mkt.selectionName}
                          </span>
                          {blocked && (
                            <span className="block text-[10px] text-rose-600 truncate">
                              {compat.status === 'redundant'
                                ? 'Déjà inclus (cliquer pour remplacer)'
                                : 'Conflit (cliquer pour remplacer)'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono-tabular text-sm font-extrabold shrink-0 ${
                            active ? 'text-white' : blocked ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
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
            <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between font-heading text-xs sm:text-sm font-bold text-slate-900">
                  <span>{match.homeTeam.name}</span>
                  <span className="text-[#0a58ca]">Statistiques du match</span>
                  <span>{match.awayTeam.name}</span>
                </div>

                {!matchCenter || matchCenter.stats.length === 0 ? (
                  <p className="p-8 text-center text-xs sm:text-sm text-slate-500">
                    Les statistiques en direct apparaissent dès le coup d&apos;envoi.
                  </p>
                ) : (
                  <div className="p-5 space-y-4">
                    {matchCenter.stats.map((st, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-mono-tabular">
                          <span className="font-bold text-emerald-700">{st.homeValue}</span>
                          <span className="font-sans text-slate-600 font-semibold">{st.label}</span>
                          <span className="font-bold text-[#0a58ca]">{st.awayValue}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                          <div className="bg-emerald-500" style={{ width: `${st.homePct}%` }} />
                          <div className="bg-[#0a58ca]" style={{ width: `${100 - st.homePct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 font-heading text-xs sm:text-sm font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-[#0a58ca]" />
                  <span>Temps forts &amp; Cartons</span>
                </div>

                {!matchCenter || matchCenter.timeline.length === 0 ? (
                  <p className="p-8 text-center text-xs sm:text-sm text-slate-500">
                    Aucun événement enregistré pour le moment.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {matchCenter.timeline.map((ev, idx) => (
                      <div key={idx} className="px-5 py-3 flex items-center gap-3 text-xs sm:text-sm">
                        <span className="font-mono-tabular font-bold text-[#0a58ca] w-12 shrink-0">
                          {ev.clock || '–'}
                        </span>
                        <span
                          className={`w-2.5 h-3.5 rounded-xs shrink-0 ${
                            ev.type === 'goal'
                              ? 'bg-emerald-500'
                              : ev.type === 'yellow'
                              ? 'bg-amber-400'
                              : ev.type === 'red'
                              ? 'bg-rose-600'
                              : 'bg-slate-400'
                          }`}
                          title={ev.type}
                        />
                        <span className="text-slate-800">{ev.text}</span>
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
            <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: match.homeTeam.name, games: matchCenter?.form.home || [] },
                  { label: match.awayTeam.name, games: matchCenter?.form.away || [] },
                ].map((side, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                  >
                    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 font-heading text-xs sm:text-sm font-bold text-slate-900">
                      {side.label} · 5 derniers matchs
                    </div>
                    {side.games.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">
                        Historique récent indisponible pour cette compétition.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {side.games.map((g, idx) => (
                          <div
                            key={idx}
                            className="px-5 py-3 flex items-center justify-between gap-2 text-xs sm:text-sm"
                          >
                            <div className="min-w-0">
                              <span className="text-slate-400 mr-2">{g.homeAway}</span>
                              <span className="font-semibold text-slate-900 truncate">
                                {g.opponent}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="font-mono-tabular text-slate-600">{g.score}</span>
                              <span
                                className={`w-6 h-6 rounded text-[11px] font-mono-tabular font-bold flex items-center justify-center ${
                                  g.result === 'W'
                                    ? 'bg-emerald-600 text-white'
                                    : g.result === 'D'
                                    ? 'bg-amber-400 text-slate-900'
                                    : 'bg-rose-600 text-white'
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

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 font-heading text-xs sm:text-sm font-bold text-slate-900">
                  Classement · {match.competitionName}
                </div>
                {!matchCenter || matchCenter.standings.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500">
                    Classement indisponible pour cet événement.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-slate-200 text-slate-500 bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5">#</th>
                          <th className="px-4 py-2.5">Équipe</th>
                          <th className="px-4 py-2.5 text-right">J</th>
                          <th className="px-4 py-2.5 text-right">G</th>
                          <th className="px-4 py-2.5 text-right">N</th>
                          <th className="px-4 py-2.5 text-right">P</th>
                          <th className="px-4 py-2.5 text-right">DB</th>
                          <th className="px-4 py-2.5 text-right">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono-tabular">
                        {matchCenter.standings.map((row) => (
                          <tr
                            key={row.rank + row.team}
                            className={row.isMatchTeam ? 'bg-blue-50 text-slate-900 font-bold' : ''}
                          >
                            <td className="px-4 py-2.5 text-slate-500">{row.rank}</td>
                            <td className="px-4 py-2.5 font-sans text-slate-900">{row.team}</td>
                            <td className="px-4 py-2.5 text-right">{row.played}</td>
                            <td className="px-4 py-2.5 text-right">{row.wins}</td>
                            <td className="px-4 py-2.5 text-right">{row.draws}</td>
                            <td className="px-4 py-2.5 text-right">{row.losses}</td>
                            <td className="px-4 py-2.5 text-right">{row.gd}</td>
                            <td className="px-4 py-2.5 text-right text-[#0a58ca] font-bold">
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
            <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 font-heading text-xs sm:text-sm font-bold text-[#0a58ca]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Blessures &amp; Disponibilité</span>
                </div>

                {!matchCenter ||
                (matchCenter.injuries.home.length === 0 && matchCenter.injuries.away.length === 0) ? (
                  <p className="p-6 text-center text-xs text-slate-500">
                    Aucune absence officielle signalée pour cette rencontre.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    {[
                      { team: match.homeTeam.name, list: matchCenter.injuries.home },
                      { team: match.awayTeam.name, list: matchCenter.injuries.away },
                    ].map((side, idx) => (
                      <div key={idx} className="p-4 space-y-2.5">
                        <h4 className="font-heading text-sm font-bold text-slate-900">{side.team}</h4>
                        {side.list.length === 0 ? (
                          <p className="text-xs text-slate-400">Aucune absence signalée.</p>
                        ) : (
                          side.list.map((inj, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {inj.player}{' '}
                                  {inj.position && (
                                    <span className="text-slate-500">({inj.position})</span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">{inj.detail}</p>
                              </div>
                              <span className="rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold uppercase shrink-0">
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
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                  >
                    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 font-heading text-xs sm:text-sm font-bold text-slate-900">
                      {side.team} · Composition
                    </div>
                    {side.players.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">
                        Les compositions officielles sont publiées 45–60 min avant le coup d&apos;envoi.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {side.players.map((p, i) => (
                          <div
                            key={i}
                            className="px-5 py-2.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono-tabular text-slate-400 w-5">
                                {p.jersey || '–'}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-slate-500">{p.position}</span>
                              {p.starter && (
                                <span className="text-[10px] font-bold text-emerald-600">XI</span>
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
