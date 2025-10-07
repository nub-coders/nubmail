import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromToken } from '@/lib/admin';
import { getDnsCheckConfigFromEnv, runDnsChecks } from '@/utils/dns-check';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });

    const cfg = getDnsCheckConfigFromEnv();
    const results = await runDnsChecks(cfg);
    const ok = results.every((r) => r.ok);
    return NextResponse.json({ ok, results, config: cfg });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'DNS check failed' }, { status: 500 });
  }
}


