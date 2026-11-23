export interface UserProfile {
  id: number;
  uid: string;
  username: string;
  email: string;
  virtualBalance: number;
  role: 'user' | 'admin' | string;
  favoriteTeams: string[];
  favoriteSports: string[];
  createdAt: string;
}

export interface UserStats {
  totalBets: number;
  wonBets: number;
  lostBets: number;
  pendingBets: number;
  winRate: number;
  totalStaked: number;
  totalWonCredits: number;
}

export interface SportItem {
  id: number;
  slug: string;
  name: string;
  icon: string;
  liveCount?: number;
  totalCount?: number;
}

export interface CompetitionItem {
  id: number;
  slug: string;
  name: string;
  sportId: number;
  country: string;
  featured: boolean;
}

export interface TeamItem {
  id: number;
  name: string;
  shortName: string;
  logo: string;
  sportId?: number;
}

export interface MarketItem {
  id: number;
  matchId: number;
  marketType: string;
  selectionName: string;
  simulatedOdds: number;
  active: boolean;
}

export interface MatchItem {
  id: number;
  externalId?: string | null;
  sportId: number;
  sportSlug: string;
  sportName: string;
  competitionId: number;
  competitionSlug: string;
  competitionName: string;
  competitionCountry: string;
  homeTeam: TeamItem;
  awayTeam: TeamItem;
  homeScore: number;
  awayScore: number;
  status: 'live' | 'upcoming' | 'finished';
  matchTimer: string;
  startTime: string;
  dataSource: 'live_api' | 'simulated' | 'admin' | string;
  featured: boolean;
  markets: MarketItem[];
}

export interface SlipSelection {
  matchId: number;
  marketId: number;
  matchLabel: string;
  competitionName: string;
  marketType: string;
  selectionName: string;
  simulatedOdds: number;
  status: 'live' | 'upcoming' | 'finished';
  startTime: string;
}

export type SlipMode = 'single' | 'multiple' | 'system';

export interface VirtualBetSelectionItem {
  id: number;
  virtualBetId: number;
  matchId: number;
  marketId: number;
  marketType: string;
  selectionName: string;
  simulatedOdds: number;
  matchLabel: string;
  result: 'pending' | 'won' | 'lost' | 'void';
}

export interface VirtualBetItem {
  id: number;
  userId: number;
  username?: string;
  reference: string;
  virtualStake: number;
  combinedOdds: number;
  potentialVirtualWinnings: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  createdAt: string;
  selections: VirtualBetSelectionItem[];
}

export interface TransactionItem {
  id: number;
  userId: number;
  amount: number;
  transactionType: string;
  description: string;
  createdAt: string;
}

export interface DepositRequestItem {
  id: number;
  userId: number;
  username?: string;
  email?: string;
  method: 'tickets' | 'D17' | string;
  operator: 'Ooredoo' | 'Orange' | 'Tunisie Telecom' | 'D17' | string;
  amount: number;
  ticketCodes: string[];
  phoneNumber?: string | null;
  screenshotData?: string | null;
  note?: string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  adminNote?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

export interface ContactMessageItem {
  id: number;
  userId: number;
  senderId: number;
  senderRole: 'user' | 'admin' | string;
  senderName: string;
  message: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
  userBalance?: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  virtualBalance: number;
  totalBets: number;
  wonBets: number;
  winRate: number;
}

export interface PromoOffer {
  code: string;
  title: string;
  description: string;
  rewardCredits: number;
  cadence: 'once' | 'daily';
  claimed?: boolean;
}

export interface AuditLogItem {
  id: number;
  adminId: number;
  adminName?: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface MatchCenterStat {
  label: string;
  homeValue: string;
  awayValue: string;
  homePct: number;
}

export interface MatchCenterTimelineEvent {
  clock: string;
  type: 'goal' | 'yellow' | 'red' | 'sub' | 'info';
  text: string;
  teamSide: 'home' | 'away' | 'neutral';
}

export interface MatchCenterFormGame {
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  date: string;
  homeAway: string;
}

export interface MatchCenterInjury {
  player: string;
  position: string;
  status: string;
  detail: string;
  returnDate?: string;
}

export interface MatchCenterRosterPlayer {
  name: string;
  position: string;
  jersey?: string;
  starter: boolean;
}

export interface MatchCenterStandingRow {
  rank: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gd: string;
  points: number;
  isMatchTeam: boolean;
}

export interface MatchCenterData {
  venue: {
    name: string;
    city?: string;
    country?: string;
    attendance?: number;
  } | null;
  consensusOdds: {
    provider: string;
    homeDecimal: number | null;
    drawDecimal: number | null;
    awayDecimal: number | null;
    overUnderLine: number | null;
    overDecimal: number | null;
    underDecimal: number | null;
    spreadLine: number | null;
    homeImpliedPct: number | null;
    drawImpliedPct: number | null;
    awayImpliedPct: number | null;
  } | null;
  stats: MatchCenterStat[];
  timeline: MatchCenterTimelineEvent[];
  form: {
    home: MatchCenterFormGame[];
    away: MatchCenterFormGame[];
  };
  injuries: {
    home: MatchCenterInjury[];
    away: MatchCenterInjury[];
  };
  lineups: {
    home: MatchCenterRosterPlayer[];
    away: MatchCenterRosterPlayer[];
  };
  standings: MatchCenterStandingRow[];
}

export interface AdminUserSummary extends UserProfile {
  totalBets: number;
  wonBets: number;
  pendingBets: number;
  totalGain: number;
  pendingPotentialGain: number;
  totalStaked: number;
}

export type AppRoute =
  | 'home'
  | 'live'
  | 'sport-football'
  | 'sport-basketball'
  | 'sport-tennis'
  | 'sport-volleyball'
  | 'sport-esports'
  | 'match-detail'
  | 'dashboard'
  | 'recharge'
  | 'history'
  | 'leaderboard'
  | 'promotions'
  | 'login'
  | 'register'
  | 'reset-password'
  | 'profile'
  | 'admin';
