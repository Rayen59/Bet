import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Disc,
  Flame,
  Gamepad2,
  Globe,
  LayoutGrid,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import heroFootballImg from '../assets/images/hero_stadium_night_1795300798312.jpg';
import heroBasketballImg from '../assets/images/arena_basketball_1795300797347.jpg';
import heroTennisImg from '../assets/images/court_tennis_1795300798703.jpg';
import heroEsportsImg from '../assets/images/stage_esports_1795300797987.jpg';
import { useAuth } from '../context/AuthContext';
import { useSlip } from '../context/SlipContext';
import { AppRoute, CompetitionItem, MatchItem, SportItem } from '../types/sportzone';
import { CompetitionCountryBadge, TeamBadge } from './BrandLogo';
import { MatchRow } from './MatchRow';

interface HomeAndMatchesViewProps {
  route: AppRoute;
  matches: MatchItem[];
  sports: SportItem[];
  competitions: CompetitionItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCompetitionSlug?: string;
  onSelectCompetitionSlug?: (slug: string) => void;
  onNavigate: (route: AppRoute) => void;
  onSelectMatch: (matchId: number) => void;
}

export function SportLogoIcon({ slug, className = 'w-4 h-4' }: { slug: string; className?: string }) {
  if (slug === 'basketball') return <CircleDot className={`${className} text-amber-500 shrink-0`} />;
  if (slug === 'tennis') return <Disc className={`${className} text-emerald-500 shrink-0`} />;
  if (slug === 'volleyball') return <Globe className={`${className} text-sky-500 shrink-0`} />;
  if (slug === 'esports') return <Gamepad2 className={`${className} text-violet-500 shrink-0`} />;
  return <Trophy className={`${className} text-[#1472e5] shrink-0`} />;
}

interface HeroSlide {
  id: string;
  image: string;
  tag: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  targetRoute: AppRoute;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'football',
    image: heroFootballImg,
    tag: 'FOOTBALL LIVE · LIGUES PRO',
    title: 'MYBET SPORTSBOOK PRO',
    subtitle: 'Premier League, Bundesliga, Champions League & Ligue 1 Tunisie avec cotes instantanées et Bet Builder.',
    ctaLabel: 'Parier en Direct',
    targetRoute: 'live',
  },
  {
    id: 'basketball',
    image: heroBasketballImg,
    tag: 'NBA · EUROLEAGUE · PRO A',
    title: 'ACTION NON-STOP BASKET',
    subtitle: 'Suivez chaque quart-temps en direct avec cotes Moneyline, Handicap et Totaux Points actualisés.',
    ctaLabel: 'Voir Basketball',
    targetRoute: 'sport-basketball',
  },
  {
    id: 'tennis',
    image: heroTennisImg,
    tag: 'ATP MASTERS · WTA TOUR',
    title: 'GRAND CHELEM & ATP LIVE',
    subtitle: 'Vainqueur match, vainqueur set et jeux totaux en temps réel sur tous les courts.',
    ctaLabel: 'Voir Tennis',
    targetRoute: 'sport-tennis',
  },
  {
    id: 'esports',
    image: heroEsportsImg,
    tag: 'CS2 · LOL · VALORANT',
    title: 'ARÈNE ESPORTS & VOLLEY',
    subtitle: 'Matchs internationaux Esports et CEV Champions League Volleyball prêts pour vos combinés.',
    ctaLabel: 'Voir Esports',
    targetRoute: 'sport-esports',
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
  selectedCompetitionSlug,
  onSelectCompetitionSlug,
  onNavigate,
  onSelectMatch,
}: HomeAndMatchesViewProps) {
  const { user } = useAuth();
  const { toggleSelection, isSelected, getMatchSelections } = useSlip();

  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [internalComp, setInternalComp] = useState<string>('all');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('all');
  const [selectedDateOffset, setSelectedDateOffset] = useState<number | 'all'>('all');
  const [leagueSearchText, setLeagueSearchText] = useState('');
  const [leaguePickerOpen, setLeaguePickerOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(48);
  const [heroSlideIdx, setHeroSlideIdx] = useState<number>(0);

  const selectedCompetition = selectedCompetitionSlug ?? internalComp;
  const setSelectedCompetition = (slug: string) => {
    setInternalComp(slug);
    onSelectCompetitionSlug?.(slug);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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

  // Defensive client-side deduplication by sport + normalized home/away team pair
  const uniqueMatches = useMemo(() => {
    const seen = new Set<string>();
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    return matches.filter((m) => {
      const key = `${m.sportSlug}:${norm(m.homeTeam.name)}:${norm(m.awayTeam.name)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [matches]);

  const leagueDirectory = useMemo(() => {
    const counts = new Map<
      string,
      {
        slug: string;
        name: string;
        country: string;
        sportSlug: string;
        total: number;
        live: number;
      }
    >();

    for (const m of uniqueMatches) {
      if (activeSportSlug !== 'all' && m.sportSlug !== activeSportSlug) continue;
      const slug = m.competitionSlug || m.competitionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const existing = counts.get(slug);
      if (existing) {
        existing.total += 1;
        if (m.status === 'live') existing.live += 1;
      } else {
        counts.set(slug, {
          slug,
          name: m.competitionName || 'Compétition',
          country: m.competitionCountry || 'International',
          sportSlug: m.sportSlug,
          total: 1,
          live: m.status === 'live' ? 1 : 0,
        });
      }
    }

    // Also include catalog competitions that match active sport
    for (const c of competitions) {
      const sp = sports.find((s) => s.id === c.sportId);
      if (activeSportSlug !== 'all' && sp?.slug !== activeSportSlug) continue;
      if (!counts.has(c.slug) && uniqueMatches.some((m) => m.competitionSlug === c.slug)) {
        counts.set(c.slug, {
          slug: c.slug,
          name: c.name,
          country: c.country,
          sportSlug: sp?.slug || 'football',
          total: 0,
          live: 0,
        });
      }
    }

    return Array.from(counts.values()).sort((a, b) => {
      if (b.live !== a.live) return b.live - a.live;
      return b.total - a.total;
    });
  }, [uniqueMatches, competitions, sports, activeSportSlug]);

  const filteredLeagueDirectory = useMemo(() => {
    const q = leagueSearchText.trim().toLowerCase();
    if (!q) return leagueDirectory;
    return leagueDirectory.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q) ||
        l.sportSlug.toLowerCase().includes(q)
    );
  }, [leagueDirectory, leagueSearchText]);

  const filteredMatches = useMemo(() => {
    const today = new Date();
    return uniqueMatches.filter((m) => {
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
        const hay = `${m.homeTeam.name} ${m.awayTeam.name} ${m.competitionName} ${m.competitionCountry} ${m.sportName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [uniqueMatches, activeSportSlug, selectedCompetition, statusFilter, selectedDateOffset, searchQuery]);

  const liveMatches = useMemo(() => uniqueMatches.filter((m) => m.status === 'live'), [uniqueMatches]);

  const topEvents = useMemo(() => {
    const open = uniqueMatches.filter((m) => m.status !== 'finished');
    const pool = open.length > 0 ? open : uniqueMatches;
    return [...pool]
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        const aTunGer = /tunisi|germany|europe/i.test(a.competitionCountry || '') ? 1 : 0;
        const bTunGer = /tunisi|germany|europe/i.test(b.competitionCountry || '') ? 1 : 0;
        if (aTunGer !== bTunGer) return bTunGer - aTunGer;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      })
      .slice(0, 12);
  }, [uniqueMatches]);

  const boostedCardItems = useMemo(() => {
    const openPool = uniqueMatches.filter((m) => m.status !== 'finished' && m.markets.length > 0);
    const prioritized = [...openPool].sort((a, b) => {
      const aScore =
        (/tunisi|germany|england|spain|italy|europe/i.test(a.competitionCountry || '') ? 2 : 0) +
        (a.status === 'live' ? 1 : 0);
      const bScore =
        (/tunisi|germany|england|spain|italy|europe/i.test(b.competitionCountry || '') ? 2 : 0) +
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
  }, [uniqueMatches]);

  // Group displayed matches by Championship for 1xBet / MyBet league-table layout
  const hasActiveFilter =
    selectedDateOffset !== 'all' ||
    selectedCompetition !== 'all' ||
    selectedSportFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const displayedMatches = useMemo(() => {
    if (route !== 'home' || hasActiveFilter) return filteredMatches;
    return filteredMatches.slice(0, visibleLimit);
  }, [route, hasActiveFilter, filteredMatches, visibleLimit]);

  const groupedByCompetition = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        country: string;
        sportSlug: string;
        items: MatchItem[];
      }
    >();
    for (const m of displayedMatches) {
      const key = `${m.sportSlug}::${m.competitionSlug || m.competitionName}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(m);
      } else {
        groups.set(key, {
          key,
          name: m.competitionName || 'Compétition',
          country: m.competitionCountry || 'International',
          sportSlug: m.sportSlug,
          items: [m],
        });
      }
    }
    return Array.from(groups.values());
  }, [displayedMatches]);

  const selectedCompObj = leagueDirectory.find((l) => l.slug === selectedCompetition);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-44 rounded-2xl bg-[#091b35] animate-pulse" />
        <div className="h-14 rounded-xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const activeSlide = HERO_SLIDES[heroSlideIdx];

  const renderSearchAndChampionshipBar = () => (
    <section className="rounded-2xl border border-slate-300 bg-white p-3.5 sm:p-4 shadow-xs space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Search by Team / Player / Match */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#1472e5] absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un match, une équipe, un joueur..."
            className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-10 pr-8 py-2.5 text-xs sm:text-[13px] font-bold text-slate-950 placeholder-slate-500 focus:border-[#1472e5] focus:bg-white focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 p-1 rounded-md text-slate-500 hover:text-slate-900"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dedicated Search-by-Championship Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLeaguePickerOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-[#091b35] hover:bg-[#102b52] text-white px-3.5 py-2.5 text-xs sm:text-[13px] font-extrabold transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <Trophy className="w-4 h-4 text-[#facc15] shrink-0" />
              <span className="truncate">
                {selectedCompObj
                  ? `${selectedCompObj.name} (${selectedCompObj.total})`
                  : `Rechercher par Championnat (${leagueDirectory.length})`}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${leaguePickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {leaguePickerOpen && (
            <div className="absolute right-0 left-0 top-full mt-1.5 z-30 rounded-xl border border-slate-300 bg-white shadow-2xl overflow-hidden">
              <div className="p-2.5 border-b border-slate-200 bg-slate-50">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={leagueSearchText}
                    onChange={(e) => setLeagueSearchText(e.target.value)}
                    placeholder="Taper nom du championnat ou pays (ex: Bundesliga, Tunisie, ATP)..."
                    className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:border-[#1472e5] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCompetition('all');
                    setLeaguePickerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-extrabold text-left hover:bg-blue-50 ${
                    selectedCompetition === 'all' ? 'bg-blue-50 text-[#1472e5]' : 'text-slate-900'
                  }`}
                >
                  <span>Tous les championnats</span>
                  <span className="font-mono-tabular text-slate-500">{uniqueMatches.length}</span>
                </button>
                {filteredLeagueDirectory.length === 0 ? (
                  <p className="p-4 text-center text-xs font-bold text-slate-500">
                    Aucun championnat trouvé pour &quot;{leagueSearchText}&quot;
                  </p>
                ) : (
                  filteredLeagueDirectory.map((lg) => (
                    <button
                      key={lg.slug}
                      type="button"
                      onClick={() => {
                        setSelectedCompetition(lg.slug);
                        setLeaguePickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-extrabold text-left hover:bg-blue-50 transition-colors ${
                        selectedCompetition === lg.slug ? 'bg-blue-50 text-[#1472e5]' : 'text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <CompetitionCountryBadge country={lg.country} />
                        <span className="truncate">{lg.name}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 font-mono-tabular">
                        {lg.live > 0 && (
                          <span className="rounded bg-[#dc2626] text-white px-1.5 py-0.5 text-[10px] font-black">
                            {lg.live} LIVE
                          </span>
                        )}
                        <span className="text-slate-600">{lg.total}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Championship Pills */}
      {leagueDirectory.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 shrink-0 mr-1">
            Ligues :
          </span>
          <button
            type="button"
            onClick={() => setSelectedCompetition('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors ${
              selectedCompetition === 'all'
                ? 'bg-[#1472e5] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            Toutes
          </button>
          {leagueDirectory.slice(0, 10).map((lg) => {
            const active = selectedCompetition === lg.slug;
            return (
              <button
                key={lg.slug}
                type="button"
                onClick={() => setSelectedCompetition(active ? 'all' : lg.slug)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#1472e5] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <CompetitionCountryBadge country={lg.country} />
                <span>{lg.name}</span>
                <span className={`font-mono-tabular text-[11px] ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                  ({lg.total})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderGroupedMatchBoard = (items: MatchItem[]) => {
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-300 bg-white p-10 text-center space-y-3 shadow-xs">
          <p className="text-sm font-extrabold text-slate-800">
            Aucun match ne correspond à vos filtres actuels.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedDateOffset('all');
              setSelectedCompetition('all');
              setSelectedSportFilter('all');
              setStatusFilter('all');
              setLeagueSearchText('');
              onSearchChange('');
            }}
            className="rounded-xl bg-[#1472e5] hover:bg-[#0e5ec2] text-white font-extrabold px-5 py-2.5 text-xs"
          >
            Réinitialiser tous les filtres
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3.5">
        {groupedByCompetition.map((grp) => (
          <div
            key={grp.key}
            className="rounded-2xl border border-slate-300 bg-white overflow-hidden shadow-xs"
          >
            {/* 1xBet / MyBet Navy League Header Bar with 1 | X | 2 Column Indicators */}
            <div className="bg-gradient-to-r from-[#091b35] via-[#0e284e] to-[#133568] px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-white">
              <button
                type="button"
                onClick={() => {
                  const found = leagueDirectory.find((l) => l.name === grp.name);
                  if (found) setSelectedCompetition(found.slug);
                }}
                className="flex items-center gap-2 min-w-0 text-left hover:opacity-90"
              >
                <SportLogoIcon slug={grp.sportSlug} className="w-4 h-4" />
                <CompetitionCountryBadge country={grp.country} />
                <span className="font-heading text-xs sm:text-[13px] font-black uppercase tracking-wide truncate">
                  {grp.name}
                </span>
                <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-blue-100 shrink-0">
                  {grp.items.length}
                </span>
              </button>

              <div className="hidden lg:flex items-center gap-2 shrink-0 pr-[72px]">
                <div
                  className={`grid gap-1.5 text-center font-mono-tabular text-[11px] font-black text-blue-100 ${
                    grp.sportSlug === 'football' ? 'grid-cols-3 w-[276px]' : 'grid-cols-2 w-[200px]'
                  }`}
                >
                  <span>1</span>
                  {grp.sportSlug === 'football' && <span>X</span>}
                  <span>2</span>
                </div>
              </div>
            </div>

            <div>
              {grp.items.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  onSelectMatch={onSelectMatch}
                  compactLeagueHeader
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (route === 'home') {
    return (
      <div className="space-y-4">
        {/* 1. Animated Multi-Sport Hero Carousel (1xBet / MyBet Command Banner) */}
        <section className="relative rounded-2xl overflow-hidden bg-[#091b35] border border-[#1a3a6b] shadow-md min-h-[200px] sm:min-h-[235px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0"
            >
              <img
                src={activeSlide.image}
                alt={activeSlide.title}
                className="w-full h-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#061327]/95 via-[#091b35]/85 to-[#091b35]/40" />
            </motion.div>
          </AnimatePresence>

          <div className="relative z-10 p-5 sm:p-7 flex flex-col justify-between min-h-[200px] sm:min-h-[235px] gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-md bg-[#1472e5]/90 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#facc15]" />
                <span>{activeSlide.tag}</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight leading-none uppercase">
                {activeSlide.title}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed max-w-xl">
                {activeSlide.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {user?.role !== 'admin' ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('recharge')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-black px-5 py-2.5 text-xs sm:text-sm shadow-md transition-all active:scale-95"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>+ DÉPOSER (1 TICKET = 1.200 DT)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate('admin')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-black px-5 py-2.5 text-xs sm:text-sm shadow-md"
                  >
                    <span>Console Administrateur</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate(activeSlide.targetRoute)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1472e5] hover:bg-[#0e5ec2] text-white font-black px-4 py-2.5 text-xs sm:text-sm shadow-md transition-all"
                >
                  <Radio className="w-4 h-4 text-[#facc15]" />
                  <span>
                    {activeSlide.ctaLabel} ({liveMatches.length} LIVE)
                  </span>
                </button>
              </div>

              {/* Carousel Indicators */}
              <div className="flex items-center gap-1.5">
                {HERO_SLIDES.map((sl, idx) => (
                  <button
                    key={sl.id}
                    type="button"
                    onClick={() => setHeroSlideIdx(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      idx === heroSlideIdx ? 'w-7 bg-[#facc15]' : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Animated Live Ticker Marquee */}
        {topEvents.length > 0 && (
          <div className="rounded-xl border border-[#173665] bg-[#091b35] text-white overflow-hidden shadow-xs flex items-center">
            <div className="bg-[#dc2626] px-3 py-2 font-mono-tabular text-[11px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1.5 z-10">
              <Zap className="w-3.5 h-3.5 text-[#facc15]" />
              <span>FLASH LIVE</span>
            </div>
            <div className="overflow-hidden flex-1 py-1.5">
              <div className="animate-ticker flex items-center gap-5 px-4">
                {[...topEvents, ...topEvents].map((ev, idx) => (
                  <button
                    key={`${ev.id}_${idx}`}
                    type="button"
                    onClick={() => onSelectMatch(ev.id)}
                    className="inline-flex items-center gap-2 text-xs font-extrabold whitespace-nowrap hover:text-[#38bdf8] transition-colors"
                  >
                    <SportLogoIcon slug={ev.sportSlug} className="w-3.5 h-3.5" />
                    <span className="text-slate-300">{ev.homeTeam.shortName}</span>
                    <span className="rounded bg-[#1472e5] px-1.5 py-0.5 font-mono-tabular text-[11px] font-black text-[#facc15]">
                      {ev.status === 'upcoming' ? 'VS' : `${ev.homeScore}:${ev.awayScore}`}
                    </span>
                    <span className="text-slate-300">{ev.awayTeam.shortName}</span>
                    {ev.status === 'live' && (
                      <span className="text-[10px] font-black text-rose-400">{ev.matchTimer}</span>
                    )}
                    <span className="text-white/25">|</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Search & Search-by-Championship Panel */}
        {renderSearchAndChampionshipBar()}

        {/* 4. Sport & Status Filter Strip */}
        <section className="rounded-2xl border border-slate-300 bg-white p-3.5 sm:p-4 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedSportFilter('all');
                setSelectedCompetition('all');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                selectedSportFilter === 'all'
                  ? 'bg-[#091b35] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tous ({uniqueMatches.length})</span>
            </button>
            {sports.map((sp) => {
              const active = selectedSportFilter === sp.slug;
              const spCount = uniqueMatches.filter((m) => m.sportSlug === sp.slug).length;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    setSelectedSportFilter(active ? 'all' : sp.slug);
                    setSelectedCompetition('all');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                    active
                      ? 'bg-[#1472e5] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <SportLogoIcon slug={sp.slug} className="w-3.5 h-3.5" />
                  <span>{sp.name}</span>
                  <span className={`font-mono-tabular text-[11px] ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                    ({spCount})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                    statusFilter === st.id
                      ? st.id === 'live'
                        ? 'bg-[#dc2626] text-white'
                        : 'bg-[#1472e5] text-white'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                      active
                        ? 'bg-[#091b35] text-white'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {d.label} {d.dayNum}
                  </button>
                );
              })}
            </div>

            <span className="font-mono-tabular text-xs font-black text-slate-700 shrink-0">
              {filteredMatches.length} événement(s)
            </span>
          </div>
        </section>

        {/* 5. Top Événements Quick Matchup Strip */}
        {topEvents.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg sm:text-xl font-black uppercase text-[#091b35] flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#dc2626]" />
                <span>Affiches &amp; Directs Populaires</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="text-xs font-black text-[#1472e5] hover:underline inline-flex items-center gap-0.5"
              >
                <span>Tout voir</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1.5">
              {topEvents.slice(0, 8).map((m) => {
                const mainMkt =
                  m.sportSlug === 'football'
                    ? m.markets.filter((mk) => mk.marketType === '1×2' || mk.marketType === '1X2').slice(0, 3)
                    : m.markets.filter((mk) => mk.marketType === 'Match Winner').slice(0, 2);
                const picks = getMatchSelections(m.id);
                return (
                  <motion.div
                    key={m.id}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                    className="min-w-[270px] max-w-[270px] rounded-2xl border border-slate-300 bg-white overflow-hidden shadow-xs shrink-0 flex flex-col justify-between"
                  >
                    <div className="bg-[#091b35] px-3 py-2 flex items-center justify-between gap-2 text-white">
                      <span className="flex items-center gap-1.5 min-w-0 text-[11px] font-extrabold truncate">
                        <SportLogoIcon slug={m.sportSlug} className="w-3.5 h-3.5" />
                        <span className="truncate">{m.competitionName}</span>
                      </span>
                      {m.status === 'live' ? (
                        <span className="rounded bg-[#dc2626] px-1.5 py-0.5 font-mono-tabular text-[10px] font-black text-white shrink-0">
                          {m.matchTimer}
                        </span>
                      ) : (
                        <span className="font-mono-tabular text-[10px] font-extrabold text-blue-200 shrink-0">
                          {new Date(m.startTime).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </span>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectMatch(m.id)}
                        className="w-full text-left space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <TeamBadge shortName={m.homeTeam.shortName} color={m.homeTeam.logo} size="sm" />
                            <span className="font-heading text-xs font-black text-slate-950 truncate">
                              {m.homeTeam.name}
                            </span>
                          </span>
                          <span className="font-mono-tabular text-sm font-black text-[#091b35]">
                            {m.status === 'upcoming' ? '–' : m.homeScore}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <TeamBadge shortName={m.awayTeam.shortName} color={m.awayTeam.logo} size="sm" />
                            <span className="font-heading text-xs font-black text-slate-950 truncate">
                              {m.awayTeam.name}
                            </span>
                          </span>
                          <span className="font-mono-tabular text-sm font-black text-[#091b35]">
                            {m.status === 'upcoming' ? '–' : m.awayScore}
                          </span>
                        </div>
                      </button>

                      <div className={`grid gap-1.5 ${mainMkt.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        {mainMkt.map((mk) => {
                          const active = isSelected(mk.id);
                          const label =
                            mk.selectionName === m.homeTeam.name
                              ? '1'
                              : mk.selectionName === m.awayTeam.name
                              ? '2'
                              : mk.selectionName;
                          return (
                            <button
                              key={mk.id}
                              type="button"
                              onClick={() =>
                                toggleSelection(
                                  {
                                    matchId: m.id,
                                    marketId: mk.id,
                                    matchLabel: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
                                    competitionName: m.competitionName,
                                    marketType: mk.marketType,
                                    selectionName: mk.selectionName,
                                    simulatedOdds: mk.simulatedOdds,
                                    status: m.status,
                                    startTime: m.startTime,
                                  },
                                  { homeName: m.homeTeam.name, awayName: m.awayTeam.name }
                                )
                              }
                              className={`rounded-lg py-1.5 px-1 text-center border transition-colors ${
                                active
                                  ? 'bg-[#1472e5] border-[#0b4ea2] text-white'
                                  : 'bg-[#edf3fb] hover:bg-[#dbeafe] border-[#c8daf3] text-[#091b35]'
                              }`}
                            >
                              <span className={`block text-[9px] font-black ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                                {label}
                              </span>
                              <span className="font-mono-tabular text-xs font-black">
                                {mk.simulatedOdds.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {picks.length > 0 && (
                        <div className="text-[10px] font-black text-[#16a34a] text-center">
                          ✓ {picks.length} choix dans le ticket
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Cotes Boostées MYBET */}
        {boostedCardItems.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-[#091b35] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#f59e0b]" />
              <span>Cotes Boostées MYBET</span>
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1.5">
              {boostedCardItems.slice(0, 6).map(({ match, market, baseOdd }) => {
                const active = isSelected(market.id);
                return (
                  <div
                    key={`boost_${match.id}_${market.id}`}
                    className="min-w-[235px] rounded-xl border border-amber-300 bg-gradient-to-br from-white to-amber-50/70 p-3 flex flex-col justify-between gap-2 shrink-0 shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectMatch(match.id)}
                      className="text-left space-y-0.5"
                    >
                      <span className="text-[10px] font-black uppercase text-amber-700 block truncate">
                        {match.competitionName}
                      </span>
                      <p className="font-heading text-xs font-black text-slate-950 truncate">
                        {match.homeTeam.name} vs {match.awayTeam.name}
                      </p>
                      <p className="text-[11px] font-bold text-slate-600 truncate">
                        {market.selectionName}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleSelection(
                          {
                            matchId: match.id,
                            marketId: market.id,
                            matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                            competitionName: match.competitionName,
                            marketType: market.marketType,
                            selectionName: market.selectionName,
                            simulatedOdds: market.simulatedOdds,
                            status: match.status,
                            startTime: match.startTime,
                          },
                          { homeName: match.homeTeam.name, awayName: match.awayTeam.name }
                        )
                      }
                      className={`w-full rounded-lg py-1.5 px-2.5 flex items-center justify-between font-mono-tabular text-xs font-black transition-colors ${
                        active
                          ? 'bg-[#1472e5] text-white'
                          : 'bg-[#091b35] hover:bg-[#13325f] text-white'
                      }`}
                    >
                      <span className="line-through text-slate-400 text-[11px]">{baseOdd.toFixed(2)}</span>
                      <span className="text-[#facc15] text-sm">{market.simulatedOdds.toFixed(2)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 7. League-Grouped Matchboard */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-[#091b35] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#1472e5]" />
              <span>Programme par Championnat</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="text-xs font-black text-[#1472e5] hover:underline"
            >
              Mode Direct complet →
            </button>
          </div>

          {renderGroupedMatchBoard(displayedMatches)}

          {route === 'home' && !hasActiveFilter && filteredMatches.length > visibleLimit && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 48)}
                className="rounded-xl bg-[#091b35] hover:bg-[#13325f] text-white font-black px-6 py-3 text-xs uppercase tracking-wider shadow-sm transition-colors"
              >
                Afficher plus de matchs ({filteredMatches.length - visibleLimit} restants)
              </button>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="rounded-2xl border border-slate-300 bg-[#091b35] text-slate-200 p-4 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#facc15] shrink-0" />
            <span>
              MYBET PRO · Scores en temps réel, Cotes Live, Bet Builder et Portefeuille DT.
            </span>
          </div>
          <span className="font-mono-tabular text-slate-400 shrink-0">© 2026 MYBET</span>
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-[#091b35] to-[#143970] text-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5">
            <SportLogoIcon slug={activeSportSlug === 'all' ? 'football' : activeSportSlug} className="w-6 h-6" />
            <span>{pageTitle}</span>
          </h1>
          <p className="text-xs font-bold text-blue-100 mt-1">
            {filteredMatches.length} événement(s) unique(s) · {liveMatches.length} en direct · Classement par championnat
          </p>
        </div>
        {route === 'live' && (
          <select
            value={selectedSportFilter}
            onChange={(e) => {
              setSelectedSportFilter(e.target.value);
              setSelectedCompetition('all');
            }}
            aria-label="Filtrer par sport"
            className="rounded-xl border border-white/25 bg-white/10 text-white px-3.5 py-2 text-xs font-extrabold focus:outline-none"
          >
            <option value="all" className="text-slate-900">Tous les sports</option>
            {sports.map((sp) => (
              <option key={sp.id} value={sp.slug} className="text-slate-900">
                {sp.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {renderSearchAndChampionshipBar()}

      <div className="rounded-2xl border border-slate-300 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st.id
                  ? st.id === 'live'
                    ? 'bg-[#dc2626] text-white'
                    : 'bg-[#1472e5] text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
        <span className="font-mono-tabular text-xs font-black text-slate-600">
          {filteredMatches.length} match(s)
        </span>
      </div>

      {renderGroupedMatchBoard(filteredMatches)}
    </div>
  );
}
