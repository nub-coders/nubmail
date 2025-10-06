import { Pool } from 'pg';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (process.env.USE_POSTGRES === 'true' && !connectionString) {
  throw new Error('POSTGRES_URL (or DATABASE_URL) must be set when USE_POSTGRES=true');
}

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}

export async function pgQuery<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }>{
  const client = getPgPool();
  return client.query<T>(text, params);
}

export function usePostgres(): boolean {
  return process.env.USE_POSTGRES === 'true';
}


