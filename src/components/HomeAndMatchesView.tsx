import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
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

const CAROUSEL_SLIDES = [
  {
    image: '/src/assets/images/hero_stadium_night_1795300798312.jpg',
    title: 'FOOTBALL LIVE ARENA',
    subtitle: 'Bet Builder · Premier League · LaLiga · Serie A · Bundesliga · Ligue 1',
    route: 'sport-football' as AppRoute,
  },
  {
    image: '/src/assets/images/arena_basketball_1795300797347.jpg',
    title: 'BASKETBALL COURTSIDE',
    subtitle: 'Bet Builder · Match Winner · Handicaps · Real-Time Boxscore',
    route: 'sport-basketball' as AppRoute,
  },
  {
    image: '/src/assets/images/court_tennis_1795300798703.jpg',
    title: 'GRAND SLAM TENNIS',
    subtitle: 'Set Winners · Match Games · Live In-Play Odds',
    route: 'sport-tennis' as AppRoute,
  },
];

function MiniSportBall({ slug }: { slug: string }) {
  if (slug === 'basketball') return <CircleDot className="w-4 h-4 text-amber-400 shrink-0" />;
  if (slug === 'tennis') return <Disc className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (slug === 'volleyball') return <Globe className="w-4 h-4 text-sky-400 shrink-0" />;
  if (slug === 'esports') return <Gamepad2 className="w-4 h-4 text-indigo-400 shrink-0" />;
  return <CircleDot className="w-4 h-4 text-white shrink-0" />;
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
  const [slideIdx, setSlideIdx] = useState(0);

  const dateTabs = useMemo(() => {
    const days: Array<{ label: string; dayNum: string; offset: number }> = [];
    const base = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push({
        label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }),
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
      .slice(0, 12);
  }, [matches]);

  const boostedMatches = useMemo(() => {
    const liveOrFeat = matches.filter((m) => m.status === 'live' || (m.status === 'upcoming' && m.featured));
    return (liveOrFeat.length > 0 ? liveOrFeat : filteredMatches).slice(0, 20);
  }, [matches, filteredMatches]);

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

    return prioritized.slice(0, 10).map((m, idx) => {
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
      { label: 'Tunisia · Ligue I', match: (c: CompetitionItem) => /tunisia/i.test(c.country) },
      {
        label: 'Bundesliga',
        match: (c: CompetitionItem) => /germany/i.test(c.country) && /^bundesliga$/i.test(c.name),
      },
      {
        label: '2. Bundesliga',
        match: (c: CompetitionItem) => /germany/i.test(c.country) && /2\.\s*bundesliga/i.test(c.name),
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
      <div className="space-y-3">
        <div className="h-24 rounded-lg bg-[#222225] animate-pulse" />
        <div className="h-11 rounded-lg bg-[#222225] animate-pulse" />
        <div className="h-44 rounded-xl bg-[#222225] animate-pulse" />
        <div className="h-64 rounded-xl bg-[#222225] animate-pulse" />
      </div>
    );
  }

  if (route === 'home') {
    const slide = CAROUSEL_SLIDES[slideIdx % CAROUSEL_SLIDES.length];

    return (
      <div className="space-y-3.5">
        {/* 1. Slim Hero Banner + Quick Recharge Callout */}
        <section className="relative h-24 sm:h-28 rounded-xl overflow-hidden border border-zinc-800 bg-[#18191d]">
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover opacity-55 transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f12]/95 via-[#0e0f12]/70 to-[#0e0f12]/45" />

          <button
            type="button"
            onClick={() =>
              setSlideIdx((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length)
            }
            aria-label="Previous banner"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setSlideIdx((prev) => (prev + 1) % CAROUSEL_SLIDES.length)}
            aria-label="Next banner"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate(slide.route)}
            className="absolute inset-0 px-12 flex flex-col items-center justify-center text-center"
          >
            <span className="font-display text-xl sm:text-3xl font-black tracking-wide uppercase text-white drop-shadow">
              {slide.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className="text-[#f5b800]">{slide.title.split(' ').slice(-1)[0]}</span>
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-zinc-200 mt-0.5 truncate max-w-full">
              {slide.subtitle}
            </span>
          </button>
        </section>

        {/* 2. Clean Single-Row Quick Sport + Recharge Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {user?.role !== 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('recharge')}
              className="px-3.5 py-2 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-heading font-extrabold text-xs whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Recharger (Tickets / D17)</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-[#18191d] hover:border-[#e11d2e] text-xs font-bold text-white whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
          >
            <Radio className="w-3.5 h-3.5 text-[#e11d2e]" />
            <span>Live ({liveMatches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-football')}
            className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-[#18191d] hover:border-[#f5b800] text-xs font-semibold text-zinc-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5 text-[#f5b800]" />
            <span>Football</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-basketball')}
            className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-[#18191d] hover:border-[#f5b800] text-xs font-semibold text-zinc-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
          >
            <CircleDot className="w-3.5 h-3.5 text-amber-400" />
            <span>Basketball</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-tennis')}
            className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-[#18191d] hover:border-[#f5b800] text-xs font-semibold text-zinc-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
          >
            <Disc className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tennis</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-esports')}
            className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-[#18191d] hover:border-[#f5b800] text-xs font-semibold text-zinc-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Esports</span>
          </button>
        </div>

        {/* 3. Date Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedDateOffset('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-heading font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedDateOffset === 'all'
                ? 'bg-[#2a2515] border border-[#f5b800] text-[#f5b800]'
                : 'bg-[#18191d] border border-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            Tous les jours
          </button>
          {dateTabs.map((d) => {
            const active = selectedDateOffset === d.offset;
            return (
              <button
                key={d.offset}
                type="button"
                onClick={() => setSelectedDateOffset(active ? 'all' : d.offset)}
                className={`px-3.5 py-2 rounded-lg text-xs font-heading whitespace-nowrap shrink-0 flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-[#2a2515] border border-[#f5b800] text-[#f5b800]'
                    : 'bg-[#18191d] border border-zinc-800 text-zinc-300 hover:text-white'
                }`}
              >
                <span>{d.label}</span>
                <strong className="font-mono-tabular text-white font-bold">{d.dayNum}</strong>
              </button>
            );
          })}
        </div>

        {/* 4. Top Events Header + Horizontal Card Rail */}
        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#18191d] px-4 py-3">
            <div className="flex items-center gap-2.5 font-heading text-sm font-bold text-[#f5b800]">
              <Calendar className="w-4 h-4" />
              <span>Top Événements</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200 hover:text-[#f5b800] transition-colors whitespace-nowrap shrink-0"
            >
              <span className="rounded bg-[#e11d2e] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                LIVE
              </span>
              <span>{liveMatches.length} en direct →</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1.5 snap-x">
            {topEvents.map((m) => {
              const dt = new Date(m.startTime);
              const tStr = `${String(dt.getHours()).padStart(2, '0')}:${String(
                dt.getMinutes()
              ).padStart(2, '0')}  ${String(dt.getDate()).padStart(2, '0')}/${String(
                dt.getMonth() + 1
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
                  className="snap-start shrink-0 w-[320px] sm:w-[340px] rounded-xl bg-[#222225] border border-zinc-800/80 p-3.5 space-y-3"
                >
                  {/* Top meta line: Ball + Gold BB + Time/Date + Country/League */}
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-300">
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <MiniSportBall slug={m.sportSlug} />
                      <button
                        type="button"
                        onClick={() => onSelectMatch(m.id)}
                        title="Open Bet Builder"
                        className="rounded bg-[#f5b800] hover:bg-[#fbbf24] px-1.5 py-0.5 text-[11px] font-extrabold text-[#111111] leading-none shrink-0"
                      >
                        {matchPicks.length > 1 ? `BB (${matchPicks.length})` : 'BB'}
                      </button>
                      <span className="font-mono-tabular font-semibold text-white shrink-0">
                        {tStr}
                      </span>
                      <span className="text-zinc-400">•</span>
                      <span className="truncate text-zinc-300">
                        {m.competitionName}
                      </span>
                    </div>
                  </div>

                  {/* Two Large Circular Jerseys + 2-Line Team Names + Bordered LIVE Pill */}
                  <button
                    type="button"
                    onClick={() => onSelectMatch(m.id)}
                    className="w-full flex items-center justify-between gap-3 text-left hover:opacity-95"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TeamBadge
                          shortName={m.homeTeam.shortName}
                          color={m.homeTeam.logo}
                          size="lg"
                          variant="jersey"
                          striped
                        />
                        <TeamBadge
                          shortName={m.awayTeam.shortName}
                          color={m.awayTeam.logo}
                          size="lg"
                          variant="jersey"
                        />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-heading text-[13px] font-bold text-white truncate">
                          {m.homeTeam.name}
                        </p>
                        <p className="font-heading text-[13px] font-bold text-white truncate">
                          {m.awayTeam.name}
                        </p>
                      </div>
                    </div>

                    {m.status === 'live' ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="rounded border border-zinc-400 px-2 py-0.5 text-[10px] font-bold text-white tracking-wide">
                          LIVE
                        </span>
                        <span className="font-mono-tabular text-xs font-extrabold text-[#f5b800]">
                          {m.homeScore}:{m.awayScore}
                        </span>
                      </div>
                    ) : m.status === 'finished' ? (
                      <div className="font-mono-tabular text-xs font-bold text-zinc-400 shrink-0">
                        {m.homeScore}:{m.awayScore}
                      </div>
                    ) : null}
                  </button>

                  {/* Crisp White/Light-Grey Odds Boxes matching 0cabe743 */}
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
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-colors min-h-[42px] ${
                            m.status === 'finished'
                              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                              : active
                              ? 'bg-[#f5b800] text-[#111111] font-bold'
                              : 'bg-[#ececef] hover:bg-white text-[#111111] font-medium'
                          }`}
                        >
                          <span
                            className={`truncate text-xs ${
                              active ? 'text-[#111111]/85 font-bold' : 'text-zinc-500'
                            }`}
                          >
                            {mkt.selectionName}
                          </span>
                          <span className="font-mono-tabular text-[13px] font-bold shrink-0">
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

        {/* 5. Solid Gold Boosted Odds (only shown when matches exist) */}
        {boostedCardItems.length > 0 && (
          <section className="space-y-3">
            <div className="rounded-xl bg-[#f5b800] text-[#111111] px-4 py-2.5 flex items-center justify-between font-heading font-extrabold text-sm">
              <span className="inline-flex items-center gap-2">
                <Zap className="w-4 h-4 fill-current" />
                <span>Cotes Boostées</span>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="text-xs font-bold hover:underline"
              >
                Tous les matchs ({matches.length}) →
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1.5 snap-x">
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
                    className="snap-start shrink-0 w-[300px] sm:w-[320px] rounded-xl bg-gradient-to-b from-[#3d4450] to-[#23252a] border border-zinc-700/60 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MiniSportBall slug={m.sportSlug} />
                        <span className="rounded bg-[#159ce4] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                          BOOSTED ODDS
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-300">
                        <span className="truncate font-medium">
                          {m.competitionName}
                        </span>
                        <span className="font-mono-tabular text-zinc-200 shrink-0">{dtFormatted}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectMatch(m.id)}
                        className="block w-full text-left font-heading text-[13px] font-bold text-white hover:text-[#f5b800] leading-snug"
                      >
                        {m.homeTeam.name} vs. {m.awayTeam.name}
                      </button>

                      <div className="space-y-0.5 pt-0.5">
                        <p className="text-xs text-zinc-300 truncate">{mkt.marketType}</p>
                        <p className="text-xs font-semibold text-white truncate">{mkt.selectionName}</p>
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
                      className={`w-full rounded-lg py-2.5 px-3 flex items-center justify-center gap-2 font-mono-tabular text-xs transition-colors ${
                        active
                          ? 'bg-[#f5b800] text-[#111111] font-bold'
                          : 'bg-[#dedee2] hover:bg-white text-[#111111]'
                      }`}
                    >
                      <span
                        className={`line-through ${
                          active ? 'text-[#111111]/60' : 'text-zinc-500'
                        }`}
                      >
                        {baseOdd.toFixed(2)}
                      </span>
                      <ChevronsRight
                        className={`w-4 h-4 ${active ? 'text-[#111111]' : 'text-[#159ce4]'}`}
                      />
                      <span className="font-extrabold text-sm">{mkt.simulatedOdds.toFixed(2)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 8. Quick League Tabs + Matchboard */}
        {leagueShortcuts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCompetition('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedCompetition === 'all'
                  ? 'bg-[#f5b800] text-[#111111] font-bold'
                  : 'bg-[#222225] text-zinc-200 hover:text-white'
              }`}
            >
              All Leagues
            </button>
            {leagueShortcuts.map((ls) => {
              const active = selectedCompetition === ls.slug;
              return (
                <button
                  key={ls.slug}
                  type="button"
                  onClick={() => setSelectedCompetition(active ? 'all' : ls.slug)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#f5b800] text-[#111111] font-bold'
                      : 'bg-[#222225] text-zinc-200 hover:text-white'
                  }`}
                >
                  {ls.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Matchboard List */}
        <section className="rounded-xl border border-zinc-800/80 bg-[#1a1a1d] overflow-hidden">
          {(selectedDateOffset !== 'all' || selectedCompetition !== 'all'
            ? filteredMatches
            : boostedMatches
          ).length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-300">
              No matches matched your filter.{' '}
              <button
                type="button"
                onClick={() => {
                  setSelectedDateOffset('all');
                  setSelectedCompetition('all');
                }}
                className="text-[#f5b800] underline ml-1 font-semibold"
              >
                Show All Matches
              </button>
            </div>
          ) : (
            (selectedDateOffset !== 'all' || selectedCompetition !== 'all'
              ? filteredMatches
              : boostedMatches
            ).map((match) => (
              <MatchRow key={match.id} match={match} onSelectMatch={onSelectMatch} />
            ))
          )}
        </section>

        {/* Footer */}
        <footer className="rounded-xl border border-zinc-800/80 bg-[#1a1a1d] p-4 text-xs text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#f5b800] shrink-0 mt-0.5" />
            <span>
              SPORTZONE · Real-time synchronized scoreboard, Bet Builder & virtual DT sportsbook simulation.
            </span>
          </div>
          <span className="font-mono-tabular text-zinc-500 shrink-0">© 2026 SPORTZONE</span>
        </footer>
      </div>
    );
  }

  // Dedicated Live / Sport Schedule View
  const pageTitle =
    route === 'live'
      ? 'Live & Real Match Schedule'
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3.5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2 uppercase tracking-wide">
            <LayoutGrid className="w-5 h-5 text-[#f5b800]" />
            <span>{pageTitle}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {filteredMatches.length} real-time matches · {liveMatches.length} live · Click BB for Bet Builder
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 p-1 bg-[#222225] border border-zinc-800 rounded-lg">
          {(['all', 'live', 'upcoming', 'finished'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md font-heading text-xs font-bold capitalize transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st ? 'bg-[#f5b800] text-[#111111]' : 'text-zinc-300 hover:text-white'
              }`}
            >
              {st}
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
              aria-label="Filter by sport"
              className="rounded-lg border border-zinc-700 bg-[#222225] px-3 py-2 text-xs text-zinc-100 focus:border-[#f5b800] focus:outline-none"
            >
              <option value="all">All Sports</option>
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
            aria-label="Filter by competition"
            className="rounded-lg border border-zinc-700 bg-[#222225] px-3 py-2 text-xs text-zinc-100 focus:border-[#f5b800] focus:outline-none"
          >
            <option value="all">All Competitions</option>
            {visibleCompetitions.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="relative md:hidden">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search teams..."
              className="rounded-lg border border-zinc-700 bg-[#222225] pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="rounded-xl border border-zinc-800/80 bg-[#1a1a1d] overflow-hidden">
        {filteredMatches.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">No matches found for this filter</p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSelectedCompetition('all');
                setSelectedSportFilter('all');
                setSelectedDateOffset('all');
                onSearchChange('');
              }}
              className="px-4 py-2 rounded-lg bg-[#f5b800] text-[#111111] font-bold text-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredMatches.map((match) => (
            <MatchRow key={match.id} match={match} onSelectMatch={onSelectMatch} />
          ))
        )}
      </div>
    </div>
  );
}
