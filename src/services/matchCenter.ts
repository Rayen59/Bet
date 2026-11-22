import type {
  MatchCenterData,
  MatchCenterFormGame,
  MatchCenterInjury,
  MatchCenterRosterPlayer,
  MatchCenterStandingRow,
  MatchCenterStat,
  MatchCenterTimelineEvent,
} from '../types/sportzone';

const SLUG_TO_ESPN_PATH: Record<string, string> = {
  'premier-league': 'soccer/eng.1',
  bundesliga: 'soccer/ger.1',
  'la-liga': 'soccer/esp.1',
  'serie-a': 'soccer/ita.1',
  'ligue-1': 'soccer/fra.1',
  eredivisie: 'soccer/ned.1',
  mls: 'soccer/usa.1',
  'primeira-liga': 'soccer/por.1',
  'super-lig': 'soccer/tur.1',
  'champions-league': 'soccer/uefa.champions',
  'efl-championship': 'soccer/eng.2',
  nba: 'basketball/nba',
  'atp-tour': 'tennis/atp',
  'wta-tour': 'tennis/wta',
};

export function americanToDecimal(raw: unknown): number | null {
  const num = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(num) || num === 0) return null;
  const dec = num > 0 ? 1 + num / 100 : 1 + 100 / Math.abs(num);
  return Math.max(1.02, Math.round(dec * 100) / 100);
}

const cache = new Map<string, { ts: number; data: MatchCenterData }>();

const STAT_LABELS: Record<string, string> = {
  possessionPct: 'Possession %',
  totalShots: 'Total Shots',
  shotsOnTarget: 'Shots on Target',
  wonCorners: 'Corner Kicks',
  foulsCommitted: 'Fouls Committed',
  yellowCards: 'Yellow Cards',
  redCards: 'Red Cards',
  offsides: 'Offsides',
  saves: 'Goalkeeper Saves',
  accuratePasses: 'Accurate Passes',
  totalPasses: 'Total Passes',
  fieldGoalPct: 'Field Goal %',
  threePointFieldGoalPct: '3-Point %',
  freeThrowPct: 'Free Throw %',
  totalRebounds: 'Total Rebounds',
  assists: 'Assists',
  steals: 'Steals',
  blocks: 'Blocks',
  turnovers: 'Turnovers',
};

async function fetchLiveScoreMatchCenter(
  eid: string,
  homeTeamName: string,
  awayTeamName: string
): Promise<MatchCenterData> {
  const empty: MatchCenterData = {
    venue: null,
    consensusOdds: null,
    stats: [],
    timeline: [],
    form: { home: [], away: [] },
    injuries: { home: [], away: [] },
    lineups: { home: [], away: [] },
    standings: [],
  };

  try {
    const [sbRes, incRes, linRes] = await Promise.all([
      fetch(`https://prod-public-api.livescore.com/v1/api/app/scoreboard/soccer/${eid}?MD=1`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 SPORTZONE/3.0' },
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://prod-public-api.livescore.com/v1/api/app/incidents/soccer/${eid}?MD=1`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 SPORTZONE/3.0' },
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://prod-public-api.livescore.com/v1/api/app/lineups/soccer/${eid}?MD=1`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 SPORTZONE/3.0' },
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const venue = sbRes?.Venue?.Vnm
      ? {
          name: String(sbRes.Venue.Vnm),
          city: sbRes.Venue.Vct ? String(sbRes.Venue.Vct) : undefined,
          country: sbRes.Venue.Vco ? String(sbRes.Venue.Vco) : undefined,
        }
      : null;

    const timeline: MatchCenterTimelineEvent[] = [];
    const incsByHalf = incRes?.Incs || sbRes?.['Incs-s'] || {};
    for (const halfKey of Object.keys(incsByHalf)) {
      const list = Array.isArray(incsByHalf[halfKey]) ? incsByHalf[halfKey] : [];
      for (const item of list) {
        const it = Number(item.IT);
        let type: MatchCenterTimelineEvent['type'] = 'info';
        let label = 'Match Event';
        if (it === 36 || it === 37 || it === 39) {
          type = 'goal';
          label = it === 39 ? 'Goal (Penalty)' : it === 37 ? 'Own Goal' : 'Goal';
        } else if (it === 43) {
          type = 'yellow';
          label = 'Yellow Card';
        } else if (it === 44 || it === 45) {
          type = 'red';
          label = 'Red Card';
        } else if (it === 62 || it === 63) {
          type = 'sub';
          label = 'Substitution';
        }

        const teamSide: MatchCenterTimelineEvent['teamSide'] =
          item.Nm === 1 ? 'home' : item.Nm === 2 ? 'away' : 'neutral';
        const teamLabel = teamSide === 'home' ? homeTeamName : teamSide === 'away' ? awayTeamName : '';
        const player = item.Pn || item.Incs?.[0]?.Pn || '';

        timeline.push({
          clock: item.Min ? `${item.Min}'` : '',
          type,
          text: [label, player, teamLabel ? `(${teamLabel})` : ''].filter(Boolean).join(' · '),
          teamSide,
        });
      }
    }

    const lineups: MatchCenterData['lineups'] = { home: [], away: [] };
    if (Array.isArray(linRes?.Lu)) {
      for (const side of linRes.Lu) {
        const target = side.Tnb === 1 ? lineups.home : lineups.away;
        for (const p of side.Ps || []) {
          target.push({
            name: `${p.Fn || ''} ${p.Ln || p.Snm || ''}`.trim() || 'Player',
            position: String(p.Pon || ''),
            jersey: p.Snu ? String(p.Snu) : undefined,
            starter: true,
          });
        }
      }
    }

    return {
      ...empty,
      venue,
      timeline,
      lineups,
    };
  } catch {
    return empty;
  }
}

export async function fetchRealMatchCenter(params: {
  externalId: string | null;
  competitionSlug: string;
  homeTeamName: string;
  awayTeamName: string;
}): Promise<MatchCenterData> {
  const empty: MatchCenterData = {
    venue: null,
    consensusOdds: null,
    stats: [],
    timeline: [],
    form: { home: [], away: [] },
    injuries: { home: [], away: [] },
    lineups: { home: [], away: [] },
    standings: [],
  };

  if (!params.externalId) {
    return empty;
  }

  if (params.externalId.startsWith('ls_soccer_')) {
    const eid = params.externalId.replace('ls_soccer_', '');
    const cacheKey = `ls:${eid}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 20_000) return cached.data;
    const data = await fetchLiveScoreMatchCenter(eid, params.homeTeamName, params.awayTeamName);
    cache.set(cacheKey, { ts: Date.now(), data });
    return data;
  }

  if (!params.externalId.startsWith('espn_')) {
    return empty;
  }

  const espnPath =
    SLUG_TO_ESPN_PATH[params.competitionSlug] ||
    (params.externalId.includes('world-football') ? 'soccer/all' : undefined);
  const eventId = params.externalId.split('_').pop();
  if (!espnPath || !eventId) return empty;

  const cacheKey = `${espnPath}:${eventId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 20_000) {
    return cached.data;
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/summary?event=${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SPORTZONE-MatchCenter/3.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return empty;
    const sum = await res.json();

    const v = sum.gameInfo?.venue;
    const venue = v?.fullName
      ? {
          name: String(v.fullName),
          city: v.address?.city ? String(v.address.city) : undefined,
          country: v.address?.country ? String(v.address.country) : undefined,
          attendance: Number(sum.gameInfo?.attendance) > 0 ? Number(sum.gameInfo.attendance) : undefined,
        }
      : null;

    let consensusOdds: MatchCenterData['consensusOdds'] = null;
    const primaryOdd = Array.isArray(sum.odds) && sum.odds.length > 0 ? sum.odds[0] : null;
    if (primaryOdd) {
      const homeDecimal =
        americanToDecimal(primaryOdd.moneyline?.home?.close?.odds ?? primaryOdd.homeTeamOdds?.moneyLine);
      const drawDecimal =
        americanToDecimal(primaryOdd.moneyline?.draw?.close?.odds ?? primaryOdd.drawOdds?.moneyLine);
      const awayDecimal =
        americanToDecimal(primaryOdd.moneyline?.away?.close?.odds ?? primaryOdd.awayTeamOdds?.moneyLine);
      const overDecimal = americanToDecimal(primaryOdd.total?.over?.close?.odds ?? primaryOdd.overOdds);
      const underDecimal = americanToDecimal(primaryOdd.total?.under?.close?.odds ?? primaryOdd.underOdds);
      const overUnderLine = Number.isFinite(Number(primaryOdd.overUnder))
        ? Number(primaryOdd.overUnder)
        : null;
      const spreadLine = Number.isFinite(Number(primaryOdd.spread)) ? Number(primaryOdd.spread) : null;

      let homeImpliedPct: number | null = null;
      let drawImpliedPct: number | null = null;
      let awayImpliedPct: number | null = null;

      if (homeDecimal && awayDecimal) {
        const invH = 1 / homeDecimal;
        const invD = drawDecimal ? 1 / drawDecimal : 0;
        const invA = 1 / awayDecimal;
        const totalInv = invH + invD + invA;
        if (totalInv > 0) {
          homeImpliedPct = Math.round((invH / totalInv) * 100);
          drawImpliedPct = drawDecimal ? Math.round((invD / totalInv) * 100) : null;
          awayImpliedPct = 100 - homeImpliedPct - (drawImpliedPct ?? 0);
        }
      }

      consensusOdds = {
        provider: String(primaryOdd.provider?.name || 'Market Consensus'),
        homeDecimal,
        drawDecimal,
        awayDecimal,
        overUnderLine,
        overDecimal,
        underDecimal,
        spreadLine,
        homeImpliedPct,
        drawImpliedPct,
        awayImpliedPct,
      };
    }

    const stats: MatchCenterStat[] = [];
    const boxTeams = sum.boxscore?.teams;
    if (Array.isArray(boxTeams) && boxTeams.length >= 2) {
      const homeBox =
        boxTeams.find((t: any) =>
          String(t.team?.displayName || '').toLowerCase().includes(params.homeTeamName.toLowerCase())
        ) || boxTeams[0];
      const awayBox = boxTeams.find((t: any) => t !== homeBox) || boxTeams[1];

      const homeStatsMap = new Map<string, string>(
        (homeBox?.statistics || []).map((s: any) => [String(s.name), String(s.displayValue ?? '0')])
      );
      const awayStatsMap = new Map<string, string>(
        (awayBox?.statistics || []).map((s: any) => [String(s.name), String(s.displayValue ?? '0')])
      );

      for (const [key, label] of Object.entries(STAT_LABELS)) {
        if (!homeStatsMap.has(key) && !awayStatsMap.has(key)) continue;
        const hv = homeStatsMap.get(key) ?? '0';
        const av = awayStatsMap.get(key) ?? '0';
        const hn = Number.parseFloat(hv.replace('%', '')) || 0;
        const an = Number.parseFloat(av.replace('%', '')) || 0;
        const sumN = hn + an;
        const homePct = sumN > 0 ? Math.round((hn / sumN) * 100) : 50;
        stats.push({ label, homeValue: hv, awayValue: av, homePct });
      }
    }

    const timeline: MatchCenterTimelineEvent[] = [];
    if (Array.isArray(sum.keyEvents)) {
      for (const ev of sum.keyEvents) {
        const typeText = String(ev.type?.text || '').toLowerCase();
        let evType: MatchCenterTimelineEvent['type'] = 'info';
        if (typeText.includes('goal')) evType = 'goal';
        else if (typeText.includes('yellow')) evType = 'yellow';
        else if (typeText.includes('red')) evType = 'red';
        else if (typeText.includes('sub')) evType = 'sub';

        const teamName = String(ev.team?.displayName || '').toLowerCase();
        const teamSide: MatchCenterTimelineEvent['teamSide'] = teamName.includes(
          params.homeTeamName.toLowerCase()
        )
          ? 'home'
          : teamName.includes(params.awayTeamName.toLowerCase())
          ? 'away'
          : 'neutral';

        timeline.push({
          clock: String(ev.clock?.displayValue || ev.clock?.value || ''),
          type: evType,
          text: String(ev.shortText || ev.text || ev.type?.text || ''),
          teamSide,
        });
      }
    }

    const form: MatchCenterData['form'] = { home: [], away: [] };
    if (Array.isArray(sum.lastFiveGames)) {
      for (const entry of sum.lastFiveGames) {
        const tName = String(entry.team?.displayName || '').toLowerCase();
        const isHome = tName.includes(params.homeTeamName.toLowerCase());
        const target = isHome ? form.home : form.away;
        for (const g of (entry.events || []).slice(0, 5)) {
          const resChar = String(g.gameResult || 'D').toUpperCase();
          const result: MatchCenterFormGame['result'] =
            resChar === 'W' ? 'W' : resChar === 'L' ? 'L' : 'D';
          target.push({
            opponent: String(g.opponent?.displayName || g.opponent?.abbreviation || 'Opponent'),
            score: String(g.score || '-'),
            result,
            date: g.gameDate ? new Date(g.gameDate).toLocaleDateString() : '',
            homeAway: String(g.atVs || ''),
          });
        }
      }
    }

    const injuries: MatchCenterData['injuries'] = { home: [], away: [] };
    if (Array.isArray(sum.injuries)) {
      for (const teamGroup of sum.injuries) {
        const tName = String(teamGroup.team?.displayName || '').toLowerCase();
        const isHome = tName.includes(params.homeTeamName.toLowerCase());
        const target: MatchCenterInjury[] = isHome ? injuries.home : injuries.away;
        for (const inj of (teamGroup.injuries || []).slice(0, 12)) {
          target.push({
            player: String(inj.athlete?.displayName || 'Player'),
            position: String(inj.athlete?.position?.abbreviation || ''),
            status: String(inj.status || 'Out'),
            detail: [inj.details?.type, inj.details?.detail].filter(Boolean).join(' · ') || 'Injury',
            returnDate: inj.details?.returnDate ? String(inj.details.returnDate) : undefined,
          });
        }
      }
    }

    const lineups: MatchCenterData['lineups'] = { home: [], away: [] };
    if (Array.isArray(sum.rosters)) {
      for (const r of sum.rosters) {
        const tName = String(r.team?.displayName || '').toLowerCase();
        const isHome = tName.includes(params.homeTeamName.toLowerCase());
        const target: MatchCenterRosterPlayer[] = isHome ? lineups.home : lineups.away;
        for (const p of (r.roster || []).slice(0, 22)) {
          target.push({
            name: String(p.athlete?.displayName || 'Player'),
            position: String(p.position?.abbreviation || ''),
            jersey: p.jersey ? String(p.jersey) : undefined,
            starter: Boolean(p.starter),
          });
        }
      }
    }

    const standings: MatchCenterStandingRow[] = [];
    const groups = sum.standings?.groups;
    const entries = Array.isArray(groups) && groups[0]?.standings?.entries ? groups[0].standings.entries : [];
    for (const row of entries.slice(0, 20)) {
      const teamName = String(row.team || row.team?.displayName || '');
      const statMap = new Map<string, string>(
        (row.stats || []).map((s: any) => [String(s.name), String(s.displayValue ?? '0')])
      );
      const isMatchTeam =
        teamName.toLowerCase().includes(params.homeTeamName.toLowerCase()) ||
        teamName.toLowerCase().includes(params.awayTeamName.toLowerCase());

      standings.push({
        rank: Number(statMap.get('rank')) || standings.length + 1,
        team: teamName,
        played: Number(statMap.get('gamesPlayed')) || 0,
        wins: Number(statMap.get('wins')) || 0,
        draws: Number(statMap.get('ties')) || 0,
        losses: Number(statMap.get('losses')) || 0,
        gd: statMap.get('pointDifferential') || '0',
        points: Number(statMap.get('points')) || 0,
        isMatchTeam,
      });
    }

    const result: MatchCenterData = {
      venue,
      consensusOdds,
      stats,
      timeline,
      form,
      injuries,
      lineups,
      standings,
    };

    cache.set(cacheKey, { ts: Date.now(), data: result });
    return result;
  } catch (err) {
    console.warn('MatchCenter fetch failed:', err);
    return empty;
  }
}
