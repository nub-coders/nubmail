import { NextResponse } from 'next/server';
import { getPgPool } from '@/lib/postgres';

export async function GET() {
  const status: any = { ok: true, checks: {} };
  try {
    const pool = getPgPool();
    const start = Date.now();
    const { rows } = await pool.query('SELECT 1 as ok');
    status.checks.postgres = { ok: rows?.[0]?.ok === 1, ms: Date.now() - start };
  } catch (e: any) {
    console.error('[health] Postgres check failed:', e);
    status.ok = false;
    status.checks.postgres = { ok: false };
  }
  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}


