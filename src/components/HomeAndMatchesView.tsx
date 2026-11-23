import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronsRight,
  CircleDot,
  Disc,
  Gamepad2,
  Globe,
  LayoutGrid,
  Radio,
  Search,
  ShieldCheck,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSlip } from '../context/SlipContext';
import { AppRoute, CompetitionItem, MatchItem, SportItem } from '../types/sportzone';
import { TeamBadge } from './BrandLogo';
import { MatchRow } from './MatchRow';

interface HomeAndMatchesViewProps {
  route: AppRoute;
  matches: MatchItem[];
  sports: SportItem[];
  competitions: CompetitionItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate: (route: AppRoute) => void;
  onSelectMatch: (matchId: number) => void;
}

function MiniSportBall({ slug }: { slug: string }) {
  if (slug === 'basketball') return <CircleDot className="w-4 h-4 text-amber-600 shrink-0" />;
  if (slug === 'tennis') return <Disc className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (slug === 'volleyball') return <Globe className="w-4 h-4 text-sky-600 shrink-0" />;
  if (slug === 'esports') return <Gamepad2 className="w-4 h-4 text-indigo-600 shrink-0" />;
  return <Trophy className="w-4 h-4 text-[#0a58ca] shrink-0" />;
}

export function HomeAndMatchesView({
  route,
  matches,
  sports,
  competitions,
  loading,
  searchQuery,
  onSearchChange,
  onNavigate,
  onSelectMatch,
}: HomeAndMatchesViewProps) {
  const { user } = useAuth();
  const { toggleSelection, isSelected, getMatchSelections } = useSlip();
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('all');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('all');
  const [selectedDateOffset, setSelectedDateOffset] = useState<number | 'all'>('all');

  const dateTabs = useMemo(() => {
    const days: Array<{ label: string; dayNum: string; offset: number }> = [];
    const base = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push({
        label: i === 0 ? "Aujourd'hui" : d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNum: String(d.getDate()),
        offset: i,
      });
    }
    return days;
  }, []);

  const activeSportSlug = useMemo(() => {
    if (route === 'sport-football') return 'football';
    if (route === 'sport-basketball') return 'basketball';
    if (route === 'sport-tennis') return 'tennis';
    if (route === 'sport-volleyball') return 'volleyball';
    if (route === 'sport-esports') return 'esports';
    return selectedSportFilter;
  }, [route, selectedSportFilter]);

  const filteredMatches = useMemo(() => {
    const today = new Date();
    return matches.filter((m) => {
      if (activeSportSlug !== 'all' && m.sportSlug !== activeSportSlug) return false;
      if (selectedCompetition !== 'all' && m.competitionSlug !== selectedCompetition) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (selectedDateOffset !== 'all') {
        const target = new Date(today);
        target.setDate(today.getDate() + selectedDateOffset);
        const mDate = new Date(m.startTime);
        if (
          mDate.getFullYear() !== target.getFullYear() ||
          mDate.getMonth() !== target.getMonth() ||
          mDate.getDate() !== target.getDate()
        ) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${m.homeTeam.name} ${m.awayTeam.name} ${m.competitionName} ${m.sportName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matches, activeSportSlug, selectedCompetition, statusFilter, selectedDateOffset, searchQuery]);

  const liveMatches = useMemo(() => matches.filter((m) => m.status === 'live'), [matches]);

  const topEvents = useMemo(() => {
    const marquee = new Set([
      'premier-league',
      'la-liga',
      'bundesliga',
      '2-bundesliga',
      'dfb-pokal',
      'serie-a',
      'ligue-1',
      'eredivisie',
      'super-lig',
      'champions-league',
      'nba',
      'mls',
      'england-premier-league',
      'spain-laliga',
      'germany-bundesliga',
      'germany-2-bundesliga',
      'germany-3-liga',
      'tunisia-ligue-i',
      'italy-serie-a',
      'france-ligue-1',
    ]);
    const open = matches.filter((m) => m.status !== 'finished');
    const pool = open.length > 0 ? open : matches;
    return [...pool]
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        const aTunGer = /tunisia|germany/i.test(a.competitionCountry || '') ? 1 : 0;
        const bTunGer = /tunisia|germany/i.test(b.competitionCountry || '') ? 1 : 0;
        if (aTunGer !== bTunGer) return bTunGer - aTunGer;
        const aMarq = marquee.has(a.competitionSlug) ? 1 : 0;
        const bMarq = marquee.has(b.competitionSlug) ? 1 : 0;
        if (aMarq !== bMarq) return bMarq - aMarq;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      })
      .slice(0, 10);
  }, [matches]);

  const boostedCardItems = useMemo(() => {
    const openPool = matches.filter((m) => m.status !== 'finished' && m.markets.length > 0);
    const prioritized = [...openPool].sort((a, b) => {
      const aScore =
        (/tunisia|germany|netherlands|italy|england|spain/i.test(a.competitionCountry || '') ? 2 : 0) +
        (a.status === 'live' ? 1 : 0);
      const bScore =
        (/tunisia|germany|netherlands|italy|england|spain/i.test(b.competitionCountry || '') ? 2 : 0) +
        (b.status === 'live' ? 1 : 0);
      return bScore - aScore;
    });

    return prioritized.slice(0, 8).map((m, idx) => {
      const dc = m.markets.find((mk) => mk.marketType === 'Double chance' && mk.selectionName === 'X or 2');
      const total = m.markets.find((mk) => mk.marketType === 'Total' && mk.selectionName === 'Over 2.5');
      const one = m.markets.find(
        (mk) => (mk.marketType === '1×2' || mk.marketType === '1X2') && mk.selectionName === '1'
      );
      const picked =
        idx % 3 === 0
          ? dc || one || m.markets[0]
          : idx % 3 === 1
          ? total || one || m.markets[0]
          : one || m.markets[0];
      const baseOdd = Math.max(1.05, Math.round((picked.simulatedOdds / 1.09) * 100) / 100);
      return { match: m, market: picked, baseOdd };
    });
  }, [matches]);

  const leagueShortcuts = useMemo(() => {
    const wanted = [
      { label: 'Tunisie · Ligue I', match: (c: CompetitionItem) => /tunisia/i.test(c.country) },
      {
        label: 'Bundesliga',
        match: (c: CompetitionItem) => /germany/i.test(c.country) && /^bundesliga$/i.test(c.name),
      },
      {
        label: 'Premier League',
        match: (c: CompetitionItem) => /england/i.test(c.country) && /premier league/i.test(c.name),
      },
      {
        label: 'La Liga',
        match: (c: CompetitionItem) => /spain/i.test(c.country) && /la\s*liga/i.test(c.name),
      },
      {
        label: 'Serie A',
        match: (c: CompetitionItem) => /italy/i.test(c.country) && /serie a/i.test(c.name),
      },
      {
        label: 'Ligue 1',
        match: (c: CompetitionItem) => /france/i.test(c.country) && /ligue 1/i.test(c.name),
      },
    ];
    return wanted
      .map((w) => {
        const found = competitions.find(w.match);
        return found ? { label: w.label, slug: found.slug } : null;
      })
      .filter((x): x is { label: string; slug: string } => Boolean(x));
  }, [competitions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-20 rounded-2xl bg-blue-50/70 border border-blue-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (route === 'home') {
    const displayMatches =
      selectedDateOffset !== 'all' ||
      selectedCompetition !== 'all' ||
      selectedSportFilter !== 'all' ||
      statusFilter !== 'all' ||
      searchQuery.trim()
        ? filteredMatches
        : matches.slice(0, 24);

    return (
      <div className="space-y-4">
        {/* 1. Crisp White Hero Card matching Reference Screenshots 1 & 3 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
          <div className="space-y-2">
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-[#0a58ca] shrink-0" />
              <span>Plateforme Sportive &amp; Paris en Direct</span>
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Matchs classés par discipline et compétition : Football, Basketball, Tennis et Esports avec scores synchronisés en temps réel, cotes dynamiques et Bet Builder.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {user?.role !== 'admin' ? (
              <button
                type="button"
                onClick={() => onNavigate('recharge')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold px-5 py-2.5 text-sm shadow-xs transition-colors"
              >
                <Wallet className="w-4 h-4" />
                <span>+ Recharger mon Solde (DT)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold px-5 py-2.5 text-sm shadow-xs transition-colors"
              >
                <span>Ouvrir la Console Admin</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold px-4 py-2.5 text-sm transition-colors"
            >
              <Radio className="w-4 h-4 text-[#dc2626]" />
              <span>Voir le Direct ({liveMatches.length})</span>
            </button>
          </div>
        </section>

        {/* 2. Soft Blue Live Status Banner matching Screenshot 1 */}
        <section className="rounded-2xl border border-blue-200 bg-blue-50/85 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
            Suivi en direct actif : scores, minutes de jeu et cotes actualisés en temps réel avec ticket instantané et Bet Builder multi-marchés.
          </div>
          <div className="rounded-2xl bg-blue-100/90 border border-blue-200 px-3.5 py-2 text-center shrink-0">
            <p className="font-mono-tabular text-xs sm:text-sm font-extrabold text-[#0a58ca]">
              {matches.length} matchs
            </p>
            <p className="text-[11px] font-semibold text-[#0a58ca]">
              {liveMatches.length} en direct
            </p>
          </div>
        </section>

        {/* 3. White Filter Card matching Screenshots 1 & 3 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mr-1">
              Sport :
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedSportFilter('all');
                setSelectedCompetition('all');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedSportFilter === 'all'
                  ? 'bg-[#0a58ca] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tous
            </button>
            {sports.map((sp) => {
              const active = selectedSportFilter === sp.slug;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    setSelectedSportFilter(active ? 'all' : sp.slug);
                    setSelectedCompetition('all');
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#0a58ca] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sp.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                Statut :
              </span>
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'live', label: `En direct (${liveMatches.length})` },
                  { id: 'upcoming', label: 'À venir' },
                  { id: 'finished', label: 'Terminés' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === st.id
                      ? 'bg-[#0a58ca] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              {dateTabs.map((d) => {
                const active = selectedDateOffset === d.offset;
                return (
                  <button
                    key={d.offset}
                    type="button"
                    onClick={() => setSelectedDateOffset(active ? 'all' : d.offset)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0a58ca] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {d.label} {d.dayNum}
                  </button>
                );
              })}
            </div>

            <span className="font-mono-tabular text-xs font-medium text-slate-500 shrink-0">
              {displayMatches.length} match(s) affiché(s)
            </span>
          </div>

          {leagueShortcuts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                Ligues :
              </span>
              <button
                type="button"
                onClick={() => setSelectedCompetition('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedCompetition === 'all'
                    ? 'bg-[#0a58ca] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Toutes
              </button>
              {leagueShortcuts.map((ls) => {
                const active = selectedCompetition === ls.slug;
                return (
                  <button
                    key={ls.slug}
                    type="button"
                    onClick={() => setSelectedCompetition(active ? 'all' : ls.slug)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0a58ca] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {ls.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Top Events Rail (Spacious Light Cards) */}
        {topEvents.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 font-heading text-base font-extrabold text-slate-900">
                <Calendar className="w-4 h-4 text-[#0a58ca]" />
                <span>Top Événements</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a58ca] hover:underline whitespace-nowrap shrink-0"
              >
                <span>{liveMatches.length} en direct →</span>
              </button>
            </div>

            <div className="flex gap-3.5 overflow-x-auto pb-2 snap-x">
              {topEvents.map((m) => {
                const dt = new Date(m.startTime);
                const tStr = `${String(dt.getDate()).padStart(2, '0')}/${String(
                  dt.getMonth() + 1
                ).padStart(2, '0')} • ${String(dt.getHours()).padStart(2, '0')}:${String(
                  dt.getMinutes()
                ).padStart(2, '0')}`;
                const quick =
                  m.sportSlug === 'football'
                    ? m.markets
                        .filter((mk) => mk.marketType === '1×2' || mk.marketType === '1X2')
                        .slice(0, 3)
                    : m.markets.filter((mk) => mk.marketType === 'Match Winner').slice(0, 2);
                const matchPicks = getMatchSelections(m.id);

                return (
                  <div
                    key={m.id}
                    className="snap-start shrink-0 w-[340px] sm:w-[375px] rounded-2xl bg-white border border-slate-200 hover:border-[#0a58ca]/40 p-4 sm:p-5 space-y-3.5 shadow-xs transition-all"
                  >
                    {/* Top meta line */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <MiniSportBall slug={m.sportSlug} />
                        <span className="truncate font-semibold text-slate-700">
                          {m.competitionName}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono-tabular text-slate-500 shrink-0">{tStr}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectMatch(m.id)}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold leading-none shrink-0 ${
                          matchPicks.length > 0
                            ? 'bg-[#0a58ca] text-white'
                            : 'bg-blue-50 text-[#0a58ca] border border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {matchPicks.length > 1 ? `BB (${matchPicks.length})` : 'BB'}
                      </button>
                    </div>

                    {/* Teams + Live Score */}
                    <button
                      type="button"
                      onClick={() => onSelectMatch(m.id)}
                      className="w-full flex items-center justify-between gap-3 text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <TeamBadge
                            shortName={m.homeTeam.shortName}
                            color={m.homeTeam.logo}
                            size="md"
                            variant="jersey"
                            striped
                          />
                          <TeamBadge
                            shortName={m.awayTeam.shortName}
                            color={m.awayTeam.logo}
                            size="md"
                            variant="jersey"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="font-heading text-sm font-bold text-slate-900 truncate group-hover:text-[#0a58ca] transition-colors">
                            {m.homeTeam.name}
                          </p>
                          <p className="font-heading text-sm font-bold text-slate-900 truncate group-hover:text-[#0a58ca] transition-colors">
                            {m.awayTeam.name}
                          </p>
                        </div>
                      </div>

                      {m.status === 'live' ? (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="rounded bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold text-white tracking-wide">
                            LIVE {m.matchTimer}
                          </span>
                          <span className="font-mono-tabular text-base font-extrabold text-[#0a58ca]">
                            {m.homeScore} : {m.awayScore}
                          </span>
                        </div>
                      ) : m.status === 'finished' ? (
                        <div className="font-mono-tabular text-sm font-bold text-slate-600 shrink-0">
                          {m.homeScore} : {m.awayScore}
                        </div>
                      ) : null}
                    </button>

                    {/* Spacious Odds Buttons */}
                    <div className={`grid gap-2 ${quick.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {quick.map((mkt) => {
                        const active = isSelected(mkt.id);
                        return (
                          <button
                            key={mkt.id}
                            type="button"
                            disabled={m.status === 'finished'}
                            onClick={() =>
                              toggleSelection(
                                {
                                  matchId: m.id,
                                  marketId: mkt.id,
                                  matchLabel: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
                                  competitionName: m.competitionName,
                                  marketType: mkt.marketType,
                                  selectionName: mkt.selectionName,
                                  simulatedOdds: mkt.simulatedOdds,
                                  status: m.status,
                                  startTime: m.startTime,
                                },
                                {
                                  homeName: m.homeTeam.name,
                                  awayName: m.awayTeam.name,
                                }
                              )
                            }
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all min-h-[46px] border ${
                              m.status === 'finished'
                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                : active
                                ? 'bg-[#0a58ca] border-[#0a58ca] text-white font-bold shadow-xs'
                                : 'bg-slate-100/90 hover:bg-blue-50 border-slate-200 hover:border-[#0a58ca]/40 text-slate-900 font-medium'
                            }`}
                          >
                            <span
                              className={`truncate text-xs ${
                                active ? 'text-blue-100 font-bold' : 'text-slate-500'
                              }`}
                            >
                              {mkt.selectionName}
                            </span>
                            <span className="font-mono-tabular text-sm font-extrabold shrink-0">
                              {mkt.simulatedOdds.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Cotes Boostées */}
        {boostedCardItems.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-2 font-heading text-base font-extrabold text-slate-900">
                <Zap className="w-4 h-4 text-[#0a58ca]" />
                <span>Cotes Boostées</span>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="text-xs font-bold text-[#0a58ca] hover:underline"
              >
                Tous les matchs ({matches.length}) →
              </button>
            </div>

            <div className="flex gap-3.5 overflow-x-auto pb-2 snap-x">
              {boostedCardItems.map(({ match: m, market: mkt, baseOdd }) => {
                const dt = new Date(m.startTime);
                const dtFormatted = `${String(dt.getDate()).padStart(2, '0')}/${String(
                  dt.getMonth() + 1
                ).padStart(2, '0')} • ${String(dt.getHours()).padStart(2, '0')}:${String(
                  dt.getMinutes()
                ).padStart(2, '0')}`;
                const active = isSelected(mkt.id);

                return (
                  <div
                    key={`boost_${m.id}_${mkt.id}`}
                    className="snap-start shrink-0 w-[300px] sm:w-[325px] rounded-2xl bg-white border border-blue-200/80 p-4 flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[#0a58ca]">
                          Cote Boostée
                        </span>
                        <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                          {dtFormatted}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 truncate font-medium">
                        {m.competitionName}
                      </p>

                      <button
                        type="button"
                        onClick={() => onSelectMatch(m.id)}
                        className="block w-full text-left font-heading text-sm font-bold text-slate-900 hover:text-[#0a58ca] leading-snug"
                      >
                        {m.homeTeam.name} vs. {m.awayTeam.name}
                      </button>

                      <div className="space-y-0.5 pt-0.5">
                        <p className="text-xs text-slate-500 truncate">{mkt.marketType}</p>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {mkt.selectionName}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggleSelection(
                          {
                            matchId: m.id,
                            marketId: mkt.id,
                            matchLabel: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
                            competitionName: m.competitionName,
                            marketType: mkt.marketType,
                            selectionName: mkt.selectionName,
                            simulatedOdds: mkt.simulatedOdds,
                            status: m.status,
                            startTime: m.startTime,
                          },
                          {
                            homeName: m.homeTeam.name,
                            awayName: m.awayTeam.name,
                          }
                        )
                      }
                      className={`w-full rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 font-mono-tabular text-xs border transition-colors ${
                        active
                          ? 'bg-[#0a58ca] border-[#0a58ca] text-white font-bold'
                          : 'bg-slate-100 hover:bg-blue-50 border-slate-200 text-slate-900 font-bold'
                      }`}
                    >
                      <span
                        className={`line-through ${
                          active ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {baseOdd.toFixed(2)}
                      </span>
                      <ChevronsRight
                        className={`w-4 h-4 ${active ? 'text-white' : 'text-[#0a58ca]'}`}
                      />
                      <span className="font-extrabold text-sm">{mkt.simulatedOdds.toFixed(2)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Enlarged Clear Matchboard List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-heading text-base font-extrabold text-slate-900">
              Matchs du jour &amp; Direct
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="text-xs font-bold text-[#0a58ca] hover:underline"
            >
              Voir tout le calendrier →
            </button>
          </div>

          {displayMatches.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3 shadow-xs">
              <p className="text-sm font-medium text-slate-600">
                Aucun match ne correspond à vos filtres.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDateOffset('all');
                  setSelectedCompetition('all');
                  setSelectedSportFilter('all');
                  setStatusFilter('all');
                  onSearchChange('');
                }}
                className="rounded-xl bg-[#0a58ca] text-white font-bold px-4 py-2 text-xs"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayMatches.map((match) => (
                <MatchRow key={match.id} match={match} onSelectMatch={onSelectMatch} />
              ))}
            </div>
          )}
        </section>

        {/* Clean Footer */}
        <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0a58ca] shrink-0 mt-0.5" />
            <span>
              SPORTZONE · Tableau des scores synchronisé en temps réel, Bet Builder et portefeuille virtuel DT.
            </span>
          </div>
          <span className="font-mono-tabular text-slate-400 shrink-0">© 2026 SPORTZONE</span>
        </footer>
      </div>
    );
  }

  // Dedicated Live / Sport Schedule View
  const pageTitle =
    route === 'live'
      ? 'Matchs en Direct & Calendrier'
      : route === 'sport-football'
      ? 'Football'
      : route === 'sport-basketball'
      ? 'Basketball'
      : route === 'sport-tennis'
      ? 'Tennis'
      : route === 'sport-volleyball'
      ? 'Volleyball'
      : 'Esports';

  const visibleCompetitions =
    activeSportSlug === 'all'
      ? competitions
      : competitions.filter((c) => {
          const sp = sports.find((s) => s.id === c.sportId);
          return sp?.slug === activeSportSlug;
        });

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <LayoutGrid className="w-5 h-5 text-[#0a58ca]" />
            <span>{pageTitle}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {filteredMatches.length} match(s) · {liveMatches.length} en direct · Cliquez sur Bet Builder pour combiner vos choix
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'live', label: 'En direct' },
              { id: 'upcoming', label: 'À venir' },
              { id: 'finished', label: 'Terminés' },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st.id
                  ? 'bg-[#0a58ca] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {route === 'live' && (
            <select
              value={selectedSportFilter}
              onChange={(e) => {
                setSelectedSportFilter(e.target.value);
                setSelectedCompetition('all');
              }}
              aria-label="Filtrer par sport"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#0a58ca] focus:outline-none"
            >
              <option value="all">Tous les sports</option>
              {sports.map((sp) => (
                <option key={sp.id} value={sp.slug}>
                  {sp.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            aria-label="Filtrer par compétition"
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#0a58ca] focus:outline-none"
          >
            <option value="all">Toutes les compétitions</option>
            {visibleCompetitions.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="relative md:hidden">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher..."
              className="rounded-xl border border-slate-300 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3 shadow-xs">
          <p className="text-sm font-medium text-slate-600">
            Aucun match trouvé pour ce filtre
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSelectedCompetition('all');
              setSelectedSportFilter('all');
              setSelectedDateOffset('all');
              onSearchChange('');
            }}
            className="px-4 py-2 rounded-xl bg-[#0a58ca] text-white font-bold text-xs"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((match) => (
            <MatchRow key={match.id} match={match} onSelectMatch={onSelectMatch} />
          ))}
        </div>
      )}
    </div>
  );
}
