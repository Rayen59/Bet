import crypto from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  markets,
  matches,
  promotionsClaimed,
  teams,
  transactions,
  users,
  virtualBetSelections,
  virtualBets,
} from '../db/schema.ts';
import { realtimeHub } from './realtimeHub.ts';
import { computeGroupOdds, sanitizeMatchSelections } from '../lib/betBuilder.ts';

export interface PlaceBetInput {
  userId: number;
  stake: number;
  marketIds: number[];
  mode?: 'single' | 'multiple' | 'system';
  systemSize?: number;
  idempotencyKey?: string;
}

export interface PromoOffer {
  code: string;
  title: string;
  description: string;
  rewardCredits: number;
  cadence: 'once' | 'daily';
}

export const VIRTUAL_PROMO_OFFERS: PromoOffer[] = [
  {
    code: 'BOOST50',
    title: 'Starter Matchday Bonus',
    description: 'Request 50 DT virtual bonus credits to explore real-time multi-leg slips.',
    rewardCredits: 50,
    cadence: 'once',
  },
  {
    code: 'DAILY20',
    title: 'Daily Simulation Stipend',
    description: 'Claim 20 DT virtual credits once every 24 hours.',
    rewardCredits: 20,
    cadence: 'daily',
  },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

export async function placeVirtualBet(input: PlaceBetInput) {
  const stakePerUnit = round2(Number(input.stake));
  const mode = input.mode === 'single' || input.mode === 'system' ? input.mode : 'multiple';

  if (!Number.isFinite(stakePerUnit) || stakePerUnit < 5 || stakePerUnit > 100000) {
    throw new Error('La mise minimum est de 5.00 DT (maximum 100,000 DT).');
  }

  const uniqueMarketIds = Array.from(new Set(input.marketIds.map(Number))).filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (uniqueMarketIds.length === 0 || uniqueMarketIds.length > 20) {
    throw new Error('Select between 1 and 20 valid markets.');
  }

  const idempKey = input.idempotencyKey?.trim() || null;

  return await db.transaction(async (tx) => {
    const [bettor] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!bettor) {
      throw new Error('User account not found.');
    }
    if (bettor.role === 'admin') {
      throw new Error('Admin accounts cannot place bets. Admins only approve deposits and manage the platform.');
    }

    if (idempKey) {
      const existing = await tx
        .select()
        .from(virtualBets)
        .where(eq(virtualBets.idempotencyKey, idempKey))
        .limit(1);
      if (existing.length > 0) {
        return {
          bet: existing[0],
          bets: [existing[0]],
          references: [existing[0].reference],
          totalStake: existing[0].virtualStake,
          totalPotentialWinnings: existing[0].potentialVirtualWinnings,
          mode,
          duplicate: true,
        };
      }
    }

    const dbMarkets = await tx
      .select()
      .from(markets)
      .where(inArray(markets.id, uniqueMarketIds));

    if (dbMarkets.length !== uniqueMarketIds.length) {
      throw new Error('One or more selected markets are no longer available.');
    }

    const matchIds = Array.from(new Set(dbMarkets.map((m) => m.matchId)));

    const dbMatches = await tx
      .select()
      .from(matches)
      .where(inArray(matches.id, matchIds));

    const matchById = new Map(dbMatches.map((m) => [m.id, m]));
    const teamIds = Array.from(new Set(dbMatches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
    const dbTeams = await tx.select().from(teams).where(inArray(teams.id, teamIds));
    const teamById = new Map(dbTeams.map((t) => [t.id, t]));

    for (const mkt of dbMarkets) {
      if (!mkt.active) {
        throw new Error(`Market "${mkt.selectionName}" is currently suspended.`);
      }
      const match = matchById.get(mkt.matchId);
      if (!match) {
        throw new Error('Match associated with a selection was not found.');
      }
      if (match.status === 'finished') {
        throw new Error('Cannot place bets on finished matches.');
      }
    }

    // Group markets by matchId and enforce Bet Builder logical validity per match
    const marketsByMatch = new Map<number, typeof dbMarkets>();
    for (const mkt of dbMarkets) {
      const list = marketsByMatch.get(mkt.matchId) || [];
      list.push(mkt);
      marketsByMatch.set(mkt.matchId, list);
    }

    const matchGroups: Array<{ matchId: number; markets: typeof dbMarkets; groupOdds: number }> = [];
    for (const [mId, mList] of marketsByMatch.entries()) {
      const match = matchById.get(mId)!;
      const homeName = teamById.get(match.homeTeamId)?.name;
      const awayName = teamById.get(match.awayTeamId)?.name;
      const check = sanitizeMatchSelections(mList, { homeName, awayName });
      if (check.removed.length > 0) {
        const first = check.removed[0];
        throw new Error(
          `Illogical Bet Builder selection "${first.item.selectionName}": ${first.reason}`
        );
      }
      matchGroups.push({
        matchId: mId,
        markets: check.kept,
        groupOdds: computeGroupOdds(check.kept),
      });
    }

    if (mode === 'system') {
      if (matchGroups.length < 3 || matchGroups.length > 10) {
        throw new Error('System bets require between 3 and 10 distinct matches.');
      }
    }

    // Build ticket groups by matchGroups according to mode:
    // - single: each match group (single pick or same-match Bet Builder) is its own ticket
    // - multiple: 1 accumulator ticket combining all match groups (with combo boost)
    // - system: C(n, k) combinations of match groups
    let ticketMatchGroups: Array<typeof matchGroups> = [];
    let systemLabel: string | undefined;

    if (mode === 'single') {
      ticketMatchGroups = matchGroups.map((g) => [g]);
    } else if (mode === 'system') {
      const k = Math.max(2, Math.min(matchGroups.length - 1, Number(input.systemSize) || 2));
      ticketMatchGroups = getCombinations(matchGroups, k);
      systemLabel = `${k}/${matchGroups.length}`;
    } else {
      ticketMatchGroups = [matchGroups];
    }

    const totalStake = round2(stakePerUnit * ticketMatchGroups.length);

    const updatedUsers = await tx
      .update(users)
      .set({
        virtualBalance: sql`${users.virtualBalance} - ${totalStake}`,
      })
      .where(and(eq(users.id, input.userId), sql`${users.virtualBalance} >= ${totalStake}`))
      .returning();

    if (updatedUsers.length === 0) {
      throw new Error(
        `Insufficient DT balance (Need ${totalStake.toFixed(2)} DT). Ask the administrator to credit your account.`
      );
    }

    const updatedUser = updatedUsers[0];
    const createdBets: Array<typeof virtualBets.$inferSelect> = [];
    let totalPotentialWinnings = 0;

    for (let idx = 0; idx < ticketMatchGroups.length; idx++) {
      const ticketGroups = ticketMatchGroups[idx];
      const flatMarkets = ticketGroups.flatMap((g) => g.markets);
      const combinedOdds = round2(ticketGroups.reduce((acc, g) => acc * g.groupOdds, 1));
      const qualifyingEvents = ticketGroups.filter((g) => g.groupOdds >= 1.2).length;
      const boostPct =
        mode === 'multiple' && ticketGroups.length >= 3
          ? qualifyingEvents >= 4
            ? 0.1
            : qualifyingEvents >= 3
            ? 0.05
            : 0
          : 0;
      const baseWin = round2(stakePerUnit * combinedOdds);
      const extraWin = round2(baseWin * boostPct);
      const potentialWinnings = round2(baseWin + extraWin);
      totalPotentialWinnings = round2(totalPotentialWinnings + potentialWinnings);

      const hasBetBuilder = ticketGroups.some((g) => g.markets.length > 1);
      const prefix = hasBetBuilder && ticketGroups.length === 1
        ? 'SZ-BB'
        : mode === 'single'
        ? 'SZ-SGL'
        : mode === 'system'
        ? 'SZ-SYS'
        : 'SZ-CMB';
      const refCode = `${prefix}-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${Date.now()
        .toString()
        .slice(-4)}${ticketMatchGroups.length > 1 ? `-${idx + 1}` : ''}`;

      const [createdBet] = await tx
        .insert(virtualBets)
        .values({
          userId: input.userId,
          reference: refCode,
          idempotencyKey: idx === 0 ? idempKey : null,
          virtualStake: stakePerUnit,
          combinedOdds,
          potentialVirtualWinnings: potentialWinnings,
          status: 'pending',
        })
        .returning();

      createdBets.push(createdBet);

      const selectionRows = flatMarkets.map((mkt) => {
        const match = matchById.get(mkt.matchId)!;
        const home = teamById.get(match.homeTeamId)?.name || 'Home';
        const away = teamById.get(match.awayTeamId)?.name || 'Away';
        return {
          virtualBetId: createdBet.id,
          matchId: mkt.matchId,
          marketId: mkt.id,
          marketType: mkt.marketType,
          selectionName: mkt.selectionName,
          simulatedOdds: mkt.simulatedOdds,
          matchLabel: `${home} vs ${away}`,
          result: 'pending',
        };
      });

      await tx.insert(virtualBetSelections).values(selectionRows);
    }

    const txLabel =
      mode === 'single'
        ? `Single ×${ticketMatchGroups.length} (${createdBets.map((b) => b.reference).join(', ')})`
        : mode === 'system'
        ? `System ${systemLabel} · ${ticketMatchGroups.length} combos`
        : `Slip ${createdBets[0].reference} (${dbMarkets.length} legs)`;

    await tx.insert(transactions).values({
      userId: input.userId,
      amount: -totalStake,
      transactionType: 'bet_stake',
      description: txLabel.slice(0, 180),
    });

    return {
      bet: createdBets[0],
      bets: createdBets,
      references: createdBets.map((b) => b.reference),
      mode,
      systemLabel,
      comboCount: createdBets.length,
      totalStake,
      totalPotentialWinnings,
      updatedBalance: round2(updatedUser.virtualBalance),
      duplicate: false,
    };
  });
}

function evaluateSelectionResult(
  marketType: string,
  selectionName: string,
  homeScore: number,
  awayScore: number,
  homeName: string,
  awayName: string
): 'won' | 'lost' {
  const total = homeScore + awayScore;

  if (marketType === '1×2' || marketType === '1X2') {
    if (selectionName === '1') return homeScore > awayScore ? 'won' : 'lost';
    if (selectionName === 'X') return homeScore === awayScore ? 'won' : 'lost';
    if (selectionName === '2') return awayScore > homeScore ? 'won' : 'lost';
  }

  if (marketType === 'Double chance' || marketType === 'Double Chance') {
    if (selectionName === '1 or X' || selectionName === '1X') return homeScore >= awayScore ? 'won' : 'lost';
    if (selectionName === '1 or 2' || selectionName === '12') return homeScore !== awayScore ? 'won' : 'lost';
    if (selectionName === 'X or 2' || selectionName === 'X2') return awayScore >= homeScore ? 'won' : 'lost';
  }

  if (marketType === 'Total' || marketType === 'Over/Under 2.5 Goals' || marketType === 'Total Points' || marketType === 'Total Games') {
    const numMatch = selectionName.match(/([0-9]+(?:\.[0-9]+)?)/);
    const line = numMatch ? Number(numMatch[1]) : 2.5;
    if (selectionName.toLowerCase().includes('over')) return total > line ? 'won' : 'lost';
    if (selectionName.toLowerCase().includes('under')) return total < line ? 'won' : 'lost';
  }

  if (marketType.startsWith('1st Team Total') || marketType.startsWith('1st Player Games')) {
    const numMatch = selectionName.match(/([0-9]+(?:\.[0-9]+)?)/);
    const line = numMatch ? Number(numMatch[1]) : 0.5;
    if (selectionName.toLowerCase().includes('over')) return homeScore > line ? 'won' : 'lost';
    if (selectionName.toLowerCase().includes('under')) return homeScore < line ? 'won' : 'lost';
  }

  if (marketType.startsWith('2nd Team Total') || marketType.startsWith('2nd Player Games')) {
    const numMatch = selectionName.match(/([0-9]+(?:\.[0-9]+)?)/);
    const line = numMatch ? Number(numMatch[1]) : 0.5;
    if (selectionName.toLowerCase().includes('over')) return awayScore > line ? 'won' : 'lost';
    if (selectionName.toLowerCase().includes('under')) return awayScore < line ? 'won' : 'lost';
  }

  if (marketType === 'Handicap') {
    const numMatch = selectionName.match(/([+-]\d+(?:\.\d+)?)/);
    if (numMatch) {
      const hcap = Number(numMatch[1]);
      if (hcap < 0) return homeScore + hcap > awayScore ? 'won' : 'lost';
      return awayScore + hcap > homeScore ? 'won' : 'lost';
    }
  }

  if (marketType === 'Both Teams to Score') {
    const bothScored = homeScore > 0 && awayScore > 0;
    if (selectionName === 'Yes') return bothScored ? 'won' : 'lost';
    if (selectionName === 'No') return !bothScored ? 'won' : 'lost';
  }

  if (marketType === 'Correct Score') {
    return selectionName === `${homeScore}-${awayScore}` ? 'won' : 'lost';
  }

  if (marketType === 'Match Winner') {
    if (selectionName === homeName) return homeScore > awayScore ? 'won' : 'lost';
    if (selectionName === awayName) return awayScore > homeScore ? 'won' : 'lost';
  }

  return homeScore >= awayScore ? 'won' : 'lost';
}

export async function settleBetsForFinishedMatch(matchId: number) {
  await db.transaction(async (tx) => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match || match.status !== 'finished') return;

    const [homeTeam] = await tx.select().from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
    const [awayTeam] = await tx.select().from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
    const homeName = homeTeam?.name || 'Home';
    const awayName = awayTeam?.name || 'Away';

    const pendingSelections = await tx
      .select()
      .from(virtualBetSelections)
      .where(and(eq(virtualBetSelections.matchId, matchId), eq(virtualBetSelections.result, 'pending')));

    if (pendingSelections.length === 0) return;

    const affectedBetIds = new Set<number>();

    for (const sel of pendingSelections) {
      const outcome = evaluateSelectionResult(
        sel.marketType,
        sel.selectionName,
        match.homeScore,
        match.awayScore,
        homeName,
        awayName
      );
      await tx
        .update(virtualBetSelections)
        .set({ result: outcome })
        .where(eq(virtualBetSelections.id, sel.id));
      affectedBetIds.add(sel.virtualBetId);
    }

    for (const betId of affectedBetIds) {
      const [bet] = await tx.select().from(virtualBets).where(eq(virtualBets.id, betId)).limit(1);
      if (!bet || bet.status !== 'pending') continue;

      const selections = await tx
        .select()
        .from(virtualBetSelections)
        .where(eq(virtualBetSelections.virtualBetId, betId));

      const hasLost = selections.some((s) => s.result === 'lost');
      const allResolved = selections.every((s) => s.result !== 'pending');

      if (hasLost) {
        await tx.update(virtualBets).set({ status: 'lost' }).where(eq(virtualBets.id, betId));
      } else if (allResolved) {
        await tx.update(virtualBets).set({ status: 'won' }).where(eq(virtualBets.id, betId));
        const [creditedUser] = await tx
          .update(users)
          .set({
            virtualBalance: sql`${users.virtualBalance} + ${bet.potentialVirtualWinnings}`,
          })
          .where(eq(users.id, bet.userId))
          .returning();

        await tx.insert(transactions).values({
          userId: bet.userId,
          amount: bet.potentialVirtualWinnings,
          transactionType: 'bet_payout',
          description: `Winning Payout (${bet.reference})`,
        });

        if (creditedUser) {
          realtimeHub.emitUserBalanceUpdated(
            creditedUser.id,
            round2(creditedUser.virtualBalance),
            `Bet won (${bet.reference}): +${bet.potentialVirtualWinnings.toFixed(2)} DT`
          );
        }
      }
    }
  });
}

export async function claimVirtualPromo(userId: number, promoCode: string) {
  const code = promoCode.trim().toUpperCase();
  const offer = VIRTUAL_PROMO_OFFERS.find((p) => p.code === code);
  if (!offer) {
    throw new Error('Invalid promotion code.');
  }

  return await db.transaction(async (tx) => {
    const claims = await tx
      .select()
      .from(promotionsClaimed)
      .where(and(eq(promotionsClaimed.userId, userId), eq(promotionsClaimed.promoCode, code)));

    if (offer.cadence === 'once' && claims.length > 0) {
      throw new Error('This virtual reward has already been claimed on your account.');
    }

    if (offer.cadence === 'daily' && claims.length > 0) {
      const latest = claims.reduce((a, b) => (a.claimedAt > b.claimedAt ? a : b));
      const hoursSince = (Date.now() - latest.claimedAt.getTime()) / (1000 * 3600);
      if (hoursSince < 24) {
        const remaining = Math.ceil(24 - hoursSince);
        throw new Error(`Daily reward already claimed. Available again in ${remaining}h.`);
      }
    }

    await tx.insert(promotionsClaimed).values({
      userId,
      promoCode: offer.code,
      rewardCredits: offer.rewardCredits,
    });

    const [updatedUser] = await tx
      .update(users)
      .set({
        virtualBalance: sql`${users.virtualBalance} + ${offer.rewardCredits}`,
      })
      .where(eq(users.id, userId))
      .returning();

    await tx.insert(transactions).values({
      userId,
      amount: offer.rewardCredits,
      transactionType: 'promo_reward',
      description: `Virtual Promotion Reward (${offer.code})`,
    });

    return {
      offer,
      updatedBalance: round2(updatedUser.virtualBalance),
    };
  });
}
