import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express, { type NextFunction, type Request, type Response } from 'express';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db, dbConfigSource, ensureDbReady, hasDatabaseConfig, isUsingMockDb } from './db/index.ts';
import {
  auditLogs,
  competitions,
  markets,
  matches,
  promotionsClaimed,
  sports,
  teams,
  transactions,
  users,
  virtualBetSelections,
  virtualBets,
} from './db/schema.ts';
import {
  type AuthRequest,
  requireAdmin,
  requireAuth,
  resolveAuthUser,
  serializeUser,
  signSessionToken,
} from './middleware/auth.ts';
import { fetchRealMatchCenter } from './services/matchCenter.ts';
import {
  claimVirtualPromo,
  placeVirtualBet,
  settleBetsForFinishedMatch,
  VIRTUAL_PROMO_OFFERS,
} from './services/bettingEngine.ts';
import {
  buildSimulatedMarketsForSport,
  ensureCoreSeeded,
  ensureDatabaseSeeded,
  fetchLiveFixturesSnapshot,
  syncIfStale,
  syncLiveSportsFeeds,
} from './services/sportsSync.ts';
import { realtimeHub } from './services/realtimeHub.ts';

const app = express();
app.use(express.json({ limit: '1mb' }));

function sendApiError(res: Response, error: unknown, fallbackMessage: string, defaultStatus = 500) {
  const msg = error instanceof Error ? error.message : String(error || fallbackMessage);
  const isDbConfigMissing =
    msg.includes('Database not configured on Vercel') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('Connection terminated');

  if (isDbConfigMissing) {
    return res.status(503).json({
      error: msg.includes('Database not configured')
        ? msg
        : 'PostgreSQL database is unreachable. Verify DATABASE_URL / POSTGRES_URL environment variables.',
    });
  }

  return res.status(defaultStatus).json({ error: fallbackMessage });
}

app.get('/api/health', async (_req, res) => {
  await ensureDbReady();
  let dbConnected = false;
  let dbError: string | undefined;
  if (hasDatabaseConfig || process.env.VERCEL !== '1') {
    try {
      await db.execute(sql`SELECT 1`);
      dbConnected = true;
    } catch (err: any) {
      dbError = err?.message || 'Database connection failed';
    }
  } else {
    dbError = 'No PostgreSQL connection environment variable detected on Vercel.';
  }

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    service: 'SPORTZONE',
    dbConfigured: hasDatabaseConfig,
    dbSource: isUsingMockDb ? 'in-memory' : dbConfigSource,
    dbConnected,
    ...(dbError ? { error: dbError } : {}),
  });
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`retry: ${process.env.VERCEL === '1' ? 6000 : 3000}\n`);

  const sendEvent = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  sendEvent('connected', { ts: Date.now() });

  const onMatchesUpdated = (payload: unknown) => sendEvent('matches_updated', payload);
  const onBalanceUpdated = (payload: unknown) => sendEvent('balance_updated', payload);
  const onDepositRequested = (payload: unknown) => sendEvent('deposit_requested', payload);

  realtimeHub.on('matches_updated', onMatchesUpdated);
  realtimeHub.on('balance_updated', onBalanceUpdated);
  realtimeHub.on('deposit_requested', onDepositRequested);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: ping ${Date.now()}\n\n`);
    }
  }, 25_000);

  // On Vercel serverless, close cleanly before function timeout so logs stay clean; client EventSource reconnects automatically
  const vercelCloseTimer =
    process.env.VERCEL === '1'
      ? setTimeout(() => {
          cleanup();
          if (!res.writableEnded) res.end();
        }, 7_000)
      : null;

  const cleanup = () => {
    clearInterval(heartbeat);
    if (vercelCloseTimer) clearTimeout(vercelCloseTimer);
    realtimeHub.off('matches_updated', onMatchesUpdated);
    realtimeHub.off('balance_updated', onBalanceUpdated);
    realtimeHub.off('deposit_requested', onDepositRequested);
  };

  req.on('close', cleanup);
});

const isStatelessVercelMode = () => process.env.VERCEL === '1' && !hasDatabaseConfig;

// Ensure core DB tables, sports, and admin account exist before DB-backed API routes execute
app.use('/api', async (req, res, next) => {
  await ensureDbReady();
  if (
    req.path === '/health' ||
    req.path === '/stream' ||
    (isStatelessVercelMode() &&
      (req.path === '/sports' ||
        req.path.startsWith('/matches') ||
        req.path === '/leaderboard' ||
        req.path === '/promotions'))
  ) {
    return next();
  }
  try {
    await ensureCoreSeeded();
    next();
  } catch (error) {
    console.error('Core DB bootstrap error:', error);
    return sendApiError(res, error, 'Database initialization failed.', 503);
  }
});

// ---------------------------------------------------------------------------
// Authentication Routes (Email/Password + Firebase Google Sign-In)
// ---------------------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};

    const cleanUsername = String(username || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (cleanUsername.length < 3 || cleanUsername.length > 32) {
      return res.status(400).json({ error: 'Username must be between 3 and 32 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (rawPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const uid = `local_${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        virtualBalance: 0, // Users begin with 0.00 DT
        role: 'user',
        favoriteTeams: '[]',
        favoriteSports: '["football","basketball"]',
      })
      .returning();

    const token = signSessionToken({ uid: created.uid, email: created.email, role: created.role });
    res.status(201).json({ token, user: serializeUser(created) });
  } catch (error) {
    console.error('Register error:', error);
    return sendApiError(res, error, 'Registration failed. Please try again.');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!cleanEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (found.length === 0 || !found[0].passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(rawPassword, found[0].passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signSessionToken({
      uid: found[0].uid,
      email: found[0].email,
      role: found[0].role,
    });
    res.json({ token, user: serializeUser(found[0]) });
  } catch (error) {
    console.error('Login error:', error);
    return sendApiError(res, error, 'Login failed. Please try again.');
  }
});

app.post('/api/auth/firebase', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.authUser });
});

app.post('/api/auth/reset-password/request', async (req, res) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (found.length === 0) {
      return res.json({
        message: 'If an account matches this email, a reset verification code has been generated.',
      });
    }

    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(users)
      .set({ resetToken: resetCode, resetTokenExpires: expires })
      .where(eq(users.id, found[0].id));

    res.json({
      message: 'Verification code issued.',
      simulationResetCode: resetCode,
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return sendApiError(res, error, 'Failed to generate password reset code.');
  }
});

app.post('/api/auth/reset-password/confirm', async (req, res) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim().toUpperCase();
    const newPassword = String(req.body?.newPassword || '');

    if (!cleanEmail || !code || newPassword.length < 6) {
      return res.status(400).json({
        error: 'Email, reset code, and a new password (min 6 characters) are required.',
      });
    }

    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (
      found.length === 0 ||
      !found[0].resetToken ||
      found[0].resetToken !== code ||
      !found[0].resetTokenExpires ||
      found[0].resetTokenExpires < new Date()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash, resetToken: null, resetTokenExpires: null })
      .where(eq(users.id, found[0].id));

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return sendApiError(res, error, 'Failed to reset password.');
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const userBets = await db
      .select()
      .from(virtualBets)
      .where(eq(virtualBets.userId, user.id));

    const totalBets = userBets.length;
    const wonBets = userBets.filter((b) => b.status === 'won').length;
    const lostBets = userBets.filter((b) => b.status === 'lost').length;
    const pendingBets = userBets.filter((b) => b.status === 'pending').length;
    const totalStaked = userBets.reduce((sum, b) => sum + b.virtualStake, 0);
    const totalWonCredits = userBets
      .filter((b) => b.status === 'won')
      .reduce((sum, b) => sum + b.potentialVirtualWinnings, 0);

    res.json({
      user,
      stats: {
        totalBets,
        wonBets,
        lostBets,
        pendingBets,
        winRate: totalBets > 0 ? Math.round((wonBets / Math.max(1, wonBets + lostBets)) * 100) : 0,
        totalStaked: Math.round(totalStaked * 100) / 100,
        totalWonCredits: Math.round(totalWonCredits * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return sendApiError(res, error, 'Failed to load profile.');
  }
});

app.patch('/api/user/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const favoriteTeams = Array.isArray(req.body?.favoriteTeams)
      ? req.body.favoriteTeams.map(String).slice(0, 20)
      : user.favoriteTeams;
    const favoriteSports = Array.isArray(req.body?.favoriteSports)
      ? req.body.favoriteSports.map(String).slice(0, 10)
      : user.favoriteSports;
    const username = req.body?.username ? String(req.body.username).trim().slice(0, 32) : user.username;

    const [updated] = await db
      .update(users)
      .set({
        username: username || user.username,
        favoriteTeams: JSON.stringify(favoriteTeams),
        favoriteSports: JSON.stringify(favoriteSports),
      })
      .where(eq(users.id, user.id))
      .returning();

    res.json({ user: serializeUser(updated) });
  } catch (error) {
    console.error('Favorites update error:', error);
    return sendApiError(res, error, 'Failed to update preferences.');
  }
});

// ---------------------------------------------------------------------------
// Sports, Competitions & Real-Time Matches
// ---------------------------------------------------------------------------

app.get('/api/sports', async (_req, res) => {
  try {
    if (isStatelessVercelMode()) {
      const snap = await fetchLiveFixturesSnapshot();
      return res.json({ sports: snap.sports, competitions: snap.competitions });
    }

    const [sportList, compList, matchCounts] = await Promise.all([
      db.select().from(sports),
      db.select().from(competitions),
      db
        .select({
          sportId: matches.sportId,
          status: matches.status,
          count: sql<number>`count(*)::int`,
        })
        .from(matches)
        .groupBy(matches.sportId, matches.status),
    ]);

    res.json({
      sports: sportList.map((s) => {
        const counts = matchCounts.filter((c) => c.sportId === s.id);
        return {
          ...s,
          liveCount: counts.find((c) => c.status === 'live')?.count || 0,
          totalCount: counts.reduce((acc, c) => acc + c.count, 0),
        };
      }),
      competitions: compList,
    });
  } catch (error) {
    console.error('Sports fetch error:', error);
    return sendApiError(res, error, 'Failed to load sports catalog.');
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const sportSlug = String(req.query.sport || '').trim().toLowerCase();
    const competitionSlug = String(req.query.competition || '').trim().toLowerCase();
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();

    if (isStatelessVercelMode()) {
      const snap = await fetchLiveFixturesSnapshot();
      let hydrated = [...snap.matches];
      if (sportSlug && sportSlug !== 'all') {
        hydrated = hydrated.filter((m) => m.sportSlug === sportSlug);
      }
      if (competitionSlug && competitionSlug !== 'all') {
        hydrated = hydrated.filter((m) => m.competitionSlug === competitionSlug);
      }
      if (statusFilter && statusFilter !== 'all') {
        hydrated = hydrated.filter((m) => m.status === statusFilter);
      }
      if (search) {
        hydrated = hydrated.filter(
          (m) =>
            m.homeTeam.name.toLowerCase().includes(search) ||
            m.awayTeam.name.toLowerCase().includes(search) ||
            m.competitionName.toLowerCase().includes(search) ||
            m.sportName.toLowerCase().includes(search)
        );
      }
      return res.json({ matches: hydrated, liveTotal: snap.liveTotal });
    }

    await ensureDatabaseSeeded();
    if (process.env.VERCEL === '1') {
      try {
        await syncIfStale();
      } catch (syncErr) {
        console.warn('Non-fatal Vercel stale sync warning:', syncErr);
      }
    } else {
      void syncIfStale();
    }

    const [sportRows, compRows, teamRows, matchRows, marketRows] = await Promise.all([
      db.select().from(sports),
      db.select().from(competitions),
      db.select().from(teams),
      db.select().from(matches).orderBy(desc(matches.featured), matches.startTime),
      db.select().from(markets).where(eq(markets.active, true)),
    ]);

    const sportById = new Map(sportRows.map((s) => [s.id, s]));
    const compById = new Map(compRows.map((c) => [c.id, c]));
    const teamById = new Map(teamRows.map((t) => [t.id, t]));
    const marketsByMatch = new Map<number, typeof marketRows>();

    for (const mkt of marketRows) {
      const list = marketsByMatch.get(mkt.matchId) || [];
      list.push(mkt);
      marketsByMatch.set(mkt.matchId, list);
    }

    let hydrated = matchRows.map((m) => {
      const sport = sportById.get(m.sportId);
      const competition = compById.get(m.competitionId);
      const homeTeam = teamById.get(m.homeTeamId);
      const awayTeam = teamById.get(m.awayTeamId);
      const allMarkets = marketsByMatch.get(m.id) || [];

      return {
        id: m.id,
        externalId: m.externalId,
        sportId: m.sportId,
        sportSlug: sport?.slug || 'football',
        sportName: sport?.name || 'Football',
        competitionId: m.competitionId,
        competitionSlug: competition?.slug || '',
        competitionName: competition?.name || '',
        competitionCountry: competition?.country || '',
        homeTeam: homeTeam || { id: m.homeTeamId, name: 'Home', shortName: 'HOM', logo: '#eab308' },
        awayTeam: awayTeam || { id: m.awayTeamId, name: 'Away', shortName: 'AWY', logo: '#38bdf8' },
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        matchTimer: m.matchTimer,
        startTime: m.startTime,
        dataSource: m.dataSource,
        featured: m.featured,
        markets: allMarkets,
      };
    });

    if (sportSlug && sportSlug !== 'all') {
      hydrated = hydrated.filter((m) => m.sportSlug === sportSlug);
    }
    if (competitionSlug && competitionSlug !== 'all') {
      hydrated = hydrated.filter((m) => m.competitionSlug === competitionSlug);
    }
    if (statusFilter && statusFilter !== 'all') {
      hydrated = hydrated.filter((m) => m.status === statusFilter);
    }
    if (search) {
      hydrated = hydrated.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(search) ||
          m.awayTeam.name.toLowerCase().includes(search) ||
          m.competitionName.toLowerCase().includes(search) ||
          m.sportName.toLowerCase().includes(search)
      );
    }

    const orderWeight: Record<string, number> = { live: 0, upcoming: 1, finished: 2 };
    hydrated.sort((a, b) => {
      const wDiff = (orderWeight[a.status] ?? 3) - (orderWeight[b.status] ?? 3);
      if (wDiff !== 0) return wDiff;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    res.json({
      matches: hydrated,
      liveTotal: matchRows.filter((m) => m.status === 'live').length,
    });
  } catch (error) {
    console.error('Matches fetch error:', error);
    return sendApiError(res, error, 'Failed to load matches.');
  }
});

app.get('/api/matches/:id', async (req, res) => {
  try {
    const matchId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(matchId)) {
      return res.status(400).json({ error: 'Invalid match ID.' });
    }

    if (isStatelessVercelMode()) {
      const snap = await fetchLiveFixturesSnapshot();
      const match = snap.matches.find((m) => m.id === matchId);
      if (!match) return res.status(404).json({ error: 'Match not found.' });
      return res.json({ match });
    }

    await ensureDatabaseSeeded();
    if (process.env.VERCEL === '1') {
      try {
        await syncIfStale();
      } catch {
        // Non-fatal
      }
    } else {
      void syncIfStale();
    }

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    const [[sport], [competition], [homeTeam], [awayTeam], matchMarkets] = await Promise.all([
      db.select().from(sports).where(eq(sports.id, match.sportId)),
      db.select().from(competitions).where(eq(competitions.id, match.competitionId)),
      db.select().from(teams).where(eq(teams.id, match.homeTeamId)),
      db.select().from(teams).where(eq(teams.id, match.awayTeamId)),
      db.select().from(markets).where(eq(markets.matchId, match.id)),
    ]);

    res.json({
      match: {
        ...match,
        sportSlug: sport?.slug || 'football',
        sportName: sport?.name || 'Football',
        competitionName: competition?.name || '',
        competitionCountry: competition?.country || '',
        homeTeam,
        awayTeam,
        markets: matchMarkets,
      },
    });
  } catch (error) {
    console.error('Match detail error:', error);
    return sendApiError(res, error, 'Failed to load match details.');
  }
});

app.post('/api/matches/sync-live', async (_req, res) => {
  try {
    if (isStatelessVercelMode()) {
      const snap = await fetchLiveFixturesSnapshot();
      return res.json({ ok: true, synced: snap.matches.length, updated: 0, sources: ['ESPN', 'LiveScore'] });
    }
    await ensureDatabaseSeeded();
    const summary = await syncLiveSportsFeeds();
    res.json({ ok: true, ...summary });
  } catch (error) {
    console.error('Live sync error:', error);
    return sendApiError(res, error, 'Failed to synchronize live sports feeds.');
  }
});

app.get('/api/matches/:id/matchcenter', async (req, res) => {
  try {
    const matchId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(matchId)) {
      return res.status(400).json({ error: 'Invalid match ID.' });
    }

    if (isStatelessVercelMode()) {
      const snap = await fetchLiveFixturesSnapshot();
      const m = snap.matches.find((item) => item.id === matchId);
      if (!m) return res.status(404).json({ error: 'Match not found.' });
      const matchCenter = await fetchRealMatchCenter({
        externalId: m.externalId,
        competitionSlug: m.competitionSlug || '',
        homeTeamName: m.homeTeam?.name || '',
        awayTeamName: m.awayTeam?.name || '',
      });
      return res.json({ matchCenter });
    }

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    const [[competition], [homeTeam], [awayTeam]] = await Promise.all([
      db.select().from(competitions).where(eq(competitions.id, match.competitionId)),
      db.select().from(teams).where(eq(teams.id, match.homeTeamId)),
      db.select().from(teams).where(eq(teams.id, match.awayTeamId)),
    ]);

    const matchCenter = await fetchRealMatchCenter({
      externalId: match.externalId,
      competitionSlug: competition?.slug || '',
      homeTeamName: homeTeam?.name || '',
      awayTeamName: awayTeam?.name || '',
    });

    res.json({ matchCenter });
  } catch (error) {
    console.error('Match center fetch error:', error);
    return sendApiError(res, error, 'Failed to load live match center.');
  }
});

// ---------------------------------------------------------------------------
// Betting Slip (Single, Multiple, System), History, Deposits & Promotions
// ---------------------------------------------------------------------------

app.post('/api/bets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const { stake, marketIds, mode, systemSize, idempotencyKey } = req.body ?? {};
    const result = await placeVirtualBet({
      userId: user.id,
      stake: Number(stake),
      marketIds: Array.isArray(marketIds) ? marketIds : [],
      mode: mode === 'single' || mode === 'system' ? mode : 'multiple',
      systemSize: systemSize ? Number(systemSize) : undefined,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to place bet.' });
  }
});

app.get('/api/bets/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
    const toDate = req.query.to ? new Date(String(req.query.to)) : null;

    const conditions = [eq(virtualBets.userId, user.id)];
    if (statusFilter && statusFilter !== 'all') {
      conditions.push(eq(virtualBets.status, statusFilter));
    }
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(virtualBets.createdAt, fromDate));
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(virtualBets.createdAt, endOfDay));
    }

    const bets = await db
      .select()
      .from(virtualBets)
      .where(and(...conditions))
      .orderBy(desc(virtualBets.createdAt));

    if (bets.length === 0) {
      return res.json({ bets: [] });
    }

    const betIds = bets.map((b) => b.id);
    const selections = await db
      .select()
      .from(virtualBetSelections)
      .where(inArray(virtualBetSelections.virtualBetId, betIds));

    const selectionsByBet = new Map<number, typeof selections>();
    for (const sel of selections) {
      const list = selectionsByBet.get(sel.virtualBetId) || [];
      list.push(sel);
      selectionsByBet.set(sel.virtualBetId, list);
    }

    res.json({
      bets: bets.map((b) => ({
        ...b,
        selections: selectionsByBet.get(b.id) || [],
      })),
    });
  } catch (error) {
    console.error('Bet history error:', error);
    return sendApiError(res, error, 'Failed to load betting history.');
  }
});

app.get('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    res.json({ transactions: rows });
  } catch (error) {
    console.error('Transactions error:', error);
    return sendApiError(res, error, 'Failed to load transaction ledger.');
  }
});

app.post('/api/deposits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    const rawMethod = String(req.body?.method || 'D17').trim().slice(0, 32);
    const allowedMethods = ['D17', 'Flouci', 'Bank Transfer', 'Cash'];
    const method = allowedMethods.includes(rawMethod) ? rawMethod : 'D17';
    const reference = String(req.body?.reference || '').trim().slice(0, 80);

    if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
      return res.status(400).json({ error: 'Deposit amount must be between 1.00 DT and 50,000 DT.' });
    }
    if (reference.length < 3) {
      return res.status(400).json({ error: 'Please enter a valid transfer reference (min 3 characters).' });
    }

    const [created] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        amount,
        transactionType: 'deposit_pending',
        description: `[${method} · ${reference}] Pending Deposit Request`,
      })
      .returning();

    realtimeHub.emitDepositRequested({
      userId: user.id,
      username: user.username,
      amount,
      reference,
    });

    res.status(201).json({ deposit: created });
  } catch (error) {
    console.error('Deposit request error:', error);
    return sendApiError(res, error, 'Failed to submit deposit request.');
  }
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    if (isStatelessVercelMode()) {
      return res.json({ leaderboard: [] });
    }
    const topUsers = await db
      .select({
        id: users.id,
        username: users.username,
        virtualBalance: users.virtualBalance,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.virtualBalance))
      .limit(25);

    const allBets = await db
      .select({
        userId: virtualBets.userId,
        status: virtualBets.status,
      })
      .from(virtualBets);

    const leaders = topUsers.map((u, idx) => {
      const userBets = allBets.filter((b) => b.userId === u.id);
      const settled = userBets.filter((b) => b.status === 'won' || b.status === 'lost');
      const won = userBets.filter((b) => b.status === 'won').length;
      return {
        rank: idx + 1,
        id: u.id,
        username: u.username,
        virtualBalance: Math.round(u.virtualBalance * 100) / 100,
        totalBets: userBets.length,
        wonBets: won,
        winRate: settled.length > 0 ? Math.round((won / settled.length) * 100) : 0,
      };
    });

    res.json({ leaderboard: leaders });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return sendApiError(res, error, 'Failed to load leaderboard.');
  }
});

app.get('/api/promotions', async (req, res) => {
  try {
    if (isStatelessVercelMode()) {
      return res.json({
        promotions: VIRTUAL_PROMO_OFFERS.map((offer) => ({ ...offer, claimed: false })),
      });
    }
    const authUser = await resolveAuthUser(req);
    let claimedCodes: Array<{ promoCode: string; claimedAt: Date }> = [];
    if (authUser) {
      claimedCodes = await db
        .select({
          promoCode: promotionsClaimed.promoCode,
          claimedAt: promotionsClaimed.claimedAt,
        })
        .from(promotionsClaimed)
        .where(eq(promotionsClaimed.userId, authUser.id));
    }

    const offers = VIRTUAL_PROMO_OFFERS.map((offer) => {
      const claims = claimedCodes.filter((c) => c.promoCode === offer.code);
      let claimed = false;
      if (offer.cadence === 'once' && claims.length > 0) claimed = true;
      if (offer.cadence === 'daily' && claims.length > 0) {
        const latest = claims.reduce((a, b) => (a.claimedAt > b.claimedAt ? a : b));
        if ((Date.now() - latest.claimedAt.getTime()) / (1000 * 3600) < 24) {
          claimed = true;
        }
      }
      return { ...offer, claimed };
    });

    res.json({ promotions: offers });
  } catch (error) {
    console.error('Promotions error:', error);
    return sendApiError(res, error, 'Failed to load promotions.');
  }
});

app.post('/api/promotions/claim', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const code = String(req.body?.code || '');
    const result = await claimVirtualPromo(user.id, code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Unable to claim virtual reward.' });
  }
});

// ---------------------------------------------------------------------------
// Protected Admin Dashboard Routes (User Search, Top-Up, Deposits, Winnings)
// ---------------------------------------------------------------------------

app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [allUsers, allBets, allLogs, allSports, allComps, allTeams, allMatches] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(virtualBets).orderBy(desc(virtualBets.createdAt)).limit(200),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50),
      db.select().from(sports),
      db.select().from(competitions),
      db.select().from(teams),
      db.select().from(matches).orderBy(desc(matches.createdAt)),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const usersWithMetrics = allUsers.map((u) => {
      const uBets = allBets.filter((b) => b.userId === u.id);
      const totalGain = uBets
        .filter((b) => b.status === 'won')
        .reduce((sum, b) => sum + b.potentialVirtualWinnings, 0);
      const pendingPotentialGain = uBets
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + b.potentialVirtualWinnings, 0);
      const totalStaked = uBets.reduce((sum, b) => sum + b.virtualStake, 0);
      return {
        ...serializeUser(u),
        totalBets: uBets.length,
        wonBets: uBets.filter((b) => b.status === 'won').length,
        pendingBets: uBets.filter((b) => b.status === 'pending').length,
        totalGain: Math.round(totalGain * 100) / 100,
        pendingPotentialGain: Math.round(pendingPotentialGain * 100) / 100,
        totalStaked: Math.round(totalStaked * 100) / 100,
      };
    });

    res.json({
      stats: {
        totalUsers: allUsers.length,
        totalMatches: allMatches.length,
        liveMatches: allMatches.filter((m) => m.status === 'live').length,
        totalVirtualBets: allBets.length,
        totalVirtualVolume:
          Math.round(allBets.reduce((acc, b) => acc + b.virtualStake, 0) * 100) / 100,
      },
      users: usersWithMetrics,
      bets: allBets.slice(0, 60).map((b) => ({
        ...b,
        username: userMap.get(b.userId)?.username || `User #${b.userId}`,
      })),
      auditLogs: allLogs.map((l) => ({
        ...l,
        adminName: userMap.get(l.adminId)?.username || `Admin #${l.adminId}`,
      })),
      sports: allSports,
      competitions: allComps,
      teams: allTeams,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return sendApiError(res, error, 'Failed to load admin dashboard.');
  }
});

app.get('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Invalid user ID.' });

    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const [userBets, userTxs] = await Promise.all([
      db.select().from(virtualBets).where(eq(virtualBets.userId, targetId)).orderBy(desc(virtualBets.createdAt)),
      db.select().from(transactions).where(eq(transactions.userId, targetId)).orderBy(desc(transactions.createdAt)).limit(30),
    ]);

    const betIds = userBets.map((b) => b.id);
    const selections =
      betIds.length > 0
        ? await db.select().from(virtualBetSelections).where(inArray(virtualBetSelections.virtualBetId, betIds))
        : [];

    const selMap = new Map<number, typeof selections>();
    for (const s of selections) {
      const list = selMap.get(s.virtualBetId) || [];
      list.push(s);
      selMap.set(s.virtualBetId, list);
    }

    const totalGain = userBets
      .filter((b) => b.status === 'won')
      .reduce((acc, b) => acc + b.potentialVirtualWinnings, 0);
    const pendingGain = userBets
      .filter((b) => b.status === 'pending')
      .reduce((acc, b) => acc + b.potentialVirtualWinnings, 0);
    const totalStaked = userBets.reduce((acc, b) => acc + b.virtualStake, 0);

    res.json({
      user: serializeUser(target),
      metrics: {
        totalBets: userBets.length,
        wonBets: userBets.filter((b) => b.status === 'won').length,
        lostBets: userBets.filter((b) => b.status === 'lost').length,
        pendingBets: userBets.filter((b) => b.status === 'pending').length,
        totalGain: Math.round(totalGain * 100) / 100,
        pendingGain: Math.round(pendingGain * 100) / 100,
        totalStaked: Math.round(totalStaked * 100) / 100,
      },
      bets: userBets.map((b) => ({
        ...b,
        selections: selMap.get(b.id) || [],
      })),
      transactions: userTxs,
    });
  } catch (error) {
    console.error('Admin inspect user error:', error);
    return sendApiError(res, error, 'Failed to inspect user account.');
  }
});

app.post('/api/admin/users/:id/credit', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetId = Number.parseInt(req.params.id, 10);
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    const note = String(req.body?.note || 'Admin Credit Top-Up').trim().slice(0, 120);

    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Invalid user ID.' });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: 'Credit amount must be between 0.01 DT and 100,000 DT.' });
    }

    const updated = await db.transaction(async (tx) => {
      const [userRow] = await tx
        .update(users)
        .set({
          virtualBalance: sql`${users.virtualBalance} + ${amount}`,
        })
        .where(eq(users.id, targetId))
        .returning();

      if (!userRow) {
        throw new Error('User not found.');
      }

      await tx.insert(transactions).values({
        userId: targetId,
        amount,
        transactionType: 'admin_credit',
        description: `${note} (by ${req.authUser!.username})`,
      });

      await tx.insert(auditLogs).values({
        adminId: req.authUser!.id,
        action: 'CREDIT_USER_ACCOUNT',
        details: `Credited +${amount.toFixed(2)} DT to ${userRow.email} (New balance: ${userRow.virtualBalance.toFixed(2)} DT)`,
      });

      return userRow;
    });

    realtimeHub.emitUserBalanceUpdated(updated.id, updated.virtualBalance, 'admin_credit');
    res.json({ user: serializeUser(updated) });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to credit user account.' });
  }
});

app.get('/api/admin/deposits', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        username: users.username,
        email: users.email,
        amount: transactions.amount,
        transactionType: transactions.transactionType,
        description: transactions.description,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(users, eq(transactions.userId, users.id))
      .where(inArray(transactions.transactionType, ['deposit_pending', 'deposit_approved', 'deposit_rejected']))
      .orderBy(desc(transactions.createdAt))
      .limit(60);

    res.json({ deposits: rows });
  } catch (error) {
    console.error('Admin deposits list error:', error);
    return sendApiError(res, error, 'Failed to load deposit requests.');
  }
});

app.post('/api/admin/deposits/:id/approve', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const txId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(txId)) return res.status(400).json({ error: 'Invalid deposit ID.' });

    const result = await db.transaction(async (tx) => {
      const [pendingRow] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.transactionType, 'deposit_pending')))
        .limit(1);

      if (!pendingRow) {
        throw new Error('Deposit request not found or already processed.');
      }

      const [updatedTx] = await tx
        .update(transactions)
        .set({
          transactionType: 'deposit_approved',
          description: `${pendingRow.description.replace('Pending Deposit Request', 'Approved Deposit')} · by ${req.authUser!.username}`,
        })
        .where(and(eq(transactions.id, txId), eq(transactions.transactionType, 'deposit_pending')))
        .returning();

      if (!updatedTx) {
        throw new Error('Deposit request was already processed.');
      }

      const [userRow] = await tx
        .update(users)
        .set({
          virtualBalance: sql`${users.virtualBalance} + ${pendingRow.amount}`,
        })
        .where(eq(users.id, pendingRow.userId))
        .returning();

      if (!userRow) {
        throw new Error('User account not found.');
      }

      await tx.insert(auditLogs).values({
        adminId: req.authUser!.id,
        action: 'APPROVE_DEPOSIT',
        details: `Approved deposit #${txId} (+${pendingRow.amount.toFixed(2)} DT) for ${userRow.email}`,
      });

      return { deposit: updatedTx, user: userRow };
    });

    realtimeHub.emitUserBalanceUpdated(result.user.id, result.user.virtualBalance, 'deposit_approved');
    res.json({ deposit: result.deposit, user: serializeUser(result.user) });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to approve deposit.' });
  }
});

app.post('/api/admin/deposits/:id/reject', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const txId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(txId)) return res.status(400).json({ error: 'Invalid deposit ID.' });

    const result = await db.transaction(async (tx) => {
      const [pendingRow] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.transactionType, 'deposit_pending')))
        .limit(1);

      if (!pendingRow) {
        throw new Error('Deposit request not found or already processed.');
      }

      const [updatedTx] = await tx
        .update(transactions)
        .set({
          transactionType: 'deposit_rejected',
          description: `${pendingRow.description.replace('Pending Deposit Request', 'Rejected Deposit')} · by ${req.authUser!.username}`,
        })
        .where(and(eq(transactions.id, txId), eq(transactions.transactionType, 'deposit_pending')))
        .returning();

      if (!updatedTx) {
        throw new Error('Deposit request was already processed.');
      }

      const [userRow] = await tx.select().from(users).where(eq(users.id, pendingRow.userId)).limit(1);

      await tx.insert(auditLogs).values({
        adminId: req.authUser!.id,
        action: 'REJECT_DEPOSIT',
        details: `Rejected deposit #${txId} (${pendingRow.amount.toFixed(2)} DT) for user #${pendingRow.userId}`,
      });

      return { deposit: updatedTx, user: userRow };
    });

    if (result.user) {
      realtimeHub.emitUserBalanceUpdated(result.user.id, result.user.virtualBalance, 'deposit_rejected');
    }
    res.json({ deposit: result.deposit });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to reject deposit.' });
  }
});

app.post('/api/admin/sports', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const icon = String(req.body?.icon || 'trophy').trim();
    if (!name) return res.status(400).json({ error: 'Sport name is required.' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const [created] = await db.insert(sports).values({ slug, name, icon }).returning();
    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'CREATE_SPORT',
      details: `Created sport ${name}`,
    });

    res.status(201).json({ sport: created });
  } catch {
    res.status(400).json({ error: 'Could not create sport.' });
  }
});

app.post('/api/admin/competitions', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const country = String(req.body?.country || 'International').trim();
    const sportId = Number(req.body?.sportId);
    if (!name || !sportId) {
      return res.status(400).json({ error: 'Competition name and sport are required.' });
    }
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-3)}`;

    const [created] = await db
      .insert(competitions)
      .values({ slug, name, sportId, country, featured: Boolean(req.body?.featured) })
      .returning();

    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'CREATE_COMPETITION',
      details: `Created competition ${name} (${country})`,
    });

    res.status(201).json({ competition: created });
  } catch {
    res.status(400).json({ error: 'Could not create competition.' });
  }
});

app.post('/api/admin/matches', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      sportId,
      competitionId,
      homeTeamName,
      awayTeamName,
      status = 'upcoming',
      matchTimer = 'Scheduled',
      startTime,
      homeScore = 0,
      awayScore = 0,
    } = req.body ?? {};

    if (!sportId || !competitionId || !homeTeamName || !awayTeamName) {
      return res.status(400).json({ error: 'Sport, competition, home team, and away team are required.' });
    }

    const [sport] = await db.select().from(sports).where(eq(sports.id, Number(sportId))).limit(1);
    if (!sport) return res.status(404).json({ error: 'Sport not found.' });

    const ensureTeam = async (name: string) => {
      const clean = name.trim();
      const found = await db
        .select()
        .from(teams)
        .where(sql`LOWER(${teams.name}) = LOWER(${clean}) AND ${teams.sportId} = ${sport.id}`)
        .limit(1);
      if (found.length > 0) return found[0];
      const [created] = await db
        .insert(teams)
        .values({
          name: clean,
          shortName: clean.slice(0, 3).toUpperCase(),
          logo: '#eab308',
          sportId: sport.id,
        })
        .returning();
      return created;
    };

    const homeTeam = await ensureTeam(String(homeTeamName));
    const awayTeam = await ensureTeam(String(awayTeamName));

    const [createdMatch] = await db
      .insert(matches)
      .values({
        sportId: sport.id,
        competitionId: Number(competitionId),
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: Number(homeScore) || 0,
        awayScore: Number(awayScore) || 0,
        status: ['live', 'upcoming', 'finished'].includes(status) ? status : 'upcoming',
        matchTimer: String(matchTimer || 'Scheduled'),
        startTime: startTime ? new Date(startTime) : new Date(Date.now() + 3600 * 1000),
        dataSource: 'admin',
        featured: Boolean(req.body?.featured),
      })
      .returning();

    const defaultMarkets = buildSimulatedMarketsForSport(
      createdMatch.id,
      sport.slug,
      homeTeam.name,
      awayTeam.name,
      createdMatch.id
    );
    await db.insert(markets).values(defaultMarkets);

    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'CREATE_MATCH',
      details: `Created match #${createdMatch.id}: ${homeTeam.name} vs ${awayTeam.name}`,
    });

    realtimeHub.emitMatchesUpdated({});
    res.status(201).json({ match: createdMatch });
  } catch (error) {
    console.error('Create match error:', error);
    return sendApiError(res, error, 'Failed to create match.');
  }
});

app.patch('/api/admin/matches/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const matchId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(matchId)) return res.status(400).json({ error: 'Invalid match ID.' });

    const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Match not found.' });

    const { homeScore, awayScore, status, matchTimer, featured } = req.body ?? {};
    const nextStatus = ['live', 'upcoming', 'finished'].includes(status) ? status : existing.status;

    const [updated] = await db
      .update(matches)
      .set({
        homeScore: homeScore !== undefined ? Number(homeScore) : existing.homeScore,
        awayScore: awayScore !== undefined ? Number(awayScore) : existing.awayScore,
        status: nextStatus,
        matchTimer: matchTimer !== undefined ? String(matchTimer) : existing.matchTimer,
        featured: featured !== undefined ? Boolean(featured) : existing.featured,
      })
      .where(eq(matches.id, matchId))
      .returning();

    if (nextStatus === 'finished') {
      await settleBetsForFinishedMatch(matchId);
    }

    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'UPDATE_MATCH',
      details: `Updated match #${matchId} (${updated.homeScore}-${updated.awayScore}, ${updated.status}, ${updated.matchTimer})`,
    });

    realtimeHub.emitMatchesUpdated({});
    res.json({ match: updated });
  } catch (error) {
    console.error('Update match error:', error);
    return sendApiError(res, error, 'Failed to update match.');
  }
});

app.delete('/api/admin/matches/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const matchId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(matchId)) return res.status(400).json({ error: 'Invalid match ID.' });

    await db.delete(virtualBetSelections).where(eq(virtualBetSelections.matchId, matchId));
    const deleted = await db.delete(matches).where(eq(matches.id, matchId)).returning();
    if (deleted.length === 0) return res.status(404).json({ error: 'Match not found.' });

    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'DELETE_MATCH',
      details: `Deleted match #${matchId}`,
    });

    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete match error:', error);
    return sendApiError(res, error, 'Failed to delete match.');
  }
});

app.patch('/api/admin/markets/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const marketId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(marketId)) return res.status(400).json({ error: 'Invalid market ID.' });

    const odds = Number(req.body?.simulatedOdds);
    const active = req.body?.active;
    const updates: Partial<typeof markets.$inferInsert> = {};
    if (Number.isFinite(odds) && odds >= 1.01) {
      updates.simulatedOdds = Math.round(odds * 100) / 100;
    }
    if (typeof active === 'boolean') {
      updates.active = active;
    }

    const [updated] = await db
      .update(markets)
      .set(updates)
      .where(eq(markets.id, marketId))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Market not found.' });

    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'UPDATE_MARKET_ODDS',
      details: `Market #${marketId} (${updated.selectionName}) -> odds ${updated.simulatedOdds}, active=${updated.active}`,
    });

    realtimeHub.emitMatchesUpdated({});
    res.json({ market: updated });
  } catch (error) {
    console.error('Update market error:', error);
    return sendApiError(res, error, 'Failed to update market.');
  }
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Invalid user ID.' });

    const { virtualBalance, role } = req.body ?? {};
    const [existing] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const nextBalance =
      virtualBalance !== undefined && Number.isFinite(Number(virtualBalance))
        ? Math.max(0, Math.round(Number(virtualBalance) * 100) / 100)
        : existing.virtualBalance;
    const nextRole = role === 'admin' || role === 'user' ? role : existing.role;

    const [updated] = await db
      .update(users)
      .set({ virtualBalance: nextBalance, role: nextRole })
      .where(eq(users.id, targetId))
      .returning();

    if (nextBalance !== existing.virtualBalance) {
      await db.insert(transactions).values({
        userId: targetId,
        amount: Math.round((nextBalance - existing.virtualBalance) * 100) / 100,
        transactionType: 'admin_adjustment',
        description: `Admin balance update by ${req.authUser!.username}`,
      });
    }

    await db.insert(auditLogs).values({
      adminId: req.authUser!.id,
      action: 'UPDATE_USER',
      details: `Updated user ${existing.email}: role=${nextRole}, balance=${nextBalance.toFixed(2)} DT`,
    });

    if (nextBalance !== existing.virtualBalance) {
      realtimeHub.emitUserBalanceUpdated(updated.id, updated.virtualBalance, 'admin_adjustment');
    }

    res.json({ user: serializeUser(updated) });
  } catch (error) {
    console.error('Update user error:', error);
    return sendApiError(res, error, 'Failed to update user account.');
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  if (!res.headersSent) {
    res.status(err?.status || 500).json({ error: err?.message || 'Internal server error.' });
  }
});

export { app };
export default app;
