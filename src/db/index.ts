import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createMockDb } from './mockDb.ts';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function findConnectionString(): { url?: string; source: string } {
  const priorityKeys = [
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'DATABASE_URL',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL_NO_SSL',
    'DATABASE_URL_UNPOOLED',
    'NEON_DATABASE_URL',
    'SUPABASE_DB_URL',
  ];

  for (const key of priorityKeys) {
    const val = process.env[key]?.trim();
    if (val) return { url: val, source: key };
  }

  for (const [key, raw] of Object.entries(process.env)) {
    if (!raw?.trim()) continue;
    if (
      /_(POSTGRES_URL|POSTGRES_PRISMA_URL|DATABASE_URL|DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|POSTGRES_URL_NO_SSL)$/i.test(
        key
      )
    ) {
      return { url: raw.trim(), source: key };
    }
  }

  return { source: 'none' };
}

const detectedHost = (process.env.SQL_HOST || process.env.PGHOST || '').trim();
const detectedConn = findConnectionString();

export const hasDatabaseConfig = Boolean(detectedHost || detectedConn.url);
export const dbConfigSource = detectedHost
  ? process.env.SQL_HOST
    ? 'SQL_HOST'
    : 'PGHOST'
  : detectedConn.source;

export function assertDatabaseConfigured(): void {
  if (process.env.VERCEL === '1' && !hasDatabaseConfig) {
    throw new Error(
      'Database not configured on Vercel. Link a Neon/Vercel Postgres database in Vercel Storage or set DATABASE_URL / POSTGRES_URL.'
    );
  }
}

export const createPool = () => {
  if (!global._postgresPool) {
    const isVercel = process.env.VERCEL === '1';
    const connectionString = detectedConn.url;
    const host = detectedHost;
    const hostSslEnabled =
      process.env.SQL_SSL === 'true' ||
      process.env.PGSSLMODE === 'require';

    const connSslDisabled = Boolean(connectionString && /sslmode=disable/i.test(connectionString));
    const connSslEnabled =
      !connSslDisabled &&
      (process.env.SQL_SSL === 'true' ||
        isVercel ||
        Boolean(
          connectionString &&
            /sslmode=require|neon\.tech|supabase\.co|render\.com|vercel-storage/i.test(connectionString)
        ));

    if (host) {
      global._postgresPool = new Pool({
        host,
        port: Number(process.env.SQL_PORT || process.env.PGPORT || 5432),
        user: process.env.SQL_USER || process.env.PGUSER,
        password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
        database: process.env.SQL_DB_NAME || process.env.PGDATABASE,
        ssl: hostSslEnabled ? { rejectUnauthorized: false } : undefined,
        max: isVercel ? 3 : 10,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: host === 'localhost' || host === '127.0.0.1' ? 1_500 : isVercel ? 8_000 : 15_000,
      });
    } else if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl: connSslEnabled ? { rejectUnauthorized: false } : undefined,
        max: isVercel ? 3 : 10,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: isVercel ? 8_000 : 15_000,
      });
    } else {
      global._postgresPool = new Pool({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        database: 'sportzone',
        max: isVercel ? 2 : 10,
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 1_500,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let isUsingMockDb = !hasDatabaseConfig;
let pool: Pool | null = null;
let activeDb: DrizzleDb = createMockDb() as unknown as DrizzleDb;
let readyPromise: Promise<void> | null = null;

export async function ensureDbReady(): Promise<void> {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if (!hasDatabaseConfig) {
      isUsingMockDb = true;
      console.warn('[AI Studio] Database not configured — using in-memory mock store');
      return;
    }

    try {
      const candidatePool = createPool();
      await candidatePool.query('SELECT 1');
      pool = candidatePool;
      activeDb = drizzle(candidatePool, { schema });
      isUsingMockDb = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI Studio] PostgreSQL unreachable (${msg}) — falling back to in-memory mock store`);
      isUsingMockDb = true;
      activeDb = createMockDb() as unknown as DrizzleDb;
      try {
        await global._postgresPool?.end();
      } catch {
        // Ignore cleanup errors on failed pool
      }
      global._postgresPool = undefined;
      pool = null;
    }
  })();

  return readyPromise;
}

const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const value = Reflect.get(activeDb as object, prop, receiver);
    return typeof value === 'function' ? value.bind(activeDb) : value;
  },
});

export { db, isUsingMockDb, pool };
