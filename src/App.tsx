import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  ChevronDown,
  CircleDot,
  Disc,
  Gamepad2,
  Gift,
  Globe,
  History,
  Home,
  LayoutDashboard,
  Layers,
  Lock,
  LogOut,
  Menu,
  Radio,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  Trophy,
  User as UserIcon,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useSlip } from './context/SlipContext';
import { useToast } from './context/ToastContext';
import { apiFetch } from './lib/api';
import { AppRoute, CompetitionItem, MatchItem, SportItem } from './types/sportzone';
import { BrandLogo } from './components/BrandLogo';
import { BettingSlip } from './components/BettingSlip';
import { HomeAndMatchesView } from './components/HomeAndMatchesView';
import { MatchDetailView } from './components/MatchDetailView';
import { AuthViews } from './components/AuthViews';
import { UserDashboardView } from './components/UserDashboardView';
import { LeaderboardView, PromotionsView } from './components/CommunityViews';
import { AdminDashboardView } from './components/AdminDashboardView';

function SportIcon({ slug }: { slug: string }) {
  if (slug === 'basketball') return <CircleDot className="w-4 h-4 text-amber-400 shrink-0" />;
  if (slug === 'tennis') return <Disc className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (slug === 'volleyball') return <Globe className="w-4 h-4 text-sky-400 shrink-0" />;
  if (slug === 'esports') return <Gamepad2 className="w-4 h-4 text-indigo-400 shrink-0" />;
  return <Trophy className="w-4 h-4 text-[#f5b800] shrink-0" />;
}

export default function App() {
  const { user, stats, logout, refreshProfile } = useAuth();
  const { selections, matchGroups, combinedOdds, mobileOpen, setMobileOpen } = useSlip();
  const { showToast } = useToast();

  const [route, setRoute] = useState<AppRoute>('home');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'main' | 'user'>('main');
  const [refreshingUser, setRefreshingUser] = useState(false);

  const [sports, setSports] = useState<SportItem[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [liveTotal, setLiveTotal] = useState(0);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCatalogAndMatches = useCallback(
    async (silent = false) => {
      try {
        const [sportsRes, matchesRes] = await Promise.all([
          apiFetch<{ sports: SportItem[]; competitions: CompetitionItem[] }>('/api/sports'),
          apiFetch<{ matches: MatchItem[]; liveTotal: number }>('/api/matches'),
        ]);
        setSports(sportsRes.sports);
        setCompetitions(sportsRes.competitions);
        setMatches(matchesRes.matches);
        setLiveTotal(matchesRes.liveTotal);
      } catch (err: any) {
        if (!silent) {
          showToast(err?.message || 'Unable to load sports catalog.', 'error');
        }
      } finally {
        setLoadingMatches(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadCatalogAndMatches();

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('matches_updated', () => {
        loadCatalogAndMatches(true);
      });
    } catch {
      // EventSource fallback handled by interval below
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadCatalogAndMatches(true);
      }
    }, 5_000);

    const onFocus = () => {
      loadCatalogAndMatches(true);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      es?.close();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadCatalogAndMatches]);

  const navigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    setAccountDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMatchDetail = (matchId: number) => {
    setSelectedMatchId(matchId);
    setRoute('match-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sportRouteMap: Record<string, AppRoute> = {
    football: 'sport-football',
    basketball: 'sport-basketball',
    tennis: 'sport-tennis',
    volleyball: 'sport-volleyball',
    esports: 'sport-esports',
  };

  const betBuilderGroupCount = matchGroups.filter((g) => g.isBetBuilder).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#111111] text-zinc-100 pb-20 lg:pb-0">
      {/* Header matching 5f64d28e screenshot */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-[#121214]/95 backdrop-blur-md">
        <div className="max-w-[1640px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-5">
          {/* Left: White Square Menu Button + Brand Logo + Nav */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('main');
                setAccountDrawerOpen(true);
              }}
              className="w-10 h-10 rounded-lg bg-white hover:bg-zinc-200 text-[#111111] flex items-center justify-center shrink-0 transition-colors"
              aria-label="Open navigation & account menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('home')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b800] rounded"
            >
              <BrandLogo />
            </button>

            <nav className="hidden lg:flex items-center gap-5 text-xs font-heading font-bold uppercase tracking-wide text-zinc-300">
              <button
                type="button"
                onClick={() => navigate('home')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'home' ? 'text-[#f5b800]' : ''
                }`}
              >
                Sports Betting
              </button>
              <button
                type="button"
                onClick={() => navigate('live')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white inline-flex items-center gap-1.5 ${
                  route === 'live' ? 'text-[#f5b800]' : ''
                }`}
              >
                <span>Live Betting</span>
                <span className="rounded bg-[#e11d2e] px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-white">
                  {liveTotal}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('leaderboard')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'leaderboard' ? 'text-[#f5b800]' : ''
                }`}
              >
                Leaderboard
              </button>
              <button
                type="button"
                onClick={() => navigate('promotions')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'promotions' ? 'text-[#f5b800]' : ''
                }`}
              >
                Promotions
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => navigate('history')}
                  className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                    route === 'dashboard' || route === 'history' || route === 'profile'
                      ? 'text-[#f5b800]'
                      : ''
                  }`}
                >
                  My Bets
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#fbbf24] ${
                    route === 'admin' ? 'text-[#f5b800] underline underline-offset-4' : 'text-[#f5b800]'
                  }`}
                >
                  Admin
                </button>
              )}
            </nav>
          </div>

          {/* Search Bar (desktop) */}
          <div className="hidden md:flex flex-1 max-w-xs relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (route !== 'home' && route !== 'live' && !route.startsWith('sport-')) {
                  setRoute('live');
                }
              }}
              placeholder="Search teams, leagues..."
              className="w-full rounded-lg border border-zinc-800 bg-[#1c1c1f] pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-400 focus:border-[#f5b800] focus:outline-none"
            />
          </div>

          {/* Right: Gold Outlined User Pill matching screenshot 5f64d28e */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerTab('user');
                    setAccountDrawerOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-[#f5b800] bg-[#16140e] hover:bg-[#1f1c11] px-3 py-1.5 text-xs whitespace-nowrap shrink-0 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-[#f5b800] text-[#111111] flex items-center justify-center shrink-0">
                    <UserIcon className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-mono-tabular font-bold text-[#f5b800]">
                    {user.virtualBalance.toFixed(2)} DT
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#f5b800]" />
                </button>

                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => navigate('admin')}
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-3 py-2 text-xs whitespace-nowrap shrink-0"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  className="px-3.5 py-2 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => navigate('register')}
                  className="px-4 py-2 rounded-lg bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold text-xs transition-colors whitespace-nowrap shrink-0"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Account / Main Menu Modal Drawer */}
      {accountDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex justify-start"
          onClick={() => setAccountDrawerOpen(false)}
        >
          <div
            className="max-w-sm w-full h-full flex flex-col bg-[#111111] border-r border-zinc-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-800/80">
              <div className="w-6" />
              <BrandLogo />
              <button
                type="button"
                onClick={() => setAccountDrawerOpen(false)}
                className="p-1.5 text-white hover:text-[#f5b800]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {user ? (
                <div className="rounded-xl bg-gradient-to-b from-[#e0a119] to-[#c98b10] text-[#111111] p-4 space-y-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full border-2 border-[#111111] flex items-center justify-center shrink-0">
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono-tabular text-sm font-extrabold truncate">
                        #{user.id} · {user.username}
                      </p>
                      <p className="text-xs font-semibold opacity-80 capitalize">{user.role}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-bold pt-1">
                    <div className="flex justify-between pb-1.5 border-b border-black/15">
                      <span>Cash:</span>
                      <span className="font-mono-tabular">DT {user.virtualBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-black/15">
                      <span>Total Gain:</span>
                      <span className="font-mono-tabular">
                        DT {(stats?.totalWonCredits ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-black/15">
                      <span>Pending Bets:</span>
                      <span className="font-mono-tabular">{stats?.pendingBets ?? 0}</span>
                    </div>
                  </div>

                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      disabled={refreshingUser}
                      onClick={async () => {
                        setRefreshingUser(true);
                        await refreshProfile();
                        setRefreshingUser(false);
                        showToast('Balance refreshed.', 'success');
                      }}
                      className="rounded-md bg-[#f5cb42] hover:bg-[#fde047] text-[#111111] font-bold px-8 py-2 text-xs inline-flex items-center gap-1.5 shadow"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingUser ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#1c1c1f] border border-zinc-800 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-bold text-white">Welcome to SPORTZONE</p>
                    <p className="text-xs text-zinc-400">Sign in to place virtual DT bets</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('login')}
                    className="rounded-md bg-[#f5b800] text-[#111111] font-bold px-4 py-2 text-xs"
                  >
                    Sign In
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 border-b border-zinc-800 text-xs font-heading font-bold">
                <button
                  type="button"
                  onClick={() => setDrawerTab('main')}
                  className={`py-2.5 border-b-2 transition-colors ${
                    drawerTab === 'main'
                      ? 'border-[#f5b800] text-[#f5b800]'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  Main Menu
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('user')}
                  className={`py-2.5 border-b-2 transition-colors ${
                    drawerTab === 'user'
                      ? 'border-[#f5b800] text-[#f5b800]'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  User Menu
                </button>
              </div>

              {drawerTab === 'main' ? (
                <div className="divide-y divide-zinc-800/80 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => navigate('home')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-[#f5b800] hover:bg-zinc-900"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Sports Betting</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('live')}
                    className="w-full flex items-center justify-between py-3.5 px-2 text-white hover:bg-zinc-900"
                  >
                    <span className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-[#e11d2e]" />
                      <span>Live Betting</span>
                    </span>
                    <span className="rounded bg-[#e11d2e] px-1.5 py-0.5 text-[11px] font-mono-tabular font-bold">
                      {liveTotal}
                    </span>
                  </button>
                  {sports.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => navigate(sportRouteMap[sp.slug] || 'live')}
                      className="w-full flex items-center justify-between py-3.5 px-2 text-zinc-200 hover:bg-zinc-900"
                    >
                      <span className="flex items-center gap-3">
                        <SportIcon slug={sp.slug} />
                        <span>{sp.name}</span>
                      </span>
                      <span className="font-mono-tabular text-xs text-zinc-400">
                        {sp.totalCount ?? 0}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate('promotions')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-zinc-200 hover:bg-zinc-900"
                  >
                    <Gift className="w-4 h-4 text-[#f5b800]" />
                    <span>Promotions</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => navigate(user ? 'dashboard' : 'login')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-white hover:bg-zinc-900"
                  >
                    <UserIcon className="w-4 h-4 text-zinc-300" />
                    <span>My account</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(user ? 'profile' : 'login')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-white hover:bg-zinc-900"
                  >
                    <Lock className="w-4 h-4 text-zinc-300" />
                    <span>Profile & Preferences</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(user ? 'history' : 'login')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-white hover:bg-zinc-900"
                  >
                    <History className="w-4 h-4 text-zinc-300" />
                    <span>Betting History</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('leaderboard')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-white hover:bg-zinc-900"
                  >
                    <Award className="w-4 h-4 text-zinc-300" />
                    <span>Leaderboard</span>
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => navigate('admin')}
                      className="w-full flex items-center gap-3 py-3.5 px-2 text-[#f5b800] font-bold hover:bg-zinc-900"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin Console</span>
                    </button>
                  )}
                  {user && (
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setAccountDrawerOpen(false);
                        showToast('Signed out.', 'info');
                        navigate('home');
                      }}
                      className="w-full flex items-center gap-3 py-3.5 px-2 text-rose-400 hover:bg-zinc-900"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive Workspace: 1 col mobile -> 2 col lg (wide!) -> 3 col xl */}
      <div className="flex-1 max-w-[1640px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[230px_minmax(0,1fr)_370px] gap-5 items-start">
        {/* Left Sidebar (xl+) */}
        <aside className="hidden xl:flex flex-col gap-3 sticky top-20">
          <div className="rounded-xl border border-zinc-800/80 bg-[#1a1a1d] overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-zinc-800 bg-[#141416] text-xs font-bold text-[#f5b800] uppercase tracking-wider">
              Sports A-Z
            </div>
            <div className="p-1.5 space-y-0.5">
              <button
                type="button"
                onClick={() => navigate('live')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  route === 'live'
                    ? 'bg-[#f5b800]/15 text-[#f5b800]'
                    : 'text-zinc-200 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#e11d2e] shrink-0" />
                  <span>Live & All Sports</span>
                </span>
                <span className="font-mono-tabular text-[#e11d2e] font-bold">{liveTotal}</span>
              </button>

              {sports.map((sp) => {
                const target = sportRouteMap[sp.slug] || 'live';
                const active = route === target;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => navigate(target)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#f5b800]/15 text-[#f5b800]'
                        : 'text-zinc-200 hover:bg-zinc-800/60 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <SportIcon slug={sp.slug} />
                      <span className="truncate">{sp.name}</span>
                    </span>
                    <span className="font-mono-tabular text-zinc-400">{sp.totalCount ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-[#1a1a1d] overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-zinc-800 bg-[#141416] text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Menu
            </div>
            <div className="p-1.5 space-y-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  route === 'dashboard'
                    ? 'bg-[#f5b800]/15 text-[#f5b800]'
                    : 'text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-zinc-400" />
                <span>My Account</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('history')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  route === 'history'
                    ? 'bg-[#f5b800]/15 text-[#f5b800]'
                    : 'text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <History className="w-4 h-4 text-zinc-400" />
                <span>Betting History</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('leaderboard')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  route === 'leaderboard'
                    ? 'bg-[#f5b800]/15 text-[#f5b800]'
                    : 'text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Award className="w-4 h-4 text-zinc-400" />
                <span>Leaderboard</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('promotions')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  route === 'promotions'
                    ? 'bg-[#f5b800]/15 text-[#f5b800]'
                    : 'text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Gift className="w-4 h-4 text-[#f5b800]" />
                <span>Sports Bonus</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    route === 'admin'
                      ? 'bg-[#f5b800] text-[#111111] font-bold'
                      : 'text-[#f5b800] hover:bg-zinc-800/60'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Console</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Center Main Content */}
        <main className="min-w-0">
          {(route === 'home' ||
            route === 'live' ||
            route === 'sport-football' ||
            route === 'sport-basketball' ||
            route === 'sport-tennis' ||
            route === 'sport-volleyball' ||
            route === 'sport-esports') && (
            <HomeAndMatchesView
              route={route}
              matches={matches}
              sports={sports}
              competitions={competitions}
              loading={loadingMatches}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNavigate={navigate}
              onSelectMatch={openMatchDetail}
            />
          )}

          {route === 'match-detail' && selectedMatchId !== null && (
            <MatchDetailView matchId={selectedMatchId} onBack={() => navigate('home')} />
          )}

          {(route === 'login' || route === 'register' || route === 'reset-password') && (
            <AuthViews mode={route} onNavigate={navigate} />
          )}

          {(route === 'dashboard' || route === 'history' || route === 'profile') && (
            <UserDashboardView
              tab={route}
              sports={sports}
              matches={matches}
              onNavigate={navigate}
            />
          )}

          {route === 'leaderboard' && <LeaderboardView />}

          {route === 'promotions' && <PromotionsView onNavigate={navigate} />}

          {route === 'admin' && (
            <AdminDashboardView
              matches={matches}
              onRefreshMatches={() => loadCatalogAndMatches()}
              onNavigate={navigate}
            />
          )}
        </main>

        {/* Right Gold Betslip (lg+) */}
        <aside className="hidden lg:block sticky top-20 h-[calc(100vh-5.8rem)]">
          <BettingSlip onNavigate={navigate} onBetPlaced={() => loadCatalogAndMatches()} />
        </aside>
      </div>

      {/* Mobile Floating Betslip Pill */}
      {route !== 'login' && route !== 'register' && route !== 'reset-password' && route !== 'admin' && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden fixed bottom-18 right-4 z-40 flex items-center gap-2 rounded-full bg-[#f5b800] hover:bg-[#fbbf24] text-[#111111] font-bold px-4 py-2.5 shadow-xl text-xs"
        >
          {betBuilderGroupCount > 0 ? (
            <Layers className="w-4 h-4" />
          ) : (
            <Receipt className="w-4 h-4" />
          )}
          <span>
            Betslip ({selections.length}
            {betBuilderGroupCount > 0 ? ' · BB' : ''})
          </span>
          {combinedOdds > 0 && (
            <span className="font-mono-tabular font-extrabold">· {combinedOdds.toFixed(2)}</span>
          )}
        </button>
      )}

      {/* Mobile Betting Slip Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm h-full bg-[#111111] p-2.5 flex flex-col">
            <div className="flex-1 min-h-0">
              <BettingSlip onNavigate={navigate} onBetPlaced={() => loadCatalogAndMatches()} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-zinc-800 bg-[#141416]/95 backdrop-blur-md grid grid-cols-5 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => navigate('home')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'home' ? 'text-[#f5b800]' : 'text-zinc-400'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('live')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'live' ? 'text-[#e11d2e]' : 'text-zinc-400'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Live</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('sport-football')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route.startsWith('sport-') ? 'text-[#f5b800]' : 'text-zinc-400'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Sports</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('history')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'history' ? 'text-[#f5b800]' : 'text-zinc-400'
          }`}
        >
          <History className="w-4 h-4" />
          <span>My Bets</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (user) {
              setDrawerTab('user');
              setAccountDrawerOpen(true);
            } else {
              navigate('login');
            }
          }}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'dashboard' || route === 'login' ? 'text-[#f5b800]' : 'text-zinc-400'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{user ? 'Account' : 'Sign In'}</span>
        </button>
      </nav>
    </div>
  );
}
