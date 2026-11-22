import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString =
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL_NON_POOLING;

    const host = process.env.SQL_HOST || process.env.PGHOST;
    const sslEnabled =
      process.env.SQL_SSL === 'true' ||
      process.env.VERCEL === '1' ||
      Boolean(connectionString && /sslmode=require|neon\.tech|supabase\.co|render\.com/i.test(connectionString));

    if (host) {
      global._postgresPool = new Pool({
        host,
        port: Number(process.env.SQL_PORT || process.env.PGPORT || 5432),
        user: process.env.SQL_USER || process.env.PGUSER,
        password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
        database: process.env.SQL_DB_NAME || process.env.PGDATABASE,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        database: 'sportzone',
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
