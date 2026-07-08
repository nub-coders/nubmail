import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { getUserFromToken } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [domains, accounts, emails] = await Promise.all([
      pgQuery<{ count: string }>('SELECT COUNT(*)::int AS count FROM domains WHERE user_id = $1', [payload.sub]),
      pgQuery<{ count: string }>('SELECT COUNT(*)::int AS count FROM email_accounts WHERE user_id = $1', [payload.sub]),
      pgQuery<{ count: string }>('SELECT COUNT(*)::int AS count FROM email_messages WHERE user_id = $1', [payload.sub])
    ]);
    return NextResponse.json({ domains: Number(domains.rows[0].count), accounts: Number(accounts.rows[0].count), emailsSent: Number(emails.rows[0].count) });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
