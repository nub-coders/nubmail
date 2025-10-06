import { Pool, QueryResult, QueryResultRow } from 'pg';

function buildConnectionStringFromEnv(): string | null {
  const user = process.env.PGUSER || process.env.PG_USER || null;
  const password = process.env.PGPASSWORD || process.env.PG_PASSWORD || null;
  const host = process.env.PGHOST || process.env.PG_HOST || null;
  const port = process.env.PGPORT || process.env.PG_PORT || null;
  const database = process.env.PGDATABASE || process.env.PG_DATABASE || process.env.PGDB || null;
  if (user && password && host && port && database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
  return null;
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || buildConnectionStringFromEnv();
if (!connectionString) {
  throw new Error('DATABASE_URL, POSTGRES_URL, or PG* env vars must be set');
}

// Log which env variable is being used (do not log the connection string itself)
const connectionSource = process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'PG env vars';
console.log(`[startup] Postgres connection source: ${connectionSource}`);

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString, max: 10 });
    // Startup diagnostics
    (async () => {
      try {
        const start = Date.now();
        const { rows } = await pool!.query('SELECT 1 as ok');
        const ms = Date.now() - start;
        console.log(`[startup] Postgres connected: ok=${rows?.[0]?.ok === 1} in ${ms}ms`);
        // Verify essential tables exist
        const requiredTables = ['users', 'domains', 'email_accounts', 'email_messages'];
        const { rows: tables } = await pool!.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
        );
        const existing = new Set(tables.map((t: any) => t.table_name));
        const missing = requiredTables.filter((t) => !existing.has(t));
        if (missing.length > 0) {
          console.warn(`[startup] Missing tables: ${missing.join(', ')}. Run docs/postgres-schema.sql`);
        } else {
          console.log('[startup] All required tables present');
        }
      } catch (err: any) {
        console.error('[startup] Postgres connection failed:', err?.message || err);
      }
    })();
  }
  return pool;
}

export async function pgQuery<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<QueryResult<T>>{
  const client = getPgPool();
  return client.query<T>(text, params);
}
