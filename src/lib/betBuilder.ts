import { SlipSelection } from '../types/sportzone';

export interface MarketLike {
  id?: number;
  marketId?: number;
  marketType: string;
  selectionName: string;
  simulatedOdds: number;
  active?: boolean;
}

export type CompatibilityStatus = 'compatible' | 'conflict' | 'redundant' | 'selected';

export interface CompatibilityResult {
  compatible: boolean;
  status: CompatibilityStatus;
  reason?: string;
  conflictingIds: number[];
}

export interface MatchSlipGroup {
  matchId: number;
  matchLabel: string;
  competitionName: string;
  status: 'live' | 'upcoming' | 'finished';
  startTime: string;
  selections: SlipSelection[];
  groupOdds: number;
  isBetBuilder: boolean;
}

export interface SanitizeResult<T extends MarketLike> {
  kept: T[];
  removed: Array<{ item: T; reason: string }>;
}

function getMktId(m: MarketLike): number {
  return Number(m.marketId ?? m.id ?? 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseLine(text: string): number | null {
  const m = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : null;
}

type ScorePair = [number, number];

const FOOTBALL_SCORE_GRID: ScorePair[] = [];
for (let h = 0; h <= 10; h++) {
  for (let a = 0; a <= 10; a++) {
    FOOTBALL_SCORE_GRID.push([h, a]);
  }
}

type CardState = [number, number, number]; // [homeCards, awayCards, redCard (0|1)]
const CARD_GRID: CardState[] = [];
for (let hc = 0; hc <= 8; hc++) {
  for (let ac = 0; ac <= 8; ac++) {
    CARD_GRID.push([hc, ac, 0]);
    if (hc + ac >= 1) {
      CARD_GRID.push([hc, ac, 1]);
    }
  }
}

type BasketState = [number, number, number]; // quantized [homePts, awayPts, diffSign]
// Instead of huge grid for basketball/tennis, use exact interval & difference bounds.

type AxisKey =
  | 'score'
  | 'ht_result'
  | 'cards'
  | 'injury_sub'
  | 'stoppage_time'
  | 'tech_foul'
  | 'set_winner'
  | 'map_winner'
  | 'basket_winner_handicap'
  | 'basket_totals'
  | 'other';

function classifyAxis(m: MarketLike): AxisKey {
  const mt = m.marketType.toLowerCase();
  const sn = m.selectionName.toLowerCase();

  if (
    mt === '1×2' ||
    mt === '1x2' ||
    mt === 'double chance' ||
    mt === 'total' ||
    mt === 'over/under 2.5 goals' ||
    mt === 'both teams to score' ||
    mt === 'correct score' ||
    mt.startsWith('1st team total') ||
    mt.startsWith('2nd team total')
  ) {
    // Distinguish basketball team totals (> 30) from football team totals
    const line = parseLine(m.selectionName);
    if (line !== null && line > 15) return 'basket_totals';
    return 'score';
  }

  if (mt === 'total points' || mt === 'total games' || mt.startsWith('1st player games') || mt.startsWith('2nd player games')) {
    return 'basket_totals';
  }

  if (mt === 'first-half result') return 'ht_result';
  if (mt.includes('card')) return 'cards';
  if (mt === 'injuries & stoppages') {
    return sn.includes('injury') ? 'injury_sub' : 'stoppage_time';
  }
  if (mt === 'fouls & stoppages') return 'tech_foul';
  if (mt === 'set winner') return 'set_winner';
  if (mt === 'map winner') return 'map_winner';
  if (mt === 'match winner' || mt === 'handicap') return 'basket_winner_handicap';
  return 'other';
}

function isBasketballLine(items: MarketLike[]): boolean {
  return items.some((m) => {
    const mt = m.marketType.toLowerCase();
    const l = parseLine(m.selectionName);
    return mt === 'total points' || mt === 'handicap' || (l !== null && l > 35);
  });
}

function footballScorePredicate(m: MarketLike): ((h: number, a: number) => boolean) | null {
  const mt = m.marketType.toLowerCase();
  const sn = m.selectionName.trim();
  const snLow = sn.toLowerCase();

  if (mt === '1×2' || mt === '1x2') {
    if (sn === '1') return (h, a) => h > a;
    if (sn === 'X') return (h, a) => h === a;
    if (sn === '2') return (h, a) => a > h;
  }

  if (mt === 'double chance') {
    if (sn === '1 or X' || sn === '1X') return (h, a) => h >= a;
    if (sn === '1 or 2' || sn === '12') return (h, a) => h !== a;
    if (sn === 'X or 2' || sn === 'X2') return (h, a) => a >= h;
  }

  if (mt === 'total' || mt === 'over/under 2.5 goals') {
    const line = parseLine(sn);
    if (line !== null) {
      if (snLow.includes('over')) return (h, a) => h + a > line;
      if (snLow.includes('under')) return (h, a) => h + a < line;
    }
  }

  if (mt.startsWith('1st team total')) {
    const line = parseLine(sn);
    if (line !== null && line <= 15) {
      if (snLow.includes('over')) return (h) => h > line;
      if (snLow.includes('under')) return (h) => h < line;
    }
  }

  if (mt.startsWith('2nd team total')) {
    const line = parseLine(sn);
    if (line !== null && line <= 15) {
      if (snLow.includes('over')) return (_h, a) => a > line;
      if (snLow.includes('under')) return (_h, a) => a < line;
    }
  }

  if (mt === 'both teams to score') {
    if (snLow === 'yes') return (h, a) => h > 0 && a > 0;
    if (snLow === 'no') return (h, a) => h === 0 || a === 0;
  }

  if (mt === 'correct score') {
    const cs = sn.match(/^(\d+)-(\d+)$/);
    if (cs) {
      const eh = Number(cs[1]);
      const ea = Number(cs[2]);
      return (h, a) => h === eh && a === ea;
    }
  }

  if (mt === 'first-half result') {
    // At full-time, 1 (HT) guarantees home scored at least 1 goal; 2 (HT) guarantees away scored at least 1 goal.
    if (sn.startsWith('1')) return (h) => h >= 1;
    if (sn.startsWith('2')) return (_h, a) => a >= 1;
    if (sn.startsWith('X')) return () => true;
  }

  return null;
}

function cardPredicate(m: MarketLike): ((hc: number, ac: number, red: number) => boolean) | null {
  const mt = m.marketType.toLowerCase();
  const snLow = m.selectionName.toLowerCase();

  if (mt === 'total cards') {
    if (snLow.includes('red card')) {
      return snLow.includes('yes') ? (_hc, _ac, red) => red === 1 : (_hc, _ac, red) => red === 0;
    }
    const line = parseLine(snLow);
    if (line !== null) {
      if (snLow.includes('over')) return (hc, ac) => hc + ac > line;
      if (snLow.includes('under')) return (hc, ac) => hc + ac < line;
    }
  }

  if (mt.includes('team cards')) {
    // Format: "${homeShort} Cards Over 1.5" vs "${awayShort} Cards Over 1.5"
    // Use market label clues or position: we tag home vs away via explicit suffix check when possible
    const line = parseLine(snLow);
    if (line !== null) {
      // Distinguish home vs away using matchLabel if available, else hash prefix
      const isHome = (m as any).__teamSide === 'home';
      const isAway = (m as any).__teamSide === 'away';
      if (isHome) {
        return snLow.includes('over') ? (hc) => hc > line : (hc) => hc < line;
      }
      if (isAway) {
        return snLow.includes('over') ? (_hc, ac) => ac > line : (_hc, ac) => ac < line;
      }
    }
  }

  return null;
}

function attachTeamSides<T extends MarketLike>(items: T[], homeHint?: string, awayHint?: string): T[] {
  return items.map((item) => {
    const mt = item.marketType.toLowerCase();
    if (!mt.includes('team cards')) return item;
    const sn = item.selectionName;
    const clone: any = { ...item };
    if (homeHint && sn.toLowerCase().startsWith(homeHint.toLowerCase())) {
      clone.__teamSide = 'home';
    } else if (awayHint && sn.toLowerCase().startsWith(awayHint.toLowerCase())) {
      clone.__teamSide = 'away';
    }
    return clone;
  });
}

function inferTeamCardPrefixSides(items: MarketLike[]): { homePrefix?: string; awayPrefix?: string } {
  const prefixes: string[] = [];
  for (const item of items) {
    if (item.marketType.toLowerCase().includes('team cards')) {
      const idx = item.selectionName.toLowerCase().indexOf(' cards');
      if (idx > 0) {
        const prefix = item.selectionName.slice(0, idx).trim();
        if (!prefixes.includes(prefix)) prefixes.push(prefix);
      }
    }
  }
  return {
    homePrefix: prefixes[0],
    awayPrefix: prefixes[1],
  };
}

interface TotalBounds {
  minH: number;
  maxH: number;
  minA: number;
  maxA: number;
  minT: number;
  maxT: number;
  diffMin: number;
  diffMax: number;
  excludeDrawDiff: boolean;
}

function emptyBounds(upper = 500): TotalBounds {
  return {
    minH: 0,
    maxH: upper,
    minA: 0,
    maxA: upper,
    minT: 0,
    maxT: upper * 2,
    diffMin: -upper,
    diffMax: upper,
    excludeDrawDiff: false,
  };
}

function applyGeneralTotalOrHandicap(
  b: TotalBounds,
  m: MarketLike,
  homeNameHint?: string,
  awayNameHint?: string
): { valid: boolean; changed: boolean } {
  const mt = m.marketType.toLowerCase();
  const sn = m.selectionName.trim();
  const snLow = sn.toLowerCase();
  const prev = { ...b };

  if (mt === 'total points' || mt === 'total games' || mt === 'total') {
    const line = parseLine(sn);
    if (line !== null) {
      if (snLow.includes('over')) {
        b.minT = Math.max(b.minT, Math.floor(line) + 1);
      } else if (snLow.includes('under')) {
        b.maxT = Math.min(b.maxT, Math.ceil(line) - 1);
      }
    }
  } else if (mt.startsWith('1st team total') || mt.startsWith('1st player games')) {
    const line = parseLine(sn);
    if (line !== null) {
      if (snLow.includes('over')) b.minH = Math.max(b.minH, Math.floor(line) + 1);
      else if (snLow.includes('under')) b.maxH = Math.min(b.maxH, Math.ceil(line) - 1);
    }
  } else if (mt.startsWith('2nd team total') || mt.startsWith('2nd player games')) {
    const line = parseLine(sn);
    if (line !== null) {
      if (snLow.includes('over')) b.minA = Math.max(b.minA, Math.floor(line) + 1);
      else if (snLow.includes('under')) b.maxA = Math.min(b.maxA, Math.ceil(line) - 1);
    }
  } else if (mt === 'match winner') {
    b.excludeDrawDiff = true;
    const isHome = homeNameHint
      ? sn.toLowerCase() === homeNameHint.toLowerCase() || homeNameHint.toLowerCase().includes(sn.toLowerCase())
      : true;
    const isAway = awayNameHint
      ? sn.toLowerCase() === awayNameHint.toLowerCase() || awayNameHint.toLowerCase().includes(sn.toLowerCase())
      : false;
    if (isHome && !isAway) {
      b.diffMin = Math.max(b.diffMin, 1);
    } else if (isAway) {
      b.diffMax = Math.min(b.diffMax, -1);
    }
  } else if (mt === 'handicap') {
    const numMatch = sn.match(/([+-]\d+(?:\.\d+)?)/);
    if (numMatch) {
      const hcap = Number(numMatch[1]);
      // Typically `${homeShort} -4.5` (home - away > 4.5 => diff >= 5)
      // or `${awayShort} +4.5` (away - home > -4.5 => home - away < 4.5 => diff <= 4)
      if (hcap < 0) {
        b.diffMin = Math.max(b.diffMin, Math.floor(-hcap) + 1);
      } else {
        b.diffMax = Math.min(b.diffMax, Math.ceil(hcap) - 1);
      }
    }
  }

  // Tightening cross-bounds
  b.minT = Math.max(b.minT, b.minH + b.minA);
  b.maxT = Math.min(b.maxT, b.maxH + b.maxA);

  const valid =
    b.minH <= b.maxH &&
    b.minA <= b.maxA &&
    b.minT <= b.maxT &&
    b.diffMin <= b.diffMax &&
    !(b.excludeDrawDiff && b.diffMin === 0 && b.diffMax === 0);

  const changed =
    b.minH !== prev.minH ||
    b.maxH !== prev.maxH ||
    b.minA !== prev.minA ||
    b.maxA !== prev.maxA ||
    b.minT !== prev.minT ||
    b.maxT !== prev.maxT ||
    b.diffMin !== prev.diffMin ||
    b.diffMax !== prev.diffMax ||
    b.excludeDrawDiff !== prev.excludeDrawDiff;

  return { valid, changed };
}

function getTeamNamesFromLabel(label?: string): { homeName?: string; awayName?: string } {
  if (!label) return {};
  const parts = label.split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) {
    return { homeName: parts[0].trim(), awayName: parts[1].trim() };
  }
  return {};
}

/**
 * Checks whether `candidate` can logically coexist with `existingSameMatch`
 * inside a Bet Builder on the same match, detecting both contradictions ('conflict')
 * and strictly implied / redundant picks ('redundant').
 */
export function checkCandidateCompatibility(
  existingSameMatch: MarketLike[],
  candidate: MarketLike,
  teamHints?: { homeName?: string; awayName?: string }
): CompatibilityResult {
  const candId = getMktId(candidate);
  if (candId > 0 && existingSameMatch.some((e) => getMktId(e) === candId)) {
    return { compatible: true, status: 'selected', conflictingIds: [] };
  }

  if (existingSameMatch.length === 0) {
    return { compatible: true, status: 'compatible', conflictingIds: [] };
  }

  const candAxis = classifyAxis(candidate);
  const labelHints =
    teamHints ||
    getTeamNamesFromLabel((candidate as Partial<SlipSelection>).matchLabel || (existingSameMatch[0] as Partial<SlipSelection>).matchLabel);

  // 1. Direct same-market-type mutual exclusion (e.g. 1 vs X, Injury Sub Yes vs No, Set 1 A vs B, Map 1 A vs B)
  for (const ex of existingSameMatch) {
    const exAxis = classifyAxis(ex);
    if (
      ex.marketType === candidate.marketType &&
      ex.selectionName !== candidate.selectionName &&
      (candAxis === 'ht_result' ||
        candAxis === 'injury_sub' ||
        candAxis === 'stoppage_time' ||
        candAxis === 'tech_foul' ||
        candAxis === 'set_winner' ||
        candAxis === 'map_winner' ||
        ex.marketType === '1×2' ||
        ex.marketType === '1X2' ||
        ex.marketType === 'Double chance' ||
        ex.marketType === 'Both Teams to Score' ||
        ex.marketType === 'Correct Score' ||
        ex.marketType === 'Match Winner' ||
        ex.marketType === 'Handicap')
    ) {
      return {
        compatible: false,
        status: 'conflict',
        reason: `Incompatible with "${ex.selectionName}" (${ex.marketType}).`,
        conflictingIds: [getMktId(ex)],
      };
    }

    // Sub-axis exclusivity inside Injuries & Stoppages
    if (candAxis === exAxis && (candAxis === 'injury_sub' || candAxis === 'stoppage_time')) {
      return {
        compatible: false,
        status: 'conflict',
        reason: `Incompatible with "${ex.selectionName}".`,
        conflictingIds: [getMktId(ex)],
      };
    }
  }

  const allItems = [...existingSameMatch, candidate];
  const basketMode = isBasketballLine(allItems);

  // 2. Football Score + HT Exact Grid Solver
  if (!basketMode && (candAxis === 'score' || candAxis === 'ht_result')) {
    const existingScorePreds = existingSameMatch
      .map((e) => ({ item: e, pred: footballScorePredicate(e) }))
      .filter((x): x is { item: MarketLike; pred: (h: number, a: number) => boolean } => Boolean(x.pred));

    const candPred = footballScorePredicate(candidate);

    if (candPred && existingScorePreds.length > 0) {
      const validExisting = FOOTBALL_SCORE_GRID.filter(([h, a]) =>
        existingScorePreds.every(({ pred }) => pred(h, a))
      );
      const validCombined = validExisting.filter(([h, a]) => candPred(h, a));

      if (validCombined.length === 0) {
        // Identify minimal conflicting existing legs for smart auto-cleanup
        const conflictingIds: number[] = [];
        for (const { item, pred } of existingScorePreds) {
          const pairCheck = FOOTBALL_SCORE_GRID.some(([h, a]) => pred(h, a) && candPred(h, a));
          if (!pairCheck) conflictingIds.push(getMktId(item));
        }
        return {
          compatible: false,
          status: 'conflict',
          reason: `Contradicts existing selection(s) on this match.`,
          conflictingIds:
            conflictingIds.length > 0
              ? conflictingIds
              : existingScorePreds.map((x) => getMktId(x.item)),
        };
      }

      // Redundancy check: candidate adds zero new constraints on score grid (e.g., 1 or X when 1 is chosen, or Over 1.5 when Over 2.5 is chosen)
      if (candAxis === 'score' && validCombined.length === validExisting.length) {
        return {
          compatible: false,
          status: 'redundant',
          reason: `"${candidate.selectionName}" is already guaranteed by your current selections.`,
          conflictingIds: existingScorePreds.map((x) => getMktId(x.item)),
        };
      }
    }
  }

  // 3. Cards Exact Solver
  if (candAxis === 'cards') {
    const { homePrefix, awayPrefix } = inferTeamCardPrefixSides(allItems);
    const taggedExisting = attachTeamSides(existingSameMatch, homePrefix, awayPrefix);
    const [taggedCand] = attachTeamSides([candidate], homePrefix, awayPrefix);

    const existingCardPreds = taggedExisting
      .map((e) => ({ item: e, pred: cardPredicate(e) }))
      .filter((x): x is { item: MarketLike; pred: (hc: number, ac: number, r: number) => boolean } => Boolean(x.pred));
    const candCardPred = cardPredicate(taggedCand);

    if (candCardPred && existingCardPreds.length > 0) {
      const validExisting = CARD_GRID.filter(([hc, ac, r]) =>
        existingCardPreds.every(({ pred }) => pred(hc, ac, r))
      );
      const validCombined = validExisting.filter(([hc, ac, r]) => candCardPred(hc, ac, r));

      if (validCombined.length === 0) {
        const conflictingIds: number[] = [];
        for (const { item, pred } of existingCardPreds) {
          const ok = CARD_GRID.some(([hc, ac, r]) => pred(hc, ac, r) && candCardPred(hc, ac, r));
          if (!ok) conflictingIds.push(getMktId(item));
        }
        return {
          compatible: false,
          status: 'conflict',
          reason: `Card line contradicts existing card selection.`,
          conflictingIds:
            conflictingIds.length > 0 ? conflictingIds : existingCardPreds.map((x) => getMktId(x.item)),
        };
      }

      if (validCombined.length === validExisting.length) {
        return {
          compatible: false,
          status: 'redundant',
          reason: `Already guaranteed by your current card selection.`,
          conflictingIds: existingCardPreds.map((x) => getMktId(x.item)),
        };
      }
    }
  }

  // 4. Basketball / Tennis / General Totals & Winner-Handicap Solver
  if (candAxis === 'basket_totals' || candAxis === 'basket_winner_handicap') {
    const bounds = emptyBounds(600);
    const relevantExisting = existingSameMatch.filter((e) => {
      const ax = classifyAxis(e);
      return ax === 'basket_totals' || ax === 'basket_winner_handicap';
    });

    if (relevantExisting.length > 0) {
      for (const ex of relevantExisting) {
        applyGeneralTotalOrHandicap(bounds, ex, labelHints.homeName, labelHints.awayName);
      }
      const res = applyGeneralTotalOrHandicap(bounds, candidate, labelHints.homeName, labelHints.awayName);
      if (!res.valid) {
        return {
          compatible: false,
          status: 'conflict',
          reason: `Incompatible with existing Winner / Handicap / Total selection.`,
          conflictingIds: relevantExisting.map(getMktId),
        };
      }
      if (!res.changed) {
        return {
          compatible: false,
          status: 'redundant',
          reason: `Already implied by your current selection.`,
          conflictingIds: relevantExisting.map(getMktId),
        };
      }
    }
  }

  return { compatible: true, status: 'compatible', conflictingIds: [] };
}

/**
 * Adds a new selection into `existingSameMatch` while automatically deleting
 * any illogical (contradictory or redundant/superseded) earlier selections on the same match.
 */
export function applyBetBuilderSelection<T extends MarketLike>(
  existingSameMatch: T[],
  candidate: T,
  teamHints?: { homeName?: string; awayName?: string }
): { next: T[]; removed: Array<{ item: T; reason: string }> } {
  const candId = getMktId(candidate);
  if (candId > 0 && existingSameMatch.some((e) => getMktId(e) === candId)) {
    return {
      next: existingSameMatch.filter((e) => getMktId(e) !== candId),
      removed: [],
    };
  }

  // Keep existing items that remain compatible when evaluated alongside `candidate` (newest priority)
  const keptReversed: T[] = [];
  const removed: Array<{ item: T; reason: string }> = [];

  // Process from most recent to oldest so newest compatible selections survive
  const reversed = [...existingSameMatch].reverse();
  let working: T[] = [candidate];

  for (const item of reversed) {
    const check = checkCandidateCompatibility(working, item, teamHints);
    if (check.compatible) {
      working.push(item);
      keptReversed.push(item);
    } else {
      removed.push({
        item,
        reason: check.reason || 'Removed illogical / redundant selection.',
      });
    }
  }

  return {
    next: [...keptReversed.reverse(), candidate],
    removed,
  };
}

/**
 * Validates and cleans an array of selections for a single match.
 * Used both in UI sanity checks and backend validation.
 */
export function sanitizeMatchSelections<T extends MarketLike>(
  items: T[],
  teamHints?: { homeName?: string; awayName?: string }
): SanitizeResult<T> {
  const kept: T[] = [];
  const removed: Array<{ item: T; reason: string }> = [];

  for (const item of items) {
    const check = checkCandidateCompatibility(kept, item, teamHints);
    if (check.compatible) {
      kept.push(item);
    } else {
      removed.push({
        item,
        reason: check.reason || 'Incompatible same-match selection.',
      });
    }
  }

  return { kept, removed };
}

/**
 * Computes realistic Bet Builder odds for 1 or more logically compatible selections on the SAME match.
 * Independent legs multiply cleanly (~0.97); correlated score legs apply correlation dampening so
 * combined odds are always >= max(individual odds) and <= raw product.
 */
export function computeGroupOdds(sameMatchSelections: MarketLike[]): number {
  if (sameMatchSelections.length === 0) return 0;
  if (sameMatchSelections.length === 1) {
    return round2(Number(sameMatchSelections[0].simulatedOdds));
  }

  const paired = sameMatchSelections
    .map((m) => ({
      odd: Math.max(1.01, Number(m.simulatedOdds)),
      axis: classifyAxis(m),
    }))
    .sort((a, b) => b.odd - a.odd);

  const maxOdd = paired[0].odd;
  const rawProduct = paired.reduce((acc, p) => acc * p.odd, 1);

  let effective = paired[0].odd;
  for (let i = 1; i < paired.length; i++) {
    const leg = paired[i].odd;
    const ax = paired[i].axis;
    const sameAxisCorr = ax === 'score' || ax === 'cards' || ax === 'basket_totals';
    const dampening = sameAxisCorr ? 0.86 : 0.96;
    const incremental = 1 + (leg - 1) * dampening;
    effective *= Math.max(1.03, incremental);
  }

  const clamped = Math.max(maxOdd, Math.min(rawProduct, effective));
  return round2(clamped);
}

/**
 * Groups flat slip selections by matchId into Bet Builder groups.
 */
export function groupSelectionsByMatch(selections: SlipSelection[]): MatchSlipGroup[] {
  const map = new Map<number, SlipSelection[]>();
  for (const sel of selections) {
    const list = map.get(sel.matchId) || [];
    list.push(sel);
    map.set(sel.matchId, list);
  }

  return Array.from(map.entries()).map(([matchId, items]) => ({
    matchId,
    matchLabel: items[0].matchLabel,
    competitionName: items[0].competitionName,
    status: items[0].status,
    startTime: items[0].startTime,
    selections: items,
    groupOdds: computeGroupOdds(items),
    isBetBuilder: items.length > 1,
  }));
}
