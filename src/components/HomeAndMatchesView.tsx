import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronUp,
  CircleDot,
  Disc,
  Gamepad2,
  Gift,
  Globe,
  Home,
  LayoutGrid,
  PlayCircle,
  Radio,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';
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
    badge: 'LIVE FOOTBALL',
    title: 'FOOTBALL LIVE ARENA',
    subtitle: 'Premier League · LaLiga · Serie A · Bundesliga · Ligue 1',
    route: 'sport-football' as AppRoute,
  },
  {
    image: '/src/assets/images/arena_basketball_1795300797347.jpg',
    badge: 'NBA LIVE',
    title: 'BASKETBALL COURTSIDE',
    subtitle: 'Real-Time Scoreboard · Player Props · Team Totals',
    route: 'sport-basketball' as AppRoute,
  },
  {
    image: '/src/assets/images/court_tennis_1795300798703.jpg',
    badge: 'ATP / WTA',
    title: 'GRAND SLAM TENNIS',
    subtitle: 'Set Winners · Match Games · Live In-Play Odds',
    route: 'sport-tennis' as AppRoute,
  },
];

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
  const { toggleSelection, isSelected } = useSlip();
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('all');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('all');
  const [selectedDateOffset, setSelectedDateOffset] = useState<number | 'all'>('all');
  const [favOpen, setFavOpen] = useState(false);
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
      .slice(0, 10);
  }, [matches]);

  const boostedMatches = useMemo(() => {
    const liveOrFeat = matches.filter((m) => m.status === 'live' || (m.status === 'upcoming' && m.featured));
    return (liveOrFeat.length > 0 ? liveOrFeat : filteredMatches).slice(0, 18);
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
      const one = m.markets.find((mk) => (mk.marketType === '1×2' || mk.marketType === '1X2') && mk.selectionName === '1');
      const picked = idx % 3 === 0 ? total || one || m.markets[0] : idx % 3 === 1 ? dc || one || m.markets[0] : one || m.markets[0];
      const baseOdd = Math.max(1.05, Math.round((picked.simulatedOdds / 1.09) * 100) / 100);
      return { match: m, market: picked, baseOdd };
    });
  }, [matches]);

  const leagueShortcuts = useMemo(() => {
    const wanted = [
      { label: 'Tunisia · Ligue I', match: (c: CompetitionItem) => /tunisia/i.test(c.country) },
      { label: 'Bundesliga', match: (c: CompetitionItem) => /germany/i.test(c.country) && /^bundesliga$/i.test(c.name) },
      { label: '2. Bundesliga', match: (c: CompetitionItem) => /germany/i.test(c.country) && /2\.\s*bundesliga/i.test(c.name) },
      { label: '3. Liga', match: (c: CompetitionItem) => /germany/i.test(c.country) && /3\.\s*liga/i.test(c.name) },
      { label: 'Premier League', match: (c: CompetitionItem) => /england/i.test(c.country) && /premier league/i.test(c.name) },
      { label: 'La Liga', match: (c: CompetitionItem) => /spain/i.test(c.country) && /la\s*liga/i.test(c.name) },
      { label: 'Serie A', match: (c: CompetitionItem) => /italy/i.test(c.country) && /serie a/i.test(c.name) },
      { label: 'Ligue 1', match: (c: CompetitionItem) => /france/i.test(c.country) && /ligue 1/i.test(c.name) },
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
        <div className="h-32 rounded-lg bg-[#1b1b1e] animate-pulse" />
        <div className="h-11 rounded-lg bg-[#1b1b1e] animate-pulse" />
        <div className="h-44 rounded-lg bg-[#1b1b1e] animate-pulse" />
        <div className="h-64 rounded-lg bg-[#1b1b1e] animate-pulse" />
      </div>
    );
  }

  if (route === 'home') {
    const slide = CAROUSEL_SLIDES[slideIdx % CAROUSEL_SLIDES.length];

    return (
      <div className="space-y-3">
        {/* Compact Football Banner Carousel matching screenshot 5f64d28e */}
        <section className="relative h-28 sm:h-36 rounded-lg overflow-hidden bg-[#141416]">
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover opacity-55 transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e10]/95 via-[#0e0e10]/70 to-[#0e0e10]/35" />

          <button
            type="button"
            onClick={() => setSlideIdx((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length)}
            aria-label="Previous banner"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-[#111111] flex items-center justify-center shadow"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setSlideIdx((prev) => (prev + 1) % CAROUSEL_SLIDES.length)}
            aria-label="Next banner"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-[#111111] flex items-center justify-center shadow"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate(slide.route)}
            className="absolute inset-0 px-12 sm:px-14 flex flex-col items-center justify-center text-center"
          >
            <span className="font-display text-xl sm:text-3xl font-black tracking-wide uppercase text-white drop-shadow">
              {slide.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className="text-[#f5b800]">{slide.title.split(' ').slice(-1)[0]}</span>
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-200 mt-0.5 truncate max-w-full">
              {slide.subtitle}
            </span>
          </button>
        </section>

        {/* 5-Icon Bar matching 5f64d28e */}
        <div className="grid grid-cols-5 rounded-md bg-[#1d1d21] overflow-hidden">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center justify-center py-2.5 bg-[#26262b] text-[#f5b800]"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="flex items-center justify-center py-2.5 hover:bg-[#26262b] transition-colors"
            title="Live Matches"
          >
            <span className="rounded-xs bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold text-white tracking-wider uppercase">
              LIVE
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="flex items-center justify-center py-2.5 text-zinc-300 hover:text-white hover:bg-[#26262b] transition-colors"
            title="My Bets"
          >
            <Receipt className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="flex items-center justify-center py-2.5 text-zinc-300 hover:text-white hover:bg-[#26262b] transition-colors"
            title="Settings & Profile"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-football')}
            className="flex items-center justify-center py-2.5 font-heading text-xs font-extrabold text-zinc-200 hover:text-[#f5b800] hover:bg-[#26262b] transition-colors"
          >
            A-Z
          </button>
        </div>

        {/* Date Filter Pills matching 5f64d28e */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {dateTabs.map((d) => {
            const active = selectedDateOffset === d.offset;
            return (
              <button
                key={d.offset}
                type="button"
                onClick={() => setSelectedDateOffset(active ? 'all' : d.offset)}
                className={`px-3.5 py-2 rounded-md text-xs font-heading whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-[#2a2515] border border-[#f5b800] text-[#f5b800]'
                    : 'bg-[#1c1c20] text-zinc-400 hover:text-white'
                }`}
              >
                <span>{d.label}</span>
                <strong className="font-mono-tabular text-white font-bold">{d.dayNum}</strong>
              </button>
            );
          })}
          {selectedDateOffset !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedDateOffset('all')}
              className="px-3 py-2 rounded-md bg-[#1c1c20] text-xs font-semibold text-[#f5b800] whitespace-nowrap shrink-0"
            >
              All Days
            </button>
          )}
        </div>

        {/* FAVOURITES Full-Width Accordion matching 5f64d28e */}
        <div className="rounded-md bg-[#1c1c20] overflow-hidden">
          <button
            type="button"
            onClick={() => setFavOpen(!favOpen)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between font-heading text-xs font-extrabold tracking-wider uppercase text-[#f5b800]"
          >
            <span className="inline-flex items-center gap-2">
              <Star className="w-4 h-4 text-[#f5b800]" />
              <span>FAVOURITES</span>
            </span>
            {favOpen ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          {favOpen && (
            <div className="px-3.5 pb-3 pt-1 border-t border-zinc-800 flex flex-wrap gap-1.5">
              {competitions.filter((c) => c.featured).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCompetition(selectedCompetition === c.slug ? 'all' : c.slug)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    selectedCompetition === c.slug
                      ? 'bg-[#f5b800] text-[#111111]'
                      : 'bg-[#121214] text-zinc-300 hover:text-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Unboxed Horizontal Quick-Access Icon Strip matching 5f64d28e */}
        <div className="flex items-center justify-between gap-4 overflow-x-auto px-2 py-2 text-center">
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <Receipt className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">My Bets</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <PlayCircle className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">Live</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-football')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <Trophy className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">Soccer</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-basketball')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <CircleDot className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">Basketball</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-tennis')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <Disc className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">Tennis</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-volleyball')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <Globe className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">Volleyball</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sport-esports')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <Gamepad2 className="w-6 h-6" />
            <span className="text-[11px] font-medium whitespace-nowrap">Esports</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('promotions')}
            className="flex flex-col items-center gap-1.5 min-w-[54px] text-zinc-200 hover:text-[#f5b800] transition-colors shrink-0"
          >
            <Gift className="w-6 h-6 text-[#f5b800]" />
            <span className="text-[11px] font-medium whitespace-nowrap">Bonus</span>
          </button>
        </div>

        {/* Top Events Header + Horizontal Scroll Cards matching 5f64d28e */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between rounded-md bg-[#1c1c20] px-3.5 py-2.5">
            <div className="flex items-center gap-2 font-heading text-xs font-bold text-[#f5b800]">
              <Calendar className="w-4 h-4" />
              <span>Top Events</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 hover:text-[#f5b800] transition-colors whitespace-nowrap shrink-0"
            >
              <span className="rounded-xs bg-[#dc2626] px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                LIVE
              </span>
              <span>{liveMatches.length} Live →</span>
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x">
            {topEvents.map((m) => {
              const dt = new Date(m.startTime);
              const tStr = `${String(dt.getHours()).padStart(2, '0')}:${String(
                dt.getMinutes()
              ).padStart(2, '0')} ${String(dt.getDate()).padStart(2, '0')}/${String(
                dt.getMonth() + 1
              ).padStart(2, '0')}`;
              const quick =
                m.sportSlug === 'football'
                  ? m.markets.filter((mk) => mk.marketType === '1×2' || mk.marketType === '1X2').slice(0, 3)
                  : m.markets.filter((mk) => mk.marketType === 'Match Winner').slice(0, 2);

              return (
                <div
                  key={m.id}
                  className="snap-start shrink-0 w-[290px] sm:w-[310px] rounded-md bg-[#1a1a1d] border border-zinc-800/80 p-3 space-y-2.5"
                >
                  {/* Top meta line: Football icon + yellow BB + date + league */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <CircleDot className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                      <span className="rounded-xs bg-[#f5b800] px-1 py-0.5 text-[9px] font-black text-[#111111] leading-none shrink-0">
                        BB
                      </span>
                      {m.status === 'live' ? (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <span className="rounded-xs bg-[#dc2626] px-1 py-0.5 text-[9px] font-extrabold text-white">
                            LIVE
                          </span>
                          <span className="font-mono-tabular font-bold text-white">{m.matchTimer}</span>
                        </span>
                      ) : (
                        <span className="font-mono-tabular font-semibold text-zinc-200 shrink-0">{tStr}</span>
                      )}
                      <span className="text-zinc-500">•</span>
                      <span className="truncate text-zinc-400">
                        {m.competitionCountry ? `${m.competitionCountry} · ` : ''}
                        {m.competitionName}
                      </span>
                    </div>
                  </div>

                  {/* Team Circles (Jersey / Crest) + Matchup */}
                  <button
                    type="button"
                    onClick={() => onSelectMatch(m.id)}
                    className="w-full flex items-center justify-between gap-2.5 text-left hover:opacity-90"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TeamBadge
                          shortName={m.homeTeam.shortName}
                          color={m.homeTeam.logo}
                          size="md"
                          variant="jersey"
                        />
                        <TeamBadge
                          shortName={m.awayTeam.shortName}
                          color={m.awayTeam.logo}
                          size="md"
                          variant="jersey"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-xs font-bold text-white truncate">
                          {m.homeTeam.name}
                        </p>
                        <p className="font-heading text-xs font-bold text-white truncate mt-0.5">
                          {m.awayTeam.name}
                        </p>
                      </div>
                    </div>
                    {m.status === 'live' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono-tabular text-xs font-extrabold text-[#f5b800]">
                          {m.homeScore}:{m.awayScore}
                        </span>
                        <span className="rounded-sm border border-zinc-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          LIVE
                        </span>
                      </div>
                    ) : m.status === 'finished' ? (
                      <div className="font-mono-tabular text-xs font-bold text-zinc-400 shrink-0">
                        {m.homeScore}:{m.awayScore}
                      </div>
                    ) : null}
                  </button>

                  {/* Crisp Light Odds Buttons */}
                  <div className={`grid gap-1.5 ${quick.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {quick.map((mkt) => {
                      const active = isSelected(mkt.id);
                      return (
                        <button
                          key={mkt.id}
                          type="button"
                          disabled={m.status === 'finished'}
                          onClick={() =>
                            toggleSelection({
                              matchId: m.id,
                              marketId: mkt.id,
                              matchLabel: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
                              competitionName: m.competitionName,
                              marketType: mkt.marketType,
                              selectionName: mkt.selectionName,
                              simulatedOdds: mkt.simulatedOdds,
                              status: m.status,
                              startTime: m.startTime,
                            })
                          }
                          className={`flex items-center justify-between rounded px-2 py-2 text-xs transition-colors ${
                            m.status === 'finished'
                              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                              : active
                              ? 'bg-[#f5b800] text-[#111111] font-bold'
                              : 'bg-[#e8e8ea] hover:bg-white text-[#111111] font-medium'
                          }`}
                        >
                          <span className={`truncate text-[11px] ${active ? 'text-[#111111]/85' : 'text-zinc-500'}`}>
                            {mkt.selectionName}
                          </span>
                          <span className="font-mono-tabular font-bold shrink-0">
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

        {/* Solid Gold Boosted Odds Full-Width Bar + Horizontal Cards matching screenshot 0cabe743 */}
        <section className="space-y-2.5">
          <div className="rounded-md bg-[#f5b800] text-[#111111] px-3.5 py-2.5 flex items-center justify-between font-heading font-extrabold text-sm">
            <span className="inline-flex items-center gap-2">
              <Zap className="w-4 h-4 fill-current" />
              <span>Boosted Odds</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="text-xs font-bold hover:underline"
            >
              All Matches ({matches.length}) →
            </button>
          </div>

          {boostedCardItems.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x">
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
                    className="snap-start shrink-0 w-[275px] sm:w-[290px] rounded-lg bg-gradient-to-b from-[#2c313b] to-[#1a1b20] border border-zinc-700/60 p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CircleDot className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                        <span className="rounded-sm bg-[#169be6] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                          BOOSTED ODDS
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                        <span className="truncate font-medium">
                          {m.competitionCountry ? `${m.competitionCountry} · ` : ''}
                          {m.competitionName}
                        </span>
                        <span className="font-mono-tabular text-zinc-300 shrink-0">{dtFormatted}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectMatch(m.id)}
                        className="block w-full text-left font-heading text-xs font-bold text-white hover:text-[#f5b800] truncate"
                      >
                        {m.homeTeam.name} vs. {m.awayTeam.name}
                      </button>

                      <div className="space-y-0.5 pt-0.5">
                        <p className="text-[11px] text-zinc-400 truncate">{mkt.marketType}</p>
                        <p className="text-xs font-semibold text-white truncate">{mkt.selectionName}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggleSelection({
                          matchId: m.id,
                          marketId: mkt.id,
                          matchLabel: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
                          competitionName: m.competitionName,
                          marketType: mkt.marketType,
                          selectionName: mkt.selectionName,
                          simulatedOdds: mkt.simulatedOdds,
                          status: m.status,
                          startTime: m.startTime,
                        })
                      }
                      className={`w-full rounded-md py-2 px-3 flex items-center justify-center gap-2 font-mono-tabular text-xs transition-colors ${
                        active
                          ? 'bg-[#f5b800] text-[#111111] font-bold'
                          : 'bg-[#dedee2] hover:bg-white text-[#111111]'
                      }`}
                    >
                      <span className={`line-through ${active ? 'text-[#111111]/60' : 'text-zinc-500'}`}>
                        {baseOdd.toFixed(2)}
                      </span>
                      <ChevronsRight
                        className={`w-3.5 h-3.5 ${active ? 'text-[#111111]' : 'text-[#169be6]'}`}
                      />
                      <span className="font-extrabold text-sm">{mkt.simulatedOdds.toFixed(2)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Tunisia & Germany + Major League Tabs */}
        {leagueShortcuts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCompetition('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedCompetition === 'all'
                  ? 'bg-[#f5b800] text-[#111111] font-bold'
                  : 'bg-[#1c1c20] text-zinc-300 hover:text-white'
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
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#f5b800] text-[#111111] font-bold'
                      : 'bg-[#1c1c20] text-zinc-300 hover:text-white'
                  }`}
                >
                  {ls.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Live & Scheduled Football / Sports Matchboard */}
        <section className="rounded-md border border-zinc-800/80 bg-[#17171a] overflow-hidden">
          {(selectedDateOffset !== 'all' || selectedCompetition !== 'all' ? filteredMatches : boostedMatches)
            .length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No matches matched your filter.{' '}
              <button
                type="button"
                onClick={() => {
                  setSelectedDateOffset('all');
                  setSelectedCompetition('all');
                }}
                className="text-[#f5b800] underline ml-1"
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
        <footer className="rounded-md border border-zinc-800/80 bg-[#17171a] p-3.5 text-xs text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#f5b800] shrink-0 mt-0.5" />
            <span>
              SPORTZONE · Real-time synchronized scoreboard & virtual DT sportsbook simulation.
            </span>
          </div>
          <span className="font-mono-tabular text-zinc-500 shrink-0">© 2026 SPORTZONE</span>
        </footer>
      </div>
    );
  }

  // Live Matches & Sport Category Views
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
            {filteredMatches.length} real-time matches · {liveMatches.length} live
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 p-1 bg-[#1a1a1d] border border-zinc-800 rounded-md">
          {(['all', 'live', 'upcoming', 'finished'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded font-heading text-xs font-bold capitalize transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-[#f5b800] text-[#111111]'
                  : 'text-zinc-400 hover:text-white'
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
              className="rounded-md border border-zinc-700 bg-[#1a1a1d] px-3 py-2 text-xs text-zinc-200 focus:border-[#f5b800] focus:outline-none"
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
            className="rounded-md border border-zinc-700 bg-[#1a1a1d] px-3 py-2 text-xs text-zinc-200 focus:border-[#f5b800] focus:outline-none"
          >
            <option value="all">All Competitions</option>
            {visibleCompetitions.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="relative sm:hidden">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search teams..."
              className="rounded-md border border-zinc-700 bg-[#1a1a1d] pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500"
            />
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="rounded-md border border-zinc-800/80 bg-[#17171a] overflow-hidden">
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
              className="px-4 py-2 rounded-md bg-[#f5b800] text-[#111111] font-bold text-xs"
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
