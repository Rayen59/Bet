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
  Wallet,
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
import { RechargeView } from './components/RechargeView';
import { LeaderboardView, PromotionsView } from './components/CommunityViews';
import { AdminDashboardView } from './components/AdminDashboardView';

function SportIcon({ slug }: { slug: string }) {
  if (slug === 'basketball') return <CircleDot className="w-4 h-4 text-amber-600 shrink-0" />;
  if (slug === 'tennis') return <Disc className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (slug === 'volleyball') return <Globe className="w-4 h-4 text-sky-600 shrink-0" />;
  if (slug === 'esports') return <Gamepad2 className="w-4 h-4 text-indigo-600 shrink-0" />;
  return <Trophy className="w-4 h-4 text-[#0a58ca] shrink-0" />;
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
          showToast(err?.message || 'Impossible de charger les matchs.', 'error');
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
        window.dispatchEvent(new CustomEvent('sportzone:matches_updated'));
      });
    } catch {
      // EventSource fallback handled by interval below
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadCatalogAndMatches(true);
        window.dispatchEvent(new CustomEvent('sportzone:matches_updated'));
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
    <div className="min-h-screen flex flex-col bg-[#f4f7fb] text-slate-900 pb-20 lg:pb-0">
      {/* Crisp White Header matching Reference Screenshots 1 & 3 */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-[1640px] mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-3 sm:gap-5">
          {/* Left: Compact Menu Button + Brand Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('main');
                setAccountDrawerOpen(true);
              }}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate('home')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a58ca] rounded-lg"
            >
              <BrandLogo />
            </button>
          </div>

          {/* Center Search Bar (desktop) */}
          <div className="hidden md:flex flex-1 max-w-sm relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (route !== 'home' && route !== 'live' && !route.startsWith('sport-')) {
                  setRoute('live');
                }
              }}
              placeholder="Rechercher équipe, ligue..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0a58ca] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Right: User Account Chip / Balance / Connexion */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                {user.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => navigate('recharge')}
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold px-3 py-2 text-xs whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>+ Recharger</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDrawerTab('user');
                    setAccountDrawerOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 pl-1.5 pr-2.5 py-1 text-xs whitespace-nowrap shrink-0 transition-colors shadow-2xs"
                >
                  <span className="w-6 h-6 rounded-full bg-[#0a58ca] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline font-semibold text-slate-800 max-w-[110px] truncate">
                    {user.username}
                  </span>
                  <span className="rounded-full bg-[#0a58ca] text-white font-mono-tabular font-bold px-2.5 py-0.5 text-[11px]">
                    {user.virtualBalance.toFixed(2)} DT
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    showToast('Déconnecté.', 'info');
                    navigate('home');
                  }}
                  className="hidden sm:inline-flex w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 items-center justify-center transition-colors"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold text-xs transition-colors whitespace-nowrap shrink-0 shadow-2xs"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Connexion</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Single-Line Horizontal Tab Bar matching Screenshots 1 & 3 */}
        <div className="border-t border-slate-100 bg-white">
          <nav className="max-w-[1640px] mx-auto px-3 sm:px-6 flex items-center gap-5 sm:gap-7 overflow-x-auto text-xs sm:text-[13px] font-semibold">
            <button
              type="button"
              onClick={() => navigate('home')}
              className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                route === 'home'
                  ? 'border-[#0a58ca] text-[#0a58ca] font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Accueil
            </button>
            <button
              type="button"
              onClick={() => navigate('live')}
              className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                route === 'live'
                  ? 'border-[#0a58ca] text-[#0a58ca] font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Live</span>
              <span className="rounded bg-[#dc2626] px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-white leading-none">
                {liveTotal}
              </span>
            </button>
            {user?.role !== 'admin' && (
              <button
                type="button"
                onClick={() => navigate('recharge')}
                className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  route === 'recharge'
                    ? 'border-[#0a58ca] text-[#0a58ca] font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Recharger
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('leaderboard')}
              className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                route === 'leaderboard'
                  ? 'border-[#0a58ca] text-[#0a58ca] font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Classement
            </button>
            <button
              type="button"
              onClick={() => navigate('promotions')}
              className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                route === 'promotions'
                  ? 'border-[#0a58ca] text-[#0a58ca] font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Promotions
            </button>
            {user && user.role !== 'admin' && (
              <button
                type="button"
                onClick={() => navigate('history')}
                className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  route === 'dashboard' || route === 'history' || route === 'profile'
                    ? 'border-[#0a58ca] text-[#0a58ca] font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes Paris
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`py-2.5 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  route === 'admin'
                    ? 'border-[#dc2626] text-[#dc2626] font-extrabold'
                    : 'border-transparent text-[#dc2626] hover:text-rose-700 font-bold'
                }`}
              >
                Admin
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Account / Main Menu Modal Drawer */}
      {accountDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-start"
          onClick={() => setAccountDrawerOpen(false)}
        >
          <div
            className="max-w-sm w-full h-full flex flex-col bg-white border-r border-slate-200 overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <BrandLogo />
              <button
                type="button"
                onClick={() => setAccountDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {user ? (
                <div className="rounded-2xl bg-gradient-to-br from-[#0a58ca] to-[#084298] text-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/15 border border-white/30 flex items-center justify-center shrink-0">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono-tabular text-sm font-extrabold truncate">
                        #{user.id} · {user.username}
                      </p>
                      <p className="text-xs font-medium text-blue-100 capitalize">{user.role}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-semibold pt-1">
                    <div className="flex justify-between pb-1.5 border-b border-white/15">
                      <span className="text-blue-100">Solde disponible :</span>
                      <span className="font-mono-tabular font-bold">
                        {user.virtualBalance.toFixed(2)} DT
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-white/15">
                      <span className="text-blue-100">Gains totaux :</span>
                      <span className="font-mono-tabular font-bold">
                        {(stats?.totalWonCredits ?? 0).toFixed(2)} DT
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-white/15">
                      <span className="text-blue-100">Paris en cours :</span>
                      <span className="font-mono-tabular font-bold">
                        {stats?.pendingBets ?? 0}
                      </span>
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
                        showToast('Solde actualisé.', 'success');
                      }}
                      className="rounded-xl bg-white hover:bg-blue-50 text-[#0a58ca] font-bold px-6 py-2 text-xs inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingUser ? 'animate-spin' : ''}`} />
                      <span>Actualiser</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-bold text-slate-900">
                      Bienvenue sur SPORTZONE
                    </p>
                    <p className="text-xs text-slate-500">Connectez-vous pour parier en DT</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('login')}
                    className="rounded-xl bg-[#0a58ca] text-white font-bold px-4 py-2 text-xs"
                  >
                    Connexion
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 border-b border-slate-200 text-xs font-heading font-bold">
                <button
                  type="button"
                  onClick={() => setDrawerTab('main')}
                  className={`py-2.5 border-b-2 transition-colors ${
                    drawerTab === 'main'
                      ? 'border-[#0a58ca] text-[#0a58ca]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sports
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('user')}
                  className={`py-2.5 border-b-2 transition-colors ${
                    drawerTab === 'user'
                      ? 'border-[#0a58ca] text-[#0a58ca]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Mon Espace
                </button>
              </div>

              {drawerTab === 'main' ? (
                <div className="divide-y divide-slate-100 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => navigate('home')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-[#0a58ca] font-bold hover:bg-slate-50 rounded-lg"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Accueil Sportif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('live')}
                    className="w-full flex items-center justify-between py-3.5 px-2 text-slate-800 hover:bg-slate-50 rounded-lg"
                  >
                    <span className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-[#dc2626]" />
                      <span>Paris en Direct</span>
                    </span>
                    <span className="rounded bg-[#dc2626] px-1.5 py-0.5 text-[11px] font-mono-tabular font-bold text-white">
                      {liveTotal}
                    </span>
                  </button>
                  {sports.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => navigate(sportRouteMap[sp.slug] || 'live')}
                      className="w-full flex items-center justify-between py-3.5 px-2 text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                      <span className="flex items-center gap-3">
                        <SportIcon slug={sp.slug} />
                        <span>{sp.name}</span>
                      </span>
                      <span className="font-mono-tabular text-xs text-slate-500">
                        {sp.totalCount ?? 0}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate('promotions')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    <Gift className="w-4 h-4 text-[#0a58ca]" />
                    <span>Promotions</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => navigate(user ? 'dashboard' : 'login')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-slate-800 hover:bg-slate-50 rounded-lg"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>Mon compte</span>
                  </button>
                  {user?.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => navigate('recharge')}
                      className="w-full flex items-center gap-3 py-3.5 px-2 text-[#059669] font-bold hover:bg-slate-50 rounded-lg"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Recharger &amp; Contacter Admin</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(user ? 'profile' : 'login')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-slate-800 hover:bg-slate-50 rounded-lg"
                  >
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>Profil &amp; Préférences</span>
                  </button>
                  {user?.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => navigate(user ? 'history' : 'login')}
                      className="w-full flex items-center gap-3 py-3.5 px-2 text-slate-800 hover:bg-slate-50 rounded-lg"
                    >
                      <History className="w-4 h-4 text-slate-500" />
                      <span>Mes Paris</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('leaderboard')}
                    className="w-full flex items-center gap-3 py-3.5 px-2 text-slate-800 hover:bg-slate-50 rounded-lg"
                  >
                    <Award className="w-4 h-4 text-slate-500" />
                    <span>Classement</span>
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => navigate('admin')}
                      className="w-full flex items-center gap-3 py-3.5 px-2 text-[#dc2626] font-bold hover:bg-slate-50 rounded-lg"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Console Admin</span>
                    </button>
                  )}
                  {user && (
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setAccountDrawerOpen(false);
                        showToast('Déconnecté.', 'info');
                        navigate('home');
                      }}
                      className="w-full flex items-center gap-3 py-3.5 px-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Déconnexion</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive Workspace */}
      <div className="flex-1 max-w-[1640px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_370px] xl:grid-cols-[235px_minmax(0,1fr)_380px] gap-5 items-start">
        {/* Left Sidebar (xl+) */}
        <aside className="hidden xl:flex flex-col gap-3.5 sticky top-28">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Sports A-Z
            </div>
            <div className="p-2 space-y-0.5">
              <button
                type="button"
                onClick={() => navigate('live')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  route === 'live'
                    ? 'bg-blue-50 text-[#0a58ca]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#dc2626] shrink-0" />
                  <span>Direct &amp; Calendrier</span>
                </span>
                <span className="font-mono-tabular text-[#dc2626] font-bold">{liveTotal}</span>
              </button>

              {sports.map((sp) => {
                const target = sportRouteMap[sp.slug] || 'live';
                const active = route === target;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => navigate(target)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-blue-50 text-[#0a58ca]'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <SportIcon slug={sp.slug} />
                      <span className="truncate">{sp.name}</span>
                    </span>
                    <span className="font-mono-tabular text-slate-500">{sp.totalCount ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Menu Rapide
            </div>
            <div className="p-2 space-y-0.5 text-xs font-semibold">
              {user?.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => navigate('recharge')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                    route === 'recharge'
                      ? 'bg-[#059669] text-white font-bold'
                      : 'text-[#059669] hover:bg-emerald-50'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>Recharger &amp; Contacter</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  route === 'dashboard'
                    ? 'bg-blue-50 text-[#0a58ca]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-slate-400" />
                <span>Mon Compte</span>
              </button>
              {user?.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => navigate('history')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                    route === 'history'
                      ? 'bg-blue-50 text-[#0a58ca]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Mes Paris</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('leaderboard')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  route === 'leaderboard'
                    ? 'bg-blue-50 text-[#0a58ca]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Award className="w-4 h-4 text-slate-400" />
                <span>Classement</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('promotions')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  route === 'promotions'
                    ? 'bg-blue-50 text-[#0a58ca]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Gift className="w-4 h-4 text-[#0a58ca]" />
                <span>Bonus Sports</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                    route === 'admin'
                      ? 'bg-[#dc2626] text-white font-bold'
                      : 'text-[#dc2626] hover:bg-rose-50'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Console Admin</span>
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

          {route === 'recharge' && <RechargeView onNavigate={navigate} />}

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

        {/* Right Real-Time Betslip (lg+) */}
        <aside className="hidden lg:block sticky top-28 h-[calc(100vh-8rem)]">
          <BettingSlip
            matches={matches}
            onNavigate={navigate}
            onBetPlaced={() => loadCatalogAndMatches()}
          />
        </aside>
      </div>

      {/* Mobile Floating Betslip Pill */}
      {user?.role !== 'admin' &&
        route !== 'login' &&
        route !== 'register' &&
        route !== 'reset-password' &&
        route !== 'admin' && (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden fixed bottom-18 right-4 z-40 flex items-center gap-2 rounded-full bg-[#0a58ca] hover:bg-[#0847a8] text-white font-bold px-4 py-2.5 shadow-lg text-xs"
          >
            {betBuilderGroupCount > 0 ? (
              <Layers className="w-4 h-4" />
            ) : (
              <Receipt className="w-4 h-4" />
            )}
            <span>
              Ticket ({selections.length}
              {betBuilderGroupCount > 0 ? ' · BB' : ''})
            </span>
            {combinedOdds > 0 && (
              <span className="font-mono-tabular font-extrabold">· {combinedOdds.toFixed(2)}</span>
            )}
          </button>
        )}

      {/* Mobile Betting Slip Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm h-full bg-[#f4f7fb] p-2.5 flex flex-col">
            <div className="flex-1 min-h-0">
              <BettingSlip
                matches={matches}
                onNavigate={navigate}
                onBetPlaced={() => loadCatalogAndMatches()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-slate-200 bg-white/95 backdrop-blur-md grid grid-cols-5 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => navigate('home')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'home' ? 'text-[#0a58ca]' : 'text-slate-500'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Accueil</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('live')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'live' ? 'text-[#dc2626]' : 'text-slate-500'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Live</span>
        </button>
        {user?.role === 'admin' ? (
          <button
            type="button"
            onClick={() => navigate('admin')}
            className={`flex flex-col items-center justify-center gap-0.5 ${
              route === 'admin' ? 'text-[#dc2626]' : 'text-slate-500'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('recharge')}
            className={`flex flex-col items-center justify-center gap-0.5 ${
              route === 'recharge' ? 'text-[#059669]' : 'text-slate-500'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Recharger</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(user?.role === 'admin' ? 'admin' : 'history')}
          className={`flex flex-col items-center justify-center gap-0.5 ${
            route === 'history' ? 'text-[#0a58ca]' : 'text-slate-500'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{user?.role === 'admin' ? 'Dépôts' : 'Mes Paris'}</span>
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
            route === 'dashboard' || route === 'login' ? 'text-[#0a58ca]' : 'text-slate-500'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{user ? 'Compte' : 'Connexion'}</span>
        </button>
      </nav>
    </div>
  );
}
