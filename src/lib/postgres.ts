import { Pool, QueryResult, QueryResultRow } from 'pg';

function buildConnectionStringFromEnv(): string | null {
  const user = process.env.PGUSER || null;
  const password = process.env.PGPASSWORD || null;
  const host = process.env.PGHOST || null;
  const port = process.env.PGPORT || null;
  const database = process.env.PGDATABASE || null;
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

let pool: Pool | null = null;
let poolInitPromise: Promise<void> | null = null;
const shouldExitOnInitFailure = process.env.PG_FAIL_FAST !== 'false';

async function runStartupChecks(client: Pool) {
  const start = Date.now();
  await client.query('SELECT 1 as ok');
  const ms = Date.now() - start;

  const requiredTables = ['users', 'domains', 'email_accounts', 'email_messages'];
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );

  const existing = new Set(tables.map((t: any) => t.table_name));
  const missing = requiredTables.filter((t) => !existing.has(t));
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(', ')}`);
  }

  console.info(`[postgres] Connected via ${connectionSource}. Startup checks passed in ${ms}ms.`);
}

function initializePool() {
  if (pool) return;

  pool = new Pool({ connectionString: connectionString || undefined, max: 10 });

  pool.on('error', (err) => {
    console.error('[postgres] Pool error:', err);
  });

  poolInitPromise = runStartupChecks(pool).catch((err) => {
    console.error('[postgres] Startup checks failed:', err);
    if (shouldExitOnInitFailure) {
      setTimeout(() => process.exit(1), 0);
    }
    throw err;
  });
}

export function getPgPool(): Pool {
  if (!pool) {
    initializePool();
  }
  return pool!;
}

export async function pgQuery<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<QueryResult<T>>{
  const client = getPgPool();
  if (poolInitPromise) {
    await poolInitPromise;
  }
  return client.query<T>(text, params);
}

export async function pgTransaction<T>(fn: (query: <R extends QueryResultRow = any>(text: string, params?: any[]) => Promise<QueryResult<R>>) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(<R extends QueryResultRow = any>(text: string, params: any[] = []) => client.query<R>(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
