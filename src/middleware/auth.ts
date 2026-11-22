import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.POSTGRES_PASSWORD ||
  process.env.SQL_PASSWORD ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'sportzone-sim-secret-key-2026';
const STARTING_VIRTUAL_CREDITS = 0; // Users begin with 0.00 DT until credited by Admin
const OWNER_ADMIN_EMAILS = new Set(['ppatrice191@gmail.com', 'ppatrice189@gmail.com']);

export interface AuthenticatedUser {
  id: number;
  uid: string;
  username: string;
  email: string;
  virtualBalance: number;
  role: string;
  favoriteTeams: string[];
  favoriteSports: string[];
  createdAt: Date;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signSessionToken(payload: { uid: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function serializeUser(row: typeof users.$inferSelect): AuthenticatedUser {
  return {
    id: row.id,
    uid: row.uid,
    username: row.username,
    email: row.email,
    virtualBalance: Math.round(row.virtualBalance * 100) / 100,
    role: row.role,
    favoriteTeams: parseJsonArray(row.favoriteTeams),
    favoriteSports: parseJsonArray(row.favoriteSports),
    createdAt: row.createdAt,
  };
}

export async function getOrCreateFirebaseUser(uid: string, email: string, displayName?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const findByUidOrEmail = async () => {
      const byUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (byUid.length > 0) return byUid[0];

      const byEmail = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.email}) = ${cleanEmail}`)
        .limit(1);
      if (byEmail.length > 0) {
        const [updated] = await db
          .update(users)
          .set({ uid, email: cleanEmail })
          .where(eq(users.id, byEmail[0].id))
          .returning();
        return updated || byEmail[0];
      }
      return null;
    };

    const existing = await findByUidOrEmail();
    if (existing) {
      return serializeUser(existing);
    }

    const defaultRole = OWNER_ADMIN_EMAILS.has(cleanEmail) ? 'admin' : 'user';
    const baseUsername =
      displayName?.trim() || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'Player';

    const insertedRows = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        username: baseUsername,
        virtualBalance: STARTING_VIRTUAL_CREDITS,
        role: defaultRole,
        favoriteTeams: '[]',
        favoriteSports: '["football","basketball"]',
      })
      .onConflictDoNothing()
      .returning();

    if (insertedRows.length > 0) {
      return serializeUser(insertedRows[0]);
    }

    // Concurrent request created the user on uid or email just before our insert
    const resolved = await findByUidOrEmail();
    if (resolved) {
      return serializeUser(resolved);
    }

    throw new Error('User record could not be resolved after conflict.');
  } catch (error) {
    console.error('Database query failed in getOrCreateFirebaseUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function resolveAuthUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  // 1. Verify local JWT session token
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid?: string; email?: string };
    if (decoded?.uid) {
      const found = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
      if (found.length > 0) {
        return serializeUser(found[0]);
      }
    }
  } catch {
    // Fall through to Firebase ID Token
  }

  // 2. Verify Firebase ID Token
  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const email = decodedFirebase.email || `${decodedFirebase.uid}@firebase.local`;
    return await getOrCreateFirebaseUser(decodedFirebase.uid, email, decodedFirebase.name);
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
};
