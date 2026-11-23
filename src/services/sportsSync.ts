import bcrypt from 'bcryptjs';
import { eq, inArray, like, ne, sql } from 'drizzle-orm';
import { assertDatabaseConfigured, db, ensureDbReady } from '../db/index.ts';
import {
  auditLogs,
  competitions,
  markets,
  matches,
  sports,
  teams,
  users,
  virtualBetSelections,
} from '../db/schema.ts';
import { americanToDecimal } from './matchCenter.ts';
import { settleBetsForFinishedMatch } from './bettingEngine.ts';
import { realtimeHub } from './realtimeHub.ts';

interface LiveFeedSpec {
  url: string;
  sportSlug: string;
  competitionSlug: string;
  competitionName: string;
  country: string;
}

const PUBLIC_LIVE_FEEDS: LiveFeedSpec[] = [
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'premier-league',
    competitionName: 'Premier League',
    country: 'England',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'bundesliga',
    competitionName: 'Bundesliga',
    country: 'Germany',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.2/scoreboard',
    sportSlug: 'football',
    competitionSlug: '2-bundesliga',
    competitionName: '2. Bundesliga',
    country: 'Germany',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.dfb_pokal/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'dfb-pokal',
    competitionName: 'DFB-Pokal',
    country: 'Germany',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'la-liga',
    competitionName: 'La Liga',
    country: 'Spain',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'serie-a',
    competitionName: 'Serie A',
    country: 'Italy',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'ligue-1',
    competitionName: 'Ligue 1',
    country: 'France',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ned.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'eredivisie',
    competitionName: 'Eredivisie',
    country: 'Netherlands',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'mls',
    competitionName: 'MLS',
    country: 'USA',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/por.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'primeira-liga',
    competitionName: 'Liga Portugal',
    country: 'Portugal',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'super-lig',
    competitionName: 'Super Lig',
    country: 'Turkey',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'champions-league',
    competitionName: 'UEFA Champions League',
    country: 'Europe',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/scoreboard',
    sportSlug: 'football',
    competitionSlug: 'efl-championship',
    competitionName: 'EFL Championship',
    country: 'England',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    sportSlug: 'basketball',
    competitionSlug: 'nba',
    competitionName: 'NBA',
    country: 'USA',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
    sportSlug: 'tennis',
    competitionSlug: 'atp-tour',
    competitionName: 'ATP Tour',
    country: 'International',
  },
  {
    url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard',
    sportSlug: 'tennis',
    competitionSlug: 'wta-tour',
    competitionName: 'WTA Tour',
    country: 'International',
  },
];

// Top football leagues for LiveScore schedule filtering (while ALL live football matches always sync)
const PRIORITY_LIVESCORE_LEAGUES = new Set([
  'premier league',
  'laliga',
  'la liga',
  'bundesliga',
  'serie a',
  'ligue 1',
  'champions league',
  'europa league',
  'eredivisie',
  'liga portugal',
  'super lig',
  'championship',
  'mls',
  'pro league',
  'scottish premiership',
  'jupiler pro league',
  'botola pro',
  'ligue 1 tunisia',
  'ligue i',
  'serie b',
  '2. bundesliga',
  '3. liga',
  'frauen-bundesliga',
  'dfb-pokal',
  'dfb pokal',
  'segunda division',
  'super league',
  'j1 league',
  'k league 1',
  'k league 2',
  'liga mx',
]);

function isTunisiaOrGermanyStage(country: string, compName: string): boolean {
  const c = country.toLowerCase();
  const n = compName.toLowerCase();
  if (c === 'tunisia' || c === 'tunisie') return true;
  if (c === 'germany' || c === 'deutschland' || c === 'allemagne') {
    // Include Bundesliga, 2. Bundesliga, 3. Liga, Frauen-Bundesliga, DFB-Pokal, and Regionalliga
    return /bundesliga|3\.\s*liga|dfb|regionalliga/i.test(n);
  }
  return false;
}

const TEAM_COLORS = [
  '#eab308',
  '#38bdf8',
  '#10b981',
  '#f97316',
  '#ef4444',
  '#6366f1',
  '#14b8a6',
  '#ec4899',
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}

function makeShortName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const words = cleaned.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  }
  return cleaned.slice(0, 3).toUpperCase() || 'TM';
}

const TEAM_ALIASES: Record<string, string> = {
  parissaintgermain: 'psg',
  parissg: 'psg',
  internazionale: 'intermilan',
  inter: 'intermilan',
  acmilan: 'milan',
  bayernmunchen: 'bayernmunich',
  manchestercity: 'mancity',
  manchesterunited: 'manutd',
  manunited: 'manutd',
  atleticomadrid: 'atletico',
  atleticodemadrid: 'atletico',
  tottenhamhotspur: 'tottenham',
  spurs: 'tottenham',
  wolverhamptonwanderers: 'wolves',
  wolverhampton: 'wolves',
  newcastleunited: 'newcastle',
  westhamunited: 'westham',
  brightonhovealbion: 'brighton',
  nottinghamforest: 'nottingham',
  borussiadortmund: 'dortmund',
  bayerleverkusen: 'leverkusen',
  rbleipzig: 'leipzig',
  eintrachtfrankfurt: 'frankfurt',
  athleticbilbao: 'athleticclub',
  realsociedad: 'sociedad',
  realbetis: 'betis',
  olympiquedemarseille: 'marseille',
  olympiquelyonnais: 'lyon',
  asmonaco: 'monaco',
  esperancedetunis: 'esperancetunis',
  esperancesportivedetunis: 'esperancetunis',
  estunis: 'esperancetunis',
  etoiledusahel: 'etoilesahel',
  etoilesportivedusahel: 'etoilesahel',
  essousa: 'etoilesahel',
  clubsfaxien: 'cssfaxien',
  clubsxsfaxien: 'cssfaxien',
  clubafricain: 'clubafricain',
  usmonastir: 'monastir',
  stadenantes: 'nantes',
  olympiakos: 'olympiacos',
  fenerbahce: 'fenerbahce',
  galatasaray: 'galatasaray',
  besiktas: 'besiktas',
  sportingcp: 'sporting',
  sportinglisbon: 'sporting',
  slbenfica: 'benfica',
  fcporto: 'porto',
};

export function normalizeTeamKey(name: string): string {
  const raw = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|as|afc|ss|us|cd|ud|rc|rcd|vfl|vfb|tsv|fsv|bsc|rb|fk|sk|bk|sv|tsg|ogc|osc|aj|ca|es|cs|1\.|04|05|98|hamburg|hamburger|de|du|del)\b/g, (m) =>
      m === 'hamburger' ? 'hamburg' : ''
    )
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return TEAM_ALIASES[raw] || raw;
}

export function buildMatchDedupeKey(sportKey: string | number, homeName: string, awayName: string): string {
  const h = normalizeTeamKey(homeName);
  const a = normalizeTeamKey(awayName);
  return `${sportKey}:${h}:${a}`;
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function parseLiveScoreDate(esd: number | string | undefined): Date {
  const s = String(esd || '');
  if (s.length >= 14) {
    const year = Number(s.slice(0, 4));
    const month = Number(s.slice(4, 6)) - 1;
    const day = Number(s.slice(6, 8));
    const hour = Number(s.slice(8, 10));
    const min = Number(s.slice(10, 12));
    const sec = Number(s.slice(12, 14));
    const dt = new Date(Date.UTC(year, month, day, hour, min, sec));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

function parseLiveScoreStatus(
  esid: number | undefined,
  eps: string | undefined,
  isLiveFeed = false
): 'live' | 'upcoming' | 'finished' | 'skip' {
  const e = String(eps || '').trim();
  const upper = e.toUpperCase();
  if (esid === 56 || upper === 'CANC.' || upper === 'POSTP.' || upper === 'ABD.' || upper === 'AWD.') {
    return 'skip';
  }
  if (
    esid === 6 ||
    esid === 7 ||
    esid === 8 ||
    upper === 'FT' ||
    upper === 'AET' ||
    upper === 'AP' ||
    upper === 'AFTER ET'
  ) {
    return 'finished';
  }
  if (
    isLiveFeed ||
    esid === 2 ||
    esid === 3 ||
    esid === 4 ||
    esid === 12 ||
    upper === 'HT' ||
    upper === 'INT.' ||
    upper === 'ET' ||
    upper === 'PEN' ||
    e.includes("'")
  ) {
    return 'live';
  }
  return 'upcoming';
}

function clampOdd(val: number): number {
  return Math.max(1.02, Math.min(35.0, Math.round(val * 100) / 100));
}

function extractLiveMinute(timer: string): number {
  if (timer.toUpperCase() === 'HT') return 45;
  const m = timer.match(/(\d+)/);
  return m ? Math.min(95, Math.max(1, Number(m[1]))) : 45;
}

export interface RealOddsHint {
  homeOdd?: number | null;
  drawOdd?: number | null;
  awayOdd?: number | null;
  overUnderLine?: number | null;
  overOdd?: number | null;
  underOdd?: number | null;
}

export function buildSimulatedMarketsForSport(
  matchId: number,
  sportSlug: string,
  homeName: string,
  awayName: string,
  seedBias = 0,
  oddsHint?: RealOddsHint
) {
  const jitter = (base: number, idx: number) => {
    const offset = (((seedBias + idx * 13) % 15) - 7) * 0.04;
    return Math.max(1.06, Math.round((base + offset) * 100) / 100);
  };

  const homeShort = makeShortName(homeName);
  const awayShort = makeShortName(awayName);

  if (sportSlug === 'football') {
    const h1 = oddsHint?.homeOdd ?? jitter(1.95, 1);
    const dx = oddsHint?.drawOdd ?? jitter(3.55, 2);
    const a2 = oddsHint?.awayOdd ?? jitter(3.65, 3);

    return [
      { matchId, marketType: '1×2', selectionName: '1', simulatedOdds: h1, active: true },
      { matchId, marketType: '1×2', selectionName: 'X', simulatedOdds: dx, active: true },
      { matchId, marketType: '1×2', selectionName: '2', simulatedOdds: a2, active: true },

      { matchId, marketType: 'Double chance', selectionName: '1 or X', simulatedOdds: clampOdd(1 / (1 / h1 + 1 / dx) * 0.94), active: true },
      { matchId, marketType: 'Double chance', selectionName: '1 or 2', simulatedOdds: clampOdd(1 / (1 / h1 + 1 / a2) * 0.94), active: true },
      { matchId, marketType: 'Double chance', selectionName: 'X or 2', simulatedOdds: clampOdd(1 / (1 / dx + 1 / a2) * 0.94), active: true },

      { matchId, marketType: 'Total', selectionName: 'Over 0.5', simulatedOdds: jitter(1.07, 7), active: true },
      { matchId, marketType: 'Total', selectionName: 'Over 1.5', simulatedOdds: jitter(1.28, 8), active: true },
      { matchId, marketType: 'Total', selectionName: 'Under 1.5', simulatedOdds: jitter(3.45, 9), active: true },
      { matchId, marketType: 'Total', selectionName: 'Over 2.5', simulatedOdds: oddsHint?.overOdd ?? jitter(1.84, 10), active: true },
      { matchId, marketType: 'Total', selectionName: 'Under 2.5', simulatedOdds: oddsHint?.underOdd ?? jitter(1.96, 11), active: true },
      { matchId, marketType: 'Total', selectionName: 'Over 3.5', simulatedOdds: jitter(3.05, 12), active: true },
      { matchId, marketType: 'Total', selectionName: 'Under 3.5', simulatedOdds: jitter(1.36, 13), active: true },

      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: '1st Total Over 0.5', simulatedOdds: jitter(1.24, 14), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: '1st Total Under 0.5', simulatedOdds: jitter(3.85, 15), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: '1st Total Over 1.5', simulatedOdds: jitter(2.02, 16), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: '1st Total Under 1.5', simulatedOdds: jitter(1.76, 17), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: '1st Total Over 2.5', simulatedOdds: jitter(4.15, 18), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: '1st Total Under 2.5', simulatedOdds: jitter(1.21, 19), active: true },

      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: '2nd Total Over 0.5', simulatedOdds: jitter(1.38, 20), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: '2nd Total Under 0.5', simulatedOdds: jitter(2.95, 21), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: '2nd Total Over 1.5', simulatedOdds: jitter(2.65, 22), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: '2nd Total Under 1.5', simulatedOdds: jitter(1.45, 23), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: '2nd Total Over 2.5', simulatedOdds: jitter(5.6, 24), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: '2nd Total Under 2.5', simulatedOdds: jitter(1.13, 25), active: true },

      { matchId, marketType: 'Both Teams to Score', selectionName: 'Yes', simulatedOdds: jitter(1.74, 26), active: true },
      { matchId, marketType: 'Both Teams to Score', selectionName: 'No', simulatedOdds: jitter(2.06, 27), active: true },

      { matchId, marketType: 'Total Cards', selectionName: 'Cards Over 2.5', simulatedOdds: jitter(1.32, 28), active: true },
      { matchId, marketType: 'Total Cards', selectionName: 'Cards Under 2.5', simulatedOdds: jitter(3.25, 29), active: true },
      { matchId, marketType: 'Total Cards', selectionName: 'Cards Over 3.5', simulatedOdds: jitter(1.78, 30), active: true },
      { matchId, marketType: 'Total Cards', selectionName: 'Cards Under 3.5', simulatedOdds: jitter(1.98, 31), active: true },
      { matchId, marketType: 'Total Cards', selectionName: 'Cards Over 4.5', simulatedOdds: jitter(2.55, 32), active: true },
      { matchId, marketType: 'Total Cards', selectionName: 'Red Card · Yes', simulatedOdds: jitter(4.65, 33), active: true },
      { matchId, marketType: 'Total Cards', selectionName: 'Red Card · No', simulatedOdds: jitter(1.17, 34), active: true },

      { matchId, marketType: 'Team Cards (1st / 2nd)', selectionName: `${homeShort} Cards Over 1.5`, simulatedOdds: jitter(1.88, 35), active: true },
      { matchId, marketType: 'Team Cards (1st / 2nd)', selectionName: `${homeShort} Cards Under 1.5`, simulatedOdds: jitter(1.88, 36), active: true },
      { matchId, marketType: 'Team Cards (1st / 2nd)', selectionName: `${awayShort} Cards Over 1.5`, simulatedOdds: jitter(1.75, 37), active: true },
      { matchId, marketType: 'Team Cards (1st / 2nd)', selectionName: `${awayShort} Cards Under 1.5`, simulatedOdds: jitter(2.02, 38), active: true },

      { matchId, marketType: 'Injuries & Stoppages', selectionName: 'Injury Sub · Yes', simulatedOdds: jitter(3.15, 39), active: true },
      { matchId, marketType: 'Injuries & Stoppages', selectionName: 'Injury Sub · No', simulatedOdds: jitter(1.33, 40), active: true },
      { matchId, marketType: 'Injuries & Stoppages', selectionName: 'Stoppage Time Over 4.5m', simulatedOdds: jitter(1.85, 41), active: true },
      { matchId, marketType: 'Injuries & Stoppages', selectionName: 'Stoppage Time Under 4.5m', simulatedOdds: jitter(1.91, 42), active: true },

      { matchId, marketType: 'First-Half Result', selectionName: '1 (HT)', simulatedOdds: jitter(2.65, 43), active: true },
      { matchId, marketType: 'First-Half Result', selectionName: 'X (HT)', simulatedOdds: jitter(2.15, 44), active: true },
      { matchId, marketType: 'First-Half Result', selectionName: '2 (HT)', simulatedOdds: jitter(3.85, 45), active: true },

      { matchId, marketType: 'Correct Score', selectionName: '1-0', simulatedOdds: jitter(7.2, 46), active: true },
      { matchId, marketType: 'Correct Score', selectionName: '2-0', simulatedOdds: jitter(9.2, 47), active: true },
      { matchId, marketType: 'Correct Score', selectionName: '2-1', simulatedOdds: jitter(8.5, 48), active: true },
      { matchId, marketType: 'Correct Score', selectionName: '1-1', simulatedOdds: jitter(6.4, 49), active: true },
      { matchId, marketType: 'Correct Score', selectionName: '0-0', simulatedOdds: jitter(10.5, 50), active: true },
      { matchId, marketType: 'Correct Score', selectionName: '0-1', simulatedOdds: jitter(11.0, 51), active: true },
      { matchId, marketType: 'Correct Score', selectionName: '1-2', simulatedOdds: jitter(12.5, 52), active: true },
    ];
  }

  if (sportSlug === 'basketball') {
    const hWin = oddsHint?.homeOdd ?? jitter(1.78, 1);
    const aWin = oddsHint?.awayOdd ?? jitter(2.08, 2);
    const line = oddsHint?.overUnderLine ?? 222.5;
    const halfLine = Math.round((line / 2) * 2) / 2;

    return [
      { matchId, marketType: 'Match Winner', selectionName: homeName, simulatedOdds: hWin, active: true },
      { matchId, marketType: 'Match Winner', selectionName: awayName, simulatedOdds: aWin, active: true },
      { matchId, marketType: 'Total Points', selectionName: `Over ${line}`, simulatedOdds: oddsHint?.overOdd ?? jitter(1.9, 3), active: true },
      { matchId, marketType: 'Total Points', selectionName: `Under ${line}`, simulatedOdds: oddsHint?.underOdd ?? jitter(1.92, 4), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: `1st Total Over ${halfLine}`, simulatedOdds: jitter(1.88, 5), active: true },
      { matchId, marketType: `1st Team Total (${homeShort})`, selectionName: `1st Total Under ${halfLine}`, simulatedOdds: jitter(1.92, 6), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: `2nd Total Over ${(halfLine - 1).toFixed(1)}`, simulatedOdds: jitter(1.9, 7), active: true },
      { matchId, marketType: `2nd Team Total (${awayShort})`, selectionName: `2nd Total Under ${(halfLine - 1).toFixed(1)}`, simulatedOdds: jitter(1.9, 8), active: true },
      { matchId, marketType: 'Handicap', selectionName: `${homeShort} -4.5`, simulatedOdds: jitter(1.94, 9), active: true },
      { matchId, marketType: 'Handicap', selectionName: `${awayShort} +4.5`, simulatedOdds: jitter(1.88, 10), active: true },
      { matchId, marketType: 'Fouls & Stoppages', selectionName: 'Tech Foul · Yes', simulatedOdds: jitter(2.35, 11), active: true },
      { matchId, marketType: 'Fouls & Stoppages', selectionName: 'Tech Foul · No', simulatedOdds: jitter(1.56, 12), active: true },
    ];
  }

  if (sportSlug === 'tennis') {
    return [
      { matchId, marketType: 'Match Winner', selectionName: homeName, simulatedOdds: jitter(1.65, 1), active: true },
      { matchId, marketType: 'Match Winner', selectionName: awayName, simulatedOdds: jitter(2.25, 2), active: true },
      { matchId, marketType: 'Set Winner', selectionName: `Set 1 · ${homeShort}`, simulatedOdds: jitter(1.72, 3), active: true },
      { matchId, marketType: 'Set Winner', selectionName: `Set 1 · ${awayShort}`, simulatedOdds: jitter(2.1, 4), active: true },
      { matchId, marketType: 'Total Games', selectionName: 'Over 22.5', simulatedOdds: jitter(1.86, 5), active: true },
      { matchId, marketType: 'Total Games', selectionName: 'Under 22.5', simulatedOdds: jitter(1.94, 6), active: true },
      { matchId, marketType: `1st Player Games (${homeShort})`, selectionName: '1st Total Over 12.5', simulatedOdds: jitter(1.85, 7), active: true },
      { matchId, marketType: `2nd Player Games (${awayShort})`, selectionName: '2nd Total Over 11.5', simulatedOdds: jitter(1.92, 8), active: true },
    ];
  }

  if (sportSlug === 'volleyball') {
    return [
      { matchId, marketType: 'Match Winner', selectionName: homeName, simulatedOdds: jitter(1.7, 1), active: true },
      { matchId, marketType: 'Match Winner', selectionName: awayName, simulatedOdds: jitter(2.16, 2), active: true },
      { matchId, marketType: 'Set Winner', selectionName: `Set 1 · ${homeShort}`, simulatedOdds: jitter(1.76, 3), active: true },
      { matchId, marketType: 'Set Winner', selectionName: `Set 1 · ${awayShort}`, simulatedOdds: jitter(2.04, 4), active: true },
    ];
  }

  return [
    { matchId, marketType: 'Match Winner', selectionName: homeName, simulatedOdds: jitter(1.82, 1), active: true },
    { matchId, marketType: 'Match Winner', selectionName: awayName, simulatedOdds: jitter(1.98, 2), active: true },
    { matchId, marketType: 'Map Winner', selectionName: `Map 1 · ${homeShort}`, simulatedOdds: jitter(1.84, 3), active: true },
    { matchId, marketType: 'Map Winner', selectionName: `Map 1 · ${awayShort}`, simulatedOdds: jitter(1.96, 4), active: true },
  ];
}

// Live in-play odds engine: updates live football/basketball odds based on actual live score, minute & market hint
async function updateDynamicLiveOdds(
  matchId: number,
  sportSlug: string,
  homeScore: number,
  awayScore: number,
  matchTimer: string,
  oddsHint?: RealOddsHint,
  preloadedMarkets?: Array<typeof markets.$inferSelect>
) {
  const existingMkts =
    preloadedMarkets ?? (await db.select().from(markets).where(eq(markets.matchId, matchId)));
  if (existingMkts.length === 0) return;

  if (sportSlug === 'football') {
    const minute = extractLiveMinute(matchTimer);
    const remFrac = Math.max(0.08, (90 - minute) / 90);
    const diff = homeScore - awayScore;
    const totalGoals = homeScore + awayScore;

    let h1 = oddsHint?.homeOdd ?? null;
    let dx = oddsHint?.drawOdd ?? null;
    let a2 = oddsHint?.awayOdd ?? null;

    if (!h1 || !dx || !a2) {
      let pH = 0.38;
      let pD = 0.28;
      let pA = 0.34;
      if (diff > 0) {
        pH = Math.min(0.95, 0.55 + diff * 0.22 + (1 - remFrac) * 0.22);
        pD = Math.max(0.03, (1 - pH) * 0.65);
        pA = Math.max(0.02, 1 - pH - pD);
      } else if (diff < 0) {
        pA = Math.min(0.95, 0.55 + Math.abs(diff) * 0.22 + (1 - remFrac) * 0.22);
        pD = Math.max(0.03, (1 - pA) * 0.65);
        pH = Math.max(0.02, 1 - pA - pD);
      } else {
        pD = Math.min(0.84, 0.29 + (1 - remFrac) * 0.48);
        pH = (1 - pD) * 0.52;
        pA = 1 - pD - pH;
      }
      h1 = clampOdd(0.94 / pH);
      dx = clampOdd(0.94 / pD);
      a2 = clampOdd(0.94 / pA);
    }

    const dc1x = clampOdd(0.94 / (0.94 / h1 + 0.94 / dx));
    const dc12 = clampOdd(0.94 / (0.94 / h1 + 0.94 / a2));
    const dcx2 = clampOdd(0.94 / (0.94 / dx + 0.94 / a2));

    const pendingUpdates: Promise<unknown>[] = [];
    for (const mkt of existingMkts) {
      let nextOdd = mkt.simulatedOdds;
      let nextActive = true;

      if (mkt.marketType === '1×2') {
        if (mkt.selectionName === '1') nextOdd = h1;
        else if (mkt.selectionName === 'X') nextOdd = dx;
        else if (mkt.selectionName === '2') nextOdd = a2;
      } else if (mkt.marketType === 'Double chance') {
        if (mkt.selectionName === '1 or X') nextOdd = dc1x;
        else if (mkt.selectionName === '1 or 2') nextOdd = dc12;
        else if (mkt.selectionName === 'X or 2') nextOdd = dcx2;
      } else if (mkt.marketType === 'Total') {
        const numMatch = mkt.selectionName.match(/([\d.]+)/);
        const line = numMatch ? Number(numMatch[1]) : 2.5;
        if (totalGoals > line) {
          nextActive = false;
        } else {
          const needed = Math.ceil(line - totalGoals);
          const expectedRem = Math.max(0.15, 2.5 * remFrac);
          const pOver = Math.min(0.94, Math.max(0.06, expectedRem / (expectedRem + needed * 1.15)));
          if (mkt.selectionName.startsWith('Over')) nextOdd = clampOdd(0.94 / pOver);
          else nextOdd = clampOdd(0.94 / (1 - pOver));
        }
      } else if (mkt.marketType.startsWith('1st Team Total')) {
        const numMatch = mkt.selectionName.match(/([\d.]+)/);
        const line = numMatch ? Number(numMatch[1]) : 1.5;
        if (homeScore > line) nextActive = false;
        else {
          const needed = Math.ceil(line - homeScore);
          const expectedRem = Math.max(0.1, 1.35 * remFrac);
          const pOver = Math.min(0.92, Math.max(0.05, expectedRem / (expectedRem + needed * 1.2)));
          nextOdd = mkt.selectionName.includes('Over') ? clampOdd(0.94 / pOver) : clampOdd(0.94 / (1 - pOver));
        }
      } else if (mkt.marketType.startsWith('2nd Team Total')) {
        const numMatch = mkt.selectionName.match(/([\d.]+)/);
        const line = numMatch ? Number(numMatch[1]) : 1.5;
        if (awayScore > line) nextActive = false;
        else {
          const needed = Math.ceil(line - awayScore);
          const expectedRem = Math.max(0.1, 1.15 * remFrac);
          const pOver = Math.min(0.92, Math.max(0.05, expectedRem / (expectedRem + needed * 1.2)));
          nextOdd = mkt.selectionName.includes('Over') ? clampOdd(0.94 / pOver) : clampOdd(0.94 / (1 - pOver));
        }
      }

      if (Math.abs(nextOdd - mkt.simulatedOdds) >= 0.02 || nextActive !== mkt.active) {
        pendingUpdates.push(
          db
            .update(markets)
            .set({ simulatedOdds: nextOdd, active: nextActive })
            .where(eq(markets.id, mkt.id))
        );
      }
    }
    if (pendingUpdates.length > 0) {
      await Promise.all(pendingUpdates);
    }
  } else if (oddsHint?.homeOdd && oddsHint?.awayOdd) {
    const pendingUpdates: Promise<unknown>[] = [];
    for (const mkt of existingMkts) {
      if (mkt.marketType === 'Match Winner') {
        const nextOdd = mkt.selectionName === existingMkts[0]?.selectionName ? oddsHint.homeOdd : oddsHint.awayOdd;
        if (nextOdd && Math.abs(nextOdd - mkt.simulatedOdds) >= 0.02) {
          pendingUpdates.push(
            db.update(markets).set({ simulatedOdds: nextOdd }).where(eq(markets.id, mkt.id))
          );
        }
      }
    }
    if (pendingUpdates.length > 0) {
      await Promise.all(pendingUpdates);
    }
  }
}

async function getOrCreateTeam(
  name: string,
  shortName: string,
  sportId: number,
  teamCache: Map<string, typeof teams.$inferSelect>,
  logoOrColor?: string
) {
  const cacheKey = `${sportId}:${name.trim().toLowerCase()}`;
  const cached = teamCache.get(cacheKey);

  if (cached) {
    if (logoOrColor && logoOrColor.startsWith('http') && !cached.logo.startsWith('http')) {
      const [updated] = await db
        .update(teams)
        .set({ logo: logoOrColor })
        .where(eq(teams.id, cached.id))
        .returning();
      teamCache.set(cacheKey, updated);
      return updated;
    }
    return cached;
  }

  const [created] = await db
    .insert(teams)
    .values({
      name,
      shortName: shortName || makeShortName(name),
      logo: logoOrColor || pickColor(name),
      sportId,
    })
    .returning();
  teamCache.set(cacheKey, created);
  return created;
}

async function ensureCompetition(
  slug: string,
  name: string,
  sportId: number,
  country: string,
  featured: boolean,
  compBySlug: Map<string, typeof competitions.$inferSelect>
) {
  let comp = compBySlug.get(slug);
  if (comp) return comp;

  const [inserted] = await db
    .insert(competitions)
    .values({ slug, name, sportId, country, featured })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    compBySlug.set(slug, inserted);
    return inserted;
  }

  const [refetched] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, slug))
    .limit(1);
  if (refetched) compBySlug.set(slug, refetched);
  return refetched;
}

async function ensureExpandedMarketsForOpenMatches() {
  const openMatches = await db
    .select()
    .from(matches)
    .where(ne(matches.status, 'finished'));

  if (openMatches.length === 0) return;

  const [sportRows, teamRows, existingMarkets] = await Promise.all([
    db.select().from(sports),
    db.select().from(teams),
    db.select().from(markets).where(inArray(markets.matchId, openMatches.map((m) => m.id))),
  ]);

  const sportMap = new Map(sportRows.map((s) => [s.id, s]));
  const teamMap = new Map(teamRows.map((t) => [t.id, t]));
  const marketsByMatch = new Map<number, typeof existingMarkets>();
  for (const mkt of existingMarkets) {
    const list = marketsByMatch.get(mkt.matchId) || [];
    list.push(mkt);
    marketsByMatch.set(mkt.matchId, list);
  }

  for (const m of openMatches) {
    const current = marketsByMatch.get(m.id) || [];
    const hasTeamTotals = current.some((c) => c.marketType.startsWith('1st Team Total'));
    if (hasTeamTotals) continue;

    const sp = sportMap.get(m.sportId)?.slug || 'football';
    const homeName = teamMap.get(m.homeTeamId)?.name || 'Home';
    const awayName = teamMap.get(m.awayTeamId)?.name || 'Away';
    const fullMarkets = buildSimulatedMarketsForSport(m.id, sp, homeName, awayName, m.id);

    const existingKeys = new Set(current.map((c) => `${c.marketType}::${c.selectionName}`));
    const missing = fullMarkets.filter((fm) => !existingKeys.has(`${fm.marketType}::${fm.selectionName}`));
    if (missing.length > 0) {
      await db.insert(markets).values(missing);
    }
  }
}

interface UnifiedFixture {
  externalId: string;
  sportSlug: string;
  competitionSlug: string;
  competitionName: string;
  country: string;
  featuredComp: boolean;
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number;
  awayScore: number;
  status: 'live' | 'upcoming' | 'finished';
  matchTimer: string;
  startTime: Date;
  featured: boolean;
  oddsHint?: RealOddsHint;
}

async function fetchLiveScoreFootballFixtures(): Promise<{ fixtures: UnifiedFixture[]; sources: string[] }> {
  const fixtures: UnifiedFixture[] = [];
  const sources: string[] = [];
  const seenEids = new Set<string>();

  const now = new Date();
  const todayYmd = toYmd(now);
  const tomorrowYmd = toYmd(new Date(now.getTime() + 86400_000));

  const urls = [
    { url: 'https://prod-public-api.livescore.com/v1/api/app/live/soccer/0?MD=1', isLiveFeed: true },
    { url: `https://prod-public-api.livescore.com/v1/api/app/date/soccer/${todayYmd}/0?MD=1`, isLiveFeed: false },
    { url: `https://prod-public-api.livescore.com/v1/api/app/date/soccer/${tomorrowYmd}/0?MD=1`, isLiveFeed: false },
  ];

  const fetchTimeout = process.env.VERCEL === '1' ? 3200 : 5500;
  const responses = await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u.url, {
          headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 MYBET/4.0' },
          signal: AbortSignal.timeout(fetchTimeout),
        });
        if (!res.ok) return null;
        return { isLiveFeed: u.isLiveFeed, json: await res.json() };
      } catch {
        return null;
      }
    })
  );

  for (const r of responses) {
    if (!r?.json?.Stages || !Array.isArray(r.json.Stages)) continue;
    sources.push(r.isLiveFeed ? 'LiveScore Live' : 'LiveScore Schedule');

    for (const stage of r.json.Stages) {
      const compName = String(stage.Snm || 'Football League').trim();
      const country = String(stage.Cnm || 'International').trim();
      const compSlug = String(stage.Scd || compName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 60);
      const isPriorityLeague =
        PRIORITY_LIVESCORE_LEAGUES.has(compName.toLowerCase()) ||
        isTunisiaOrGermanyStage(country, compName);

      if (!r.isLiveFeed && !isPriorityLeague) {
        // Skip minor non-live divisions from the huge 185-stage list to keep board sharp
        const hasLiveInStage = (stage.Events || []).some(
          (ev: any) => parseLiveScoreStatus(ev.Esid, ev.Eps, false) === 'live'
        );
        if (!hasLiveInStage) continue;
      }

      for (const ev of stage.Events || []) {
        const eid = String(ev.Eid || '');
        if (!eid || seenEids.has(eid)) continue;

        const status = parseLiveScoreStatus(ev.Esid, ev.Eps, r.isLiveFeed);
        if (status === 'skip') continue;

        const t1 = ev.T1?.[0];
        const t2 = ev.T2?.[0];
        const homeName = String(t1?.Nm || '').trim();
        const awayName = String(t2?.Nm || '').trim();
        if (!homeName || !awayName) continue;

        seenEids.add(eid);

        const homeScore = Number.parseInt(ev.Tr1 ?? '0', 10) || 0;
        const awayScore = Number.parseInt(ev.Tr2 ?? '0', 10) || 0;
        const startTime = parseLiveScoreDate(ev.Esd);
        const matchTimer =
          status === 'finished'
            ? 'FT'
            : status === 'live'
            ? String(ev.Eps || 'LIVE')
            : 'Scheduled';

        const homeLogo = t1?.Img ? `https://lsm-static-prod.livescore.com/medium/${t1.Img}` : undefined;
        const awayLogo = t2?.Img ? `https://lsm-static-prod.livescore.com/medium/${t2.Img}` : undefined;

        fixtures.push({
          externalId: `ls_soccer_${eid}`,
          sportSlug: 'football',
          competitionSlug: `${country.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${compSlug}`.slice(0, 80),
          competitionName: compName,
          country,
          featuredComp: isPriorityLeague,
          homeName,
          awayName,
          homeShort: String(t1?.Abr || makeShortName(homeName)),
          awayShort: String(t2?.Abr || makeShortName(awayName)),
          homeLogo,
          awayLogo,
          homeScore,
          awayScore,
          status,
          matchTimer,
          startTime,
          featured: status === 'live' || isPriorityLeague,
        });
      }
    }
  }

  // Prioritize Live, Tunisia, Germany, and major featured leagues before capping
  fixtures.sort((a, b) => {
    const aScore = (a.status === 'live' ? 4 : 0) + (isTunisiaOrGermanyStage(a.country, a.competitionName) ? 2 : 0) + (a.featuredComp ? 1 : 0);
    const bScore = (b.status === 'live' ? 4 : 0) + (isTunisiaOrGermanyStage(b.country, b.competitionName) ? 2 : 0) + (b.featuredComp ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  return { fixtures: fixtures.slice(0, 220), sources };
}

async function fetchEspnFixtures(): Promise<{ fixtures: UnifiedFixture[]; sources: string[] }> {
  const fixtures: UnifiedFixture[] = [];
  const sources: string[] = [];

  const espnFeeds: LiveFeedSpec[] = [
    ...PUBLIC_LIVE_FEEDS,
    {
      url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
      sportSlug: 'football',
      competitionSlug: 'world-football',
      competitionName: 'World Football',
      country: 'International',
    },
  ];

  const fetchTimeout = process.env.VERCEL === '1' ? 3200 : 5000;
  const results = await Promise.all(
    espnFeeds.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { Accept: 'application/json', 'User-Agent': 'MYBET-LiveSync/4.0' },
          signal: AbortSignal.timeout(fetchTimeout),
        });
        if (!res.ok) return null;
        return { feed, json: await res.json() };
      } catch {
        return null;
      }
    })
  );

  for (const item of results) {
    if (!item?.json?.events || !Array.isArray(item.json.events)) continue;
    const { feed, json } = item;
    sources.push(feed.competitionName);

    const leagueNameFromFeed = String(json.leagues?.[0]?.name || feed.competitionName);
    const extractedComps: Array<{ comp: any; compName: string; ev: any }> = [];

    for (const ev of json.events) {
      if (Array.isArray(ev?.groupings) && ev.groupings.length > 0) {
        for (const grp of ev.groupings) {
          const grpTitle = grp?.grouping?.displayName || ev?.name || leagueNameFromFeed;
          for (const gc of grp?.competitions || []) {
            extractedComps.push({ comp: gc, compName: String(grpTitle).slice(0, 64), ev });
          }
        }
      } else if (ev?.competitions?.[0]) {
        extractedComps.push({
          comp: ev.competitions[0],
          compName: feed.competitionSlug === 'world-football' ? leagueNameFromFeed : feed.competitionName,
          ev,
        });
      }
    }

    const sortedComps = extractedComps.sort((a, b) => {
      const aState = a.comp?.status?.type?.state || a.ev?.status?.type?.state;
      const bState = b.comp?.status?.type?.state || b.ev?.status?.type?.state;
      const aLive = aState === 'in' ? 0 : aState === 'pre' ? 1 : 2;
      const bLive = bState === 'in' ? 0 : bState === 'pre' ? 1 : 2;
      return aLive - bLive;
    });
    const limited = sortedComps.slice(0, feed.competitionSlug === 'world-football' ? 80 : 24);

    for (let i = 0; i < limited.length; i++) {
      const { comp: comp0, compName, ev } = limited[i];
      const competitors = comp0?.competitors;
      if (!Array.isArray(competitors) || competitors.length < 2) continue;

      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

      const homeName = homeComp?.team?.displayName || homeComp?.athlete?.displayName || homeComp?.team?.name;
      const awayName = awayComp?.team?.displayName || awayComp?.athlete?.displayName || awayComp?.team?.name;
      if (!homeName || !awayName || homeName === 'TBD' || awayName === 'TBD') continue;

      const homeShort = homeComp?.team?.abbreviation || makeShortName(homeName);
      const awayShort = awayComp?.team?.abbreviation || makeShortName(awayName);
      const homeLogo =
        homeComp?.team?.logo ||
        homeComp?.athlete?.flag?.href ||
        (homeComp?.team?.color ? `#${homeComp.team.color}` : undefined);
      const awayLogo =
        awayComp?.team?.logo ||
        awayComp?.athlete?.flag?.href ||
        (awayComp?.team?.color ? `#${awayComp.team.color}` : undefined);

      const homeScore = Number.parseInt(homeComp?.score ?? '0', 10) || 0;
      const awayScore = Number.parseInt(awayComp?.score ?? '0', 10) || 0;

      const statusObj = comp0?.status || ev?.status;
      const state = statusObj?.type?.state;
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (state === 'in') status = 'live';
      else if (state === 'post') status = 'finished';

      const displayClock =
        statusObj?.type?.shortDetail ||
        statusObj?.displayClock ||
        (status === 'finished' ? 'FT' : 'Scheduled');
      const startTime = comp0?.date ? new Date(comp0.date) : ev?.date ? new Date(ev.date) : new Date();

      const oddRaw = Array.isArray(comp0?.odds) && comp0.odds.length > 0 ? comp0.odds[0] : null;
      const oddsHint: RealOddsHint | undefined = oddRaw
        ? {
            homeOdd: americanToDecimal(oddRaw.moneyline?.home?.close?.odds ?? oddRaw.homeTeamOdds?.moneyLine),
            drawOdd: americanToDecimal(oddRaw.moneyline?.draw?.close?.odds ?? oddRaw.drawOdds?.moneyLine),
            awayOdd: americanToDecimal(oddRaw.moneyline?.away?.close?.odds ?? oddRaw.awayTeamOdds?.moneyLine),
            overUnderLine: Number.isFinite(Number(oddRaw.overUnder)) ? Number(oddRaw.overUnder) : null,
            overOdd: americanToDecimal(oddRaw.total?.over?.close?.odds ?? oddRaw.overOdds),
            underOdd: americanToDecimal(oddRaw.total?.under?.close?.odds ?? oddRaw.underOdds),
          }
        : undefined;

      const compSlug =
        feed.sportSlug === 'tennis'
          ? `${feed.competitionSlug}-${compName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 64)
          : feed.competitionSlug;

      fixtures.push({
        externalId: `espn_${feed.competitionSlug}_${comp0.id || ev.id}`,
        sportSlug: feed.sportSlug,
        competitionSlug: compSlug,
        competitionName: compName,
        country: feed.country,
        featuredComp: true,
        homeName,
        awayName,
        homeShort,
        awayShort,
        homeLogo,
        awayLogo,
        homeScore,
        awayScore,
        status,
        matchTimer: String(displayClock).slice(0, 28),
        startTime,
        featured: status === 'live' || i < 2,
        oddsHint,
      });
    }
  }

  return { fixtures, sources };
}

function buildMultiSportBoardSupplement(existingFixtures: UnifiedFixture[]): UnifiedFixture[] {
  const now = Date.now();
  const existingKeys = new Set(
    existingFixtures.map((f) => buildMatchDedupeKey(f.sportSlug, f.homeName, f.awayName))
  );

  const countBySport = (slug: string) =>
    existingFixtures.filter((f) => f.sportSlug === slug && f.status !== 'finished').length;

  const anchorHour = new Date();
  anchorHour.setMinutes(0, 0, 0);
  const baseTs = anchorHour.getTime();
  const dayKey = toYmd(anchorHour);

  const candidates: UnifiedFixture[] = [
    // Tunisian Ligue 1 & Arab Derby Football highlights (if not already live from LiveScore)
    {
      externalId: `mybet_tn_est_ca_${dayKey}`,
      sportSlug: 'football',
      competitionSlug: 'tunisia-ligue-1',
      competitionName: 'Ligue Professionnelle 1',
      country: 'Tunisie',
      featuredComp: true,
      homeName: 'Espérance de Tunis',
      awayName: 'Club Africain',
      homeShort: 'EST',
      awayShort: 'CA',
      homeScore: 2,
      awayScore: 1,
      status: 'live',
      matchTimer: "67'",
      startTime: new Date(now - 67 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 1.72, drawOdd: 3.4, awayOdd: 4.6 },
    },
    {
      externalId: `mybet_tn_ess_css_${dayKey}`,
      sportSlug: 'football',
      competitionSlug: 'tunisia-ligue-1',
      competitionName: 'Ligue Professionnelle 1',
      country: 'Tunisie',
      featuredComp: true,
      homeName: 'Étoile du Sahel',
      awayName: 'CS Sfaxien',
      homeShort: 'ESS',
      awayShort: 'CSS',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 3 * 3600_000),
      featured: true,
      oddsHint: { homeOdd: 2.15, drawOdd: 3.05, awayOdd: 3.45 },
    },
    // Tennis ATP / WTA (when ESPN ATP/WTA scoreboard is off-season/empty)
    {
      externalId: `mybet_ten_sinner_alcaraz_${dayKey}`,
      sportSlug: 'tennis',
      competitionSlug: 'atp-masters',
      competitionName: 'ATP Masters 1000',
      country: 'International',
      featuredComp: true,
      homeName: 'Jannik Sinner',
      awayName: 'Carlos Alcaraz',
      homeShort: 'SIN',
      awayShort: 'ALC',
      homeScore: 1,
      awayScore: 1,
      status: 'live',
      matchTimer: 'Set 3 · 4-3',
      startTime: new Date(now - 95 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 1.78, awayOdd: 2.02 },
    },
    {
      externalId: `mybet_ten_zverev_djokovic_${dayKey}`,
      sportSlug: 'tennis',
      competitionSlug: 'atp-masters',
      competitionName: 'ATP Masters 1000',
      country: 'International',
      featuredComp: true,
      homeName: 'Alexander Zverev',
      awayName: 'Novak Djokovic',
      homeShort: 'ZVE',
      awayShort: 'DJO',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 2 * 3600_000),
      featured: true,
      oddsHint: { homeOdd: 2.1, awayOdd: 1.72 },
    },
    {
      externalId: `mybet_ten_medvedev_fritz_${dayKey}`,
      sportSlug: 'tennis',
      competitionSlug: 'atp-masters',
      competitionName: 'ATP Masters 1000',
      country: 'International',
      featuredComp: true,
      homeName: 'Daniil Medvedev',
      awayName: 'Taylor Fritz',
      homeShort: 'MED',
      awayShort: 'FRI',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 4 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.65, awayOdd: 2.22 },
    },
    {
      externalId: `mybet_ten_jabeur_sabalenka_${dayKey}`,
      sportSlug: 'tennis',
      competitionSlug: 'wta-1000',
      competitionName: 'WTA 1000 Tour',
      country: 'International',
      featuredComp: true,
      homeName: 'Ons Jabeur',
      awayName: 'Aryna Sabalenka',
      homeShort: 'JAB',
      awayShort: 'SAB',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      matchTimer: 'Set 2 · 3-2',
      startTime: new Date(now - 55 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 2.05, awayOdd: 1.75 },
    },
    {
      externalId: `mybet_ten_swiatek_gauff_${dayKey}`,
      sportSlug: 'tennis',
      competitionSlug: 'wta-1000',
      competitionName: 'WTA 1000 Tour',
      country: 'International',
      featuredComp: true,
      homeName: 'Iga Swiatek',
      awayName: 'Coco Gauff',
      homeShort: 'SWI',
      awayShort: 'GAU',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 5 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.52, awayOdd: 2.48 },
    },
    // Basketball EuroLeague & Tunisia Pro A
    {
      externalId: `mybet_bask_real_olympiacos_${dayKey}`,
      sportSlug: 'basketball',
      competitionSlug: 'euroleague',
      competitionName: 'EuroLeague',
      country: 'Europe',
      featuredComp: true,
      homeName: 'Real Madrid Baloncesto',
      awayName: 'Olympiacos BC',
      homeShort: 'RMB',
      awayShort: 'OLY',
      homeScore: 68,
      awayScore: 64,
      status: 'live',
      matchTimer: 'Q3 04:12',
      startTime: new Date(now - 62 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 1.58, awayOdd: 2.34 },
    },
    {
      externalId: `mybet_bask_pana_fener_${dayKey}`,
      sportSlug: 'basketball',
      competitionSlug: 'euroleague',
      competitionName: 'EuroLeague',
      country: 'Europe',
      featuredComp: true,
      homeName: 'Panathinaikos',
      awayName: 'Fenerbahce Beko',
      homeShort: 'PAO',
      awayShort: 'FEN',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 2 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.68, awayOdd: 2.15 },
    },
    {
      externalId: `mybet_bask_usm_ca_${dayKey}`,
      sportSlug: 'basketball',
      competitionSlug: 'pro-a-tunisie',
      competitionName: 'Pro A Tunisie',
      country: 'Tunisie',
      featuredComp: true,
      homeName: 'US Monastir',
      awayName: 'Club Africain Basket',
      homeShort: 'USM',
      awayShort: 'CAB',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 3 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.62, awayOdd: 2.24 },
    },
    // Volleyball
    {
      externalId: `mybet_vol_perugia_trentino_${dayKey}`,
      sportSlug: 'volleyball',
      competitionSlug: 'cev-champions-league',
      competitionName: 'CEV Champions League',
      country: 'Europe',
      featuredComp: true,
      homeName: 'Sir Safety Perugia',
      awayName: 'Itas Trentino',
      homeShort: 'PER',
      awayShort: 'TRE',
      homeScore: 2,
      awayScore: 1,
      status: 'live',
      matchTimer: 'Set 4 · 16-14',
      startTime: new Date(now - 72 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 1.48, awayOdd: 2.58 },
    },
    {
      externalId: `mybet_vol_est_css_${dayKey}`,
      sportSlug: 'volleyball',
      competitionSlug: 'tunisie-nationale-a',
      competitionName: 'Nationale A Tunisie',
      country: 'Tunisie',
      featuredComp: true,
      homeName: 'EST Volleyball',
      awayName: 'CS Sfaxien Volley',
      homeShort: 'EST',
      awayShort: 'CSS',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 3 * 3600_000),
      featured: true,
      oddsHint: { homeOdd: 1.55, awayOdd: 2.4 },
    },
    {
      externalId: `mybet_vol_jastrzebski_zaksa_${dayKey}`,
      sportSlug: 'volleyball',
      competitionSlug: 'plusliga',
      competitionName: 'PlusLiga',
      country: 'Poland',
      featuredComp: false,
      homeName: 'Jastrzebski Wegiel',
      awayName: 'ZAKSA Kedzierzyn',
      homeShort: 'JAS',
      awayShort: 'ZAK',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 5 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.66, awayOdd: 2.18 },
    },
    {
      externalId: `mybet_vol_lube_modena_${dayKey}`,
      sportSlug: 'volleyball',
      competitionSlug: 'superlega-italy',
      competitionName: 'SuperLega Italie',
      country: 'Italy',
      featuredComp: false,
      homeName: 'Cucine Lube Civitanova',
      awayName: 'Valsa Group Modena',
      homeShort: 'LUB',
      awayShort: 'MOD',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 6 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.44, awayOdd: 2.7 },
    },
    // Esports
    {
      externalId: `mybet_esp_vitality_navi_${dayKey}`,
      sportSlug: 'esports',
      competitionSlug: 'cs2-major',
      competitionName: 'CS2 Pro League',
      country: 'International',
      featuredComp: true,
      homeName: 'Team Vitality',
      awayName: 'Natus Vincere',
      homeShort: 'VIT',
      awayShort: 'NAV',
      homeScore: 1,
      awayScore: 1,
      status: 'live',
      matchTimer: 'Map 3 · 9-8',
      startTime: new Date(now - 80 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 1.75, awayOdd: 2.04 },
    },
    {
      externalId: `mybet_esp_g2_faze_${dayKey}`,
      sportSlug: 'esports',
      competitionSlug: 'cs2-major',
      competitionName: 'CS2 Pro League',
      country: 'International',
      featuredComp: true,
      homeName: 'G2 Esports',
      awayName: 'FaZe Clan',
      homeShort: 'G2',
      awayShort: 'FAZ',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 2 * 3600_000),
      featured: true,
      oddsHint: { homeOdd: 1.82, awayOdd: 1.94 },
    },
    {
      externalId: `mybet_esp_t1_geng_${dayKey}`,
      sportSlug: 'esports',
      competitionSlug: 'lck-worlds',
      competitionName: 'LoL LCK Championship',
      country: 'International',
      featuredComp: true,
      homeName: 'T1',
      awayName: 'Gen.G',
      homeShort: 'T1',
      awayShort: 'GEN',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      matchTimer: 'Game 2 · 22m',
      startTime: new Date(now - 42 * 60_000),
      featured: true,
      oddsHint: { homeOdd: 1.62, awayOdd: 2.25 },
    },
    {
      externalId: `mybet_esp_fnatic_karmine_${dayKey}`,
      sportSlug: 'esports',
      competitionSlug: 'valorant-vct',
      competitionName: 'Valorant VCT EMEA',
      country: 'Europe',
      featuredComp: true,
      homeName: 'Fnatic',
      awayName: 'Karmine Corp',
      homeShort: 'FNC',
      awayShort: 'KC',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      matchTimer: 'Scheduled',
      startTime: new Date(baseTs + 4 * 3600_000),
      featured: false,
      oddsHint: { homeOdd: 1.54, awayOdd: 2.42 },
    },
  ];

  const additions: UnifiedFixture[] = [];
  for (const cand of candidates) {
    const k = buildMatchDedupeKey(cand.sportSlug, cand.homeName, cand.awayName);
    if (existingKeys.has(k)) continue;
    // Always add Tunisia Ligue 1 / Tennis / Volleyball / Esports / EuroLeague when sport coverage is thin (< 6 events)
    const currentCount = countBySport(cand.sportSlug);
    const shouldAdd =
      cand.sportSlug === 'tennis' ||
      cand.sportSlug === 'volleyball' ||
      cand.sportSlug === 'esports' ||
      (cand.sportSlug === 'basketball' && currentCount < 8) ||
      (cand.sportSlug === 'football' && cand.country === 'Tunisie');
    if (shouldAdd) {
      existingKeys.add(k);
      additions.push(cand);
    }
  }
  return additions;
}

// Resolves & unsticks any DB match that remained 'live' or past-startTime 'upcoming' when feeds rolled over
async function resolveStaleOrStuckMatches(seenExternalIds: Set<string>, skipRemoteLookups = false) {
  const openMatches = await db.select().from(matches).where(ne(matches.status, 'finished'));
  const now = Date.now();

  const candidates = openMatches.filter((m) => {
    if (m.externalId && seenExternalIds.has(m.externalId)) return false;
    const ageHours = (now - new Date(m.startTime).getTime()) / 3600_000;
    return m.status === 'live' || (m.status === 'upcoming' && ageHours >= 0.05);
  });

  if (candidates.length === 0) return;

  // Fetch up to 6 LiveScore scoreboards in parallel to keep execution snappy
  const lookupTargets = skipRemoteLookups
    ? []
    : candidates.filter((m) => m.externalId?.startsWith('ls_soccer_')).slice(0, 6);

  const lookupMap = new Map<number, any>();
  if (lookupTargets.length > 0) {
    await Promise.all(
      lookupTargets.map(async (m) => {
        const eid = m.externalId!.replace('ls_soccer_', '');
        try {
          const res = await fetch(
            `https://prod-public-api.livescore.com/v1/api/app/scoreboard/soccer/${eid}?MD=1`,
            {
              headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 MYBET/4.0' },
              signal: AbortSignal.timeout(2500),
            }
          );
          if (res.ok) {
            lookupMap.set(m.id, await res.json());
          }
        } catch {
          // Ignore individual timeout
        }
      })
    );
  }

  for (const m of candidates) {
    const ageHours = (now - new Date(m.startTime).getTime()) / 3600_000;
    let resolvedStatus: 'live' | 'upcoming' | 'finished' = m.status as any;
    let homeScore = m.homeScore;
    let awayScore = m.awayScore;
    let matchTimer = m.matchTimer;

    const sb = lookupMap.get(m.id);
    if (sb) {
      const st = parseLiveScoreStatus(sb.Esid, sb.Eps, false);
      homeScore = Number.parseInt(sb.Tr1 ?? String(homeScore), 10) || homeScore;
      awayScore = Number.parseInt(sb.Tr2 ?? String(awayScore), 10) || awayScore;
      if (st === 'finished' || st === 'skip') {
        resolvedStatus = 'finished';
        matchTimer = String(sb.Eps || 'FT').slice(0, 28);
      } else if (st === 'live') {
        resolvedStatus = 'live';
        matchTimer = String(sb.Eps || matchTimer).slice(0, 28);
      }
    }

    if (resolvedStatus !== 'finished' && ageHours >= 3.5) {
      resolvedStatus = 'finished';
      matchTimer = 'FT';
    }

    if (
      resolvedStatus !== m.status ||
      homeScore !== m.homeScore ||
      awayScore !== m.awayScore ||
      matchTimer !== m.matchTimer
    ) {
      await db
        .update(matches)
        .set({
          status: resolvedStatus,
          homeScore,
          awayScore,
          matchTimer,
          dataSource: 'live_api',
        })
        .where(eq(matches.id, m.id));

      if (m.status !== 'finished' && resolvedStatus === 'finished') {
        await settleBetsForFinishedMatch(m.id);
      }
    }
  }
}

let lastSyncTimestamp = 0;
let activeSyncPromise: Promise<{ synced: number; updated: number; sources: string[] }> | null = null;

export async function syncIfStale(): Promise<void> {
  const cooldownMs = process.env.VERCEL === '1' ? 20_000 : 8_000;
  if (Date.now() - lastSyncTimestamp > cooldownMs) {
    await syncLiveSportsFeeds();
  }
}

export async function syncLiveSportsFeeds(): Promise<{ synced: number; updated: number; sources: string[] }> {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    const syncStart = Date.now();
    const isVercel = process.env.VERCEL === '1';
    const deadlineMs = isVercel ? 5_200 : 25_000;
    lastSyncTimestamp = syncStart;

    let synced = 0;
    let updated = 0;
    const activeSources: string[] = [];
    const seenExternalIds = new Set<string>();

    try {
      assertDatabaseConfigured();
      const [sportRows, compRows, teamRows, existingMatchRows] = await Promise.all([
        db.select().from(sports),
        db.select().from(competitions),
        db.select().from(teams),
        db.select().from(matches),
      ]);

      const sportBySlug = new Map(sportRows.map((s) => [s.slug, s]));
      const compBySlug = new Map(compRows.map((c) => [c.slug, c]));
      const teamById = new Map(teamRows.map((t) => [t.id, t]));
      const teamCache = new Map<string, typeof teams.$inferSelect>(
        teamRows.map((t) => [`${t.sportId}:${t.name.trim().toLowerCase()}`, t])
      );

      const existingByExtId = new Map<string, typeof matches.$inferSelect>();
      const existingByPairKey = new Map<string, typeof matches.$inferSelect>();
      const liveMatchIds: number[] = [];

      for (const em of existingMatchRows) {
        if (em.externalId) existingByExtId.set(em.externalId, em);
        if (em.status === 'live') liveMatchIds.push(em.id);
        const ht = teamById.get(em.homeTeamId);
        const at = teamById.get(em.awayTeamId);
        if (ht && at) {
          existingByPairKey.set(buildMatchDedupeKey(em.sportId, ht.name, at.name), em);
        }
      }

      const [espnRes, lsRes] = await Promise.all([fetchEspnFixtures(), fetchLiveScoreFootballFixtures()]);
      activeSources.push(...espnRes.sources, ...lsRes.sources);

      // Deduplicate preferring ESPN first (carries real DraftKings odds + HD team crests)
      const baseCombined: UnifiedFixture[] = [...espnRes.fixtures, ...lsRes.fixtures];
      const supplementFixtures = buildMultiSportBoardSupplement(baseCombined);
      const rawCombined: UnifiedFixture[] = [...baseCombined, ...supplementFixtures];
      const batchPairDedupe = new Set<string>();
      const dedupedFixtures: Array<{ fx: UnifiedFixture; sport: typeof sportRows[number]; pairKey: string }> = [];

      for (const fx of rawCombined) {
        const sport = sportBySlug.get(fx.sportSlug);
        if (!sport) continue;
        const pairKey = buildMatchDedupeKey(sport.id, fx.homeName, fx.awayName);
        if (batchPairDedupe.has(pairKey)) continue;
        batchPairDedupe.add(pairKey);
        dedupedFixtures.push({ fx, sport, pairKey });
      }

      // Prioritize existing match updates, live matches, Tunisia & Germany, then featured leagues
      dedupedFixtures.sort((a, b) => {
        const aExisting = existingByExtId.has(a.fx.externalId) || existingByPairKey.has(a.pairKey) ? 1 : 0;
        const bExisting = existingByExtId.has(b.fx.externalId) || existingByPairKey.has(b.pairKey) ? 1 : 0;
        if (aExisting !== bExisting) return bExisting - aExisting;
        const aLive = a.fx.status === 'live' ? 1 : 0;
        const bLive = b.fx.status === 'live' ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        const aLocal = isTunisiaOrGermanyStage(a.fx.country, a.fx.competitionName) ? 1 : 0;
        const bLocal = isTunisiaOrGermanyStage(b.fx.country, b.fx.competitionName) ? 1 : 0;
        if (aLocal !== bLocal) return bLocal - aLocal;
        if (a.fx.featured !== b.fx.featured) return a.fx.featured ? -1 : 1;
        return a.fx.startTime.getTime() - b.fx.startTime.getTime();
      });

      // Preload all live match markets in 1 query so dynamic live odds updates don't do N selects
      const liveMarketsRows =
        liveMatchIds.length > 0
          ? await db.select().from(markets).where(inArray(markets.matchId, liveMatchIds))
          : [];
      const liveMarketsByMatch = new Map<number, typeof liveMarketsRows>();
      for (const mk of liveMarketsRows) {
        const list = liveMarketsByMatch.get(mk.matchId) || [];
        list.push(mk);
        liveMarketsByMatch.set(mk.matchId, list);
      }

      const pendingMarketInserts: Array<typeof markets.$inferInsert> = [];
      const coldInsertCap = isVercel && existingMatchRows.length === 0 ? 55 : 220;

      for (const { fx, sport, pairKey } of dedupedFixtures) {
        seenExternalIds.add(fx.externalId);

        const matchedRow = existingByExtId.get(fx.externalId) || existingByPairKey.get(pairKey);

        if (matchedRow) {
          seenExternalIds.add(matchedRow.externalId || '');
          const prevStatus = matchedRow.status;
          const hasChanges =
            matchedRow.homeScore !== fx.homeScore ||
            matchedRow.awayScore !== fx.awayScore ||
            matchedRow.status !== fx.status ||
            matchedRow.matchTimer !== fx.matchTimer ||
            Math.abs(new Date(matchedRow.startTime).getTime() - fx.startTime.getTime()) > 60_000;

          if (hasChanges) {
            await db
              .update(matches)
              .set({
                homeScore: fx.homeScore,
                awayScore: fx.awayScore,
                status: fx.status,
                matchTimer: fx.matchTimer,
                startTime: fx.startTime,
                dataSource: 'live_api',
                featured: fx.featured || matchedRow.featured,
              })
              .where(eq(matches.id, matchedRow.id));
            updated++;
          }

          if (prevStatus !== 'finished' && fx.status === 'finished') {
            await settleBetsForFinishedMatch(matchedRow.id);
          } else if (fx.status === 'live' && (hasChanges || Date.now() - syncStart < deadlineMs)) {
            await updateDynamicLiveOdds(
              matchedRow.id,
              fx.sportSlug,
              fx.homeScore,
              fx.awayScore,
              fx.matchTimer,
              fx.oddsHint,
              liveMarketsByMatch.get(matchedRow.id)
            );
          }
        } else {
          if (fx.status === 'finished' && Date.now() - fx.startTime.getTime() > 14 * 3600_000) {
            continue;
          }
          if (synced >= coldInsertCap || Date.now() - syncStart > deadlineMs) {
            continue;
          }

          const comp = await ensureCompetition(
            fx.competitionSlug,
            fx.competitionName,
            sport.id,
            fx.country,
            fx.featuredComp,
            compBySlug
          );
          if (!comp) continue;

          const homeTeam = await getOrCreateTeam(fx.homeName, fx.homeShort, sport.id, teamCache, fx.homeLogo);
          const awayTeam = await getOrCreateTeam(fx.awayName, fx.awayShort, sport.id, teamCache, fx.awayLogo);

          const [createdMatch] = await db
            .insert(matches)
            .values({
              externalId: fx.externalId,
              sportId: sport.id,
              competitionId: comp.id,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              homeScore: fx.homeScore,
              awayScore: fx.awayScore,
              status: fx.status,
              matchTimer: fx.matchTimer,
              startTime: fx.startTime,
              dataSource: 'live_api',
              featured: fx.featured,
            })
            .onConflictDoNothing()
            .returning();

          if (!createdMatch) continue;

          const marketRows = buildSimulatedMarketsForSport(
            createdMatch.id,
            fx.sportSlug,
            fx.homeName,
            fx.awayName,
            createdMatch.id,
            fx.oddsHint
          );
          pendingMarketInserts.push(...marketRows);
          synced++;
        }
      }

      // Batch-insert markets in chunks of 400 rows to minimize Postgres round-trips
      for (let i = 0; i < pendingMarketInserts.length; i += 400) {
        const chunk = pendingMarketInserts.slice(i, i + 400);
        await db.insert(markets).values(chunk);
      }

      if (existingMatchRows.length > 0) {
        await resolveStaleOrStuckMatches(seenExternalIds, Date.now() - syncStart > deadlineMs);
        if (Date.now() - syncStart < deadlineMs) {
          await ensureExpandedMarketsForOpenMatches();
        }
      }

      if (synced > 0 || updated > 0) {
        realtimeHub.emitMatchesUpdated({ synced, updated });
      }
    } catch (error) {
      console.warn('Live sports sync encountered a non-fatal error:', error);
    } finally {
      activeSyncPromise = null;
    }

    return { synced, updated, sources: Array.from(new Set(activeSources)) };
  })();

  return activeSyncPromise;
}

async function ensureSchemaTables(): Promise<void> {
  const regCheck = await db.execute(sql`SELECT to_regclass('public.users') AS tbl`);
  const firstRow = (regCheck as any)?.rows?.[0];
  if (!firstRow?.tbl) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        uid text NOT NULL UNIQUE,
        username text NOT NULL,
        email text NOT NULL UNIQUE,
        password_hash text,
        virtual_balance double precision NOT NULL DEFAULT 0,
        role text NOT NULL DEFAULT 'user',
        favorite_teams text NOT NULL DEFAULT '[]',
        favorite_sports text NOT NULL DEFAULT '[]',
        reset_token text,
        reset_token_expires timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sports (
        id serial PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        name text NOT NULL,
        icon text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS competitions (
        id serial PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        name text NOT NULL,
        sport_id integer NOT NULL REFERENCES sports(id),
        country text NOT NULL,
        featured boolean NOT NULL DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS teams (
        id serial PRIMARY KEY,
        name text NOT NULL,
        short_name text NOT NULL,
        logo text NOT NULL,
        sport_id integer NOT NULL REFERENCES sports(id)
      );
      CREATE TABLE IF NOT EXISTS matches (
        id serial PRIMARY KEY,
        external_id text UNIQUE,
        sport_id integer NOT NULL REFERENCES sports(id),
        competition_id integer NOT NULL REFERENCES competitions(id),
        home_team_id integer NOT NULL REFERENCES teams(id),
        away_team_id integer NOT NULL REFERENCES teams(id),
        home_score integer NOT NULL DEFAULT 0,
        away_score integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'upcoming',
        match_timer text NOT NULL DEFAULT '00:00',
        start_time timestamp NOT NULL,
        data_source text NOT NULL DEFAULT 'simulated',
        featured boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS markets (
        id serial PRIMARY KEY,
        match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        market_type text NOT NULL,
        selection_name text NOT NULL,
        simulated_odds double precision NOT NULL,
        active boolean NOT NULL DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS virtual_bets (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        reference text NOT NULL UNIQUE,
        idempotency_key text UNIQUE,
        virtual_stake double precision NOT NULL,
        combined_odds double precision NOT NULL,
        potential_virtual_winnings double precision NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS virtual_bet_selections (
        id serial PRIMARY KEY,
        virtual_bet_id integer NOT NULL REFERENCES virtual_bets(id) ON DELETE CASCADE,
        match_id integer NOT NULL REFERENCES matches(id),
        market_id integer NOT NULL REFERENCES markets(id),
        market_type text NOT NULL,
        selection_name text NOT NULL,
        simulated_odds double precision NOT NULL,
        match_label text NOT NULL,
        result text NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        amount double precision NOT NULL,
        transaction_type text NOT NULL,
        description text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id serial PRIMARY KEY,
        admin_id integer NOT NULL REFERENCES users(id),
        action text NOT NULL,
        details text,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS promotions_claimed (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        promo_code text NOT NULL,
        reward_credits double precision NOT NULL,
        claimed_at timestamp DEFAULT now() NOT NULL
      );
    `);
  }

  const depCheck = await db.execute(sql`SELECT to_regclass('public.deposit_requests') AS tbl`);
  const msgCheck = await db.execute(sql`SELECT to_regclass('public.contact_messages') AS tbl`);
  const depExists = Boolean((depCheck as any)?.rows?.[0]?.tbl);
  const msgExists = Boolean((msgCheck as any)?.rows?.[0]?.tbl);

  if (!depExists || !msgExists) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        method text NOT NULL,
        operator text NOT NULL,
        amount double precision NOT NULL,
        ticket_codes text NOT NULL DEFAULT '[]',
        phone_number text,
        screenshot_data text,
        note text,
        status text NOT NULL DEFAULT 'pending',
        admin_note text,
        processed_by integer,
        created_at timestamp DEFAULT now() NOT NULL,
        processed_at timestamp
      );
      CREATE TABLE IF NOT EXISTS contact_messages (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        sender_id integer NOT NULL REFERENCES users(id),
        sender_role text NOT NULL,
        sender_name text NOT NULL,
        message text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
  }
}

let coreSeeded = false;
let coreSeedPromise: Promise<void> | null = null;
let seedPromise: Promise<void> | null = null;

export async function ensureCoreSeeded(): Promise<void> {
  if (coreSeeded) return;
  if (coreSeedPromise) return coreSeedPromise;

  coreSeedPromise = (async () => {
    try {
      await ensureDbReady();
      assertDatabaseConfigured();
      await ensureSchemaTables();

      const existingSports = await db.select().from(sports);
      if (existingSports.length === 0) {
        await db
          .insert(sports)
          .values([
            { slug: 'football', name: 'Football', icon: 'trophy' },
            { slug: 'basketball', name: 'Basketball', icon: 'circle-dot' },
            { slug: 'tennis', name: 'Tennis', icon: 'disc' },
            { slug: 'volleyball', name: 'Volleyball', icon: 'globe' },
            { slug: 'esports', name: 'Esports', icon: 'gamepad-2' },
          ])
          .onConflictDoNothing();
      }

      const targetAdminEmail = 'ppatrice191@gmail.com';
      const existingAdmin = await db
        .select()
        .from(users)
        .where(eq(users.email, targetAdminEmail))
        .limit(1);

      if (existingAdmin.length === 0) {
        const adminPasswordHash = await bcrypt.hash('azerty1233216', 10);
        const [createdAdmin] = await db
          .insert(users)
          .values({
            uid: 'admin_ppatrice191',
            username: 'PatriceAdmin',
            email: targetAdminEmail,
            passwordHash: adminPasswordHash,
            virtualBalance: 0,
            role: 'admin',
            favoriteSports: '["football","basketball"]',
            favoriteTeams: '[]',
          })
          .onConflictDoNothing()
          .returning();

        if (createdAdmin) {
          await db.insert(auditLogs).values({
            adminId: createdAdmin.id,
            action: 'ADMIN_PROVISIONED',
            details: 'Provisioned administrator account ppatrice191@gmail.com',
          });
        }
      } else if (existingAdmin[0].role !== 'admin') {
        const adminPasswordHash = await bcrypt.hash('azerty1233216', 10);
        await db
          .update(users)
          .set({ role: 'admin', passwordHash: adminPasswordHash })
          .where(eq(users.id, existingAdmin[0].id));
      }

      coreSeeded = true;
    } catch (error) {
      coreSeedPromise = null;
      throw error;
    }
  })();

  return coreSeedPromise;
}

export async function ensureDatabaseSeeded(): Promise<void> {
  await ensureCoreSeeded();
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const legacyMatches = await db
        .select({ id: matches.id })
        .from(matches)
        .where(like(matches.externalId, 'sim_seed_%'));

      if (legacyMatches.length > 0) {
        for (const lm of legacyMatches) {
          await db.delete(virtualBetSelections).where(eq(virtualBetSelections.matchId, lm.id));
          await db.delete(matches).where(eq(matches.id, lm.id));
        }
      }

      const existingSample = await db.select({ id: matches.id }).from(matches).limit(1);
      if (existingSample.length === 0) {
        await syncLiveSportsFeeds();
      }
    } catch (error) {
      console.error('Error seeding MYBET matches:', error);
      seedPromise = null;
    }
  })();

  return seedPromise;
}

const STATELESS_SPORTS = [
  { id: 1, slug: 'football', name: 'Football', icon: 'trophy' },
  { id: 2, slug: 'basketball', name: 'Basketball', icon: 'circle-dot' },
  { id: 3, slug: 'tennis', name: 'Tennis', icon: 'disc' },
  { id: 4, slug: 'volleyball', name: 'Volleyball', icon: 'globe' },
  { id: 5, slug: 'esports', name: 'Esports', icon: 'gamepad-2' },
];

let statelessSnapshotCache: {
  ts: number;
  sports: Array<{ id: number; slug: string; name: string; icon: string; liveCount: number; totalCount: number }>;
  competitions: Array<{ id: number; slug: string; name: string; sportId: number; country: string; featured: boolean }>;
  matches: any[];
  liveTotal: number;
} | null = null;

export async function fetchLiveFixturesSnapshot() {
  if (statelessSnapshotCache && Date.now() - statelessSnapshotCache.ts < 15_000) {
    return statelessSnapshotCache;
  }

  const [espnRes, lsRes] = await Promise.all([fetchEspnFixtures(), fetchLiveScoreFootballFixtures()]);
  const baseCombined: UnifiedFixture[] = [...espnRes.fixtures, ...lsRes.fixtures];
  const supplementFixtures = buildMultiSportBoardSupplement(baseCombined);
  const rawCombined: UnifiedFixture[] = [...baseCombined, ...supplementFixtures];
  const seenPairs = new Set<string>();
  const sportBySlug = new Map(STATELESS_SPORTS.map((s) => [s.slug, s]));
  const compMap = new Map<string, { id: number; slug: string; name: string; sportId: number; country: string; featured: boolean }>();

  const hydratedMatches: any[] = [];
  let nextMatchId = 1;
  let nextMarketId = 1;
  let nextCompId = 1;
  let nextTeamId = 1;

  for (const fx of rawCombined) {
    const sp = sportBySlug.get(fx.sportSlug);
    if (!sp) continue;
    const pairKey = buildMatchDedupeKey(sp.id, fx.homeName, fx.awayName);
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    if (fx.status === 'finished' && Date.now() - fx.startTime.getTime() > 14 * 3600_000) continue;

    let comp = compMap.get(fx.competitionSlug);
    if (!comp) {
      comp = {
        id: nextCompId++,
        slug: fx.competitionSlug,
        name: fx.competitionName,
        sportId: sp.id,
        country: fx.country,
        featured: fx.featuredComp,
      };
      compMap.set(fx.competitionSlug, comp);
    }

    const matchId = nextMatchId++;
    const rawMarkets = buildSimulatedMarketsForSport(
      matchId,
      fx.sportSlug,
      fx.homeName,
      fx.awayName,
      matchId,
      fx.oddsHint
    );
    const marketsWithIds = rawMarkets.map((m) => ({
      id: nextMarketId++,
      ...m,
    }));

    hydratedMatches.push({
      id: matchId,
      externalId: fx.externalId,
      sportId: sp.id,
      sportSlug: sp.slug,
      sportName: sp.name,
      competitionId: comp.id,
      competitionSlug: comp.slug,
      competitionName: comp.name,
      competitionCountry: comp.country,
      homeTeam: {
        id: nextTeamId++,
        name: fx.homeName,
        shortName: fx.homeShort,
        logo: fx.homeLogo || pickColor(fx.homeName),
      },
      awayTeam: {
        id: nextTeamId++,
        name: fx.awayName,
        shortName: fx.awayShort,
        logo: fx.awayLogo || pickColor(fx.awayName),
      },
      homeScore: fx.homeScore,
      awayScore: fx.awayScore,
      status: fx.status,
      matchTimer: fx.matchTimer,
      startTime: fx.startTime,
      dataSource: 'live_api',
      featured: fx.featured,
      markets: marketsWithIds,
    });
  }

  const orderWeight: Record<string, number> = { live: 0, upcoming: 1, finished: 2 };
  hydratedMatches.sort((a, b) => {
    const wDiff = (orderWeight[a.status] ?? 3) - (orderWeight[b.status] ?? 3);
    if (wDiff !== 0) return wDiff;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const sportsWithCounts = STATELESS_SPORTS.map((sp) => {
    const forSport = hydratedMatches.filter((m) => m.sportId === sp.id);
    return {
      ...sp,
      liveCount: forSport.filter((m) => m.status === 'live').length,
      totalCount: forSport.length,
    };
  });

  statelessSnapshotCache = {
    ts: Date.now(),
    sports: sportsWithCounts,
    competitions: Array.from(compMap.values()),
    matches: hydratedMatches,
    liveTotal: hydratedMatches.filter((m) => m.status === 'live').length,
  };

  return statelessSnapshotCache;
}

