import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { pgQuery } from '@/lib/postgres';

async function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = verify(token, secret) as any;
    return payload;
  } catch {
    return null;
  }
}

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
    console.error('Stats error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
