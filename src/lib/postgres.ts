import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (process.env.USE_POSTGRES === 'true' && !connectionString) {
  throw new Error('POSTGRES_URL (or DATABASE_URL) must be set when USE_POSTGRES=true');
}

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

export function usePostgres(): boolean {
  return process.env.USE_POSTGRES === 'true';
}


