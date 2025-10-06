import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';
import { pgQuery, usePostgres } from '@/lib/postgres';

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

    if (usePostgres()) {
      const [domains, accounts, emails] = await Promise.all([
        pgQuery<{ count: string }>('SELECT COUNT(*)::int AS count FROM domains WHERE user_id = $1', [payload.sub]),
        pgQuery<{ count: string }>('SELECT COUNT(*)::int AS count FROM email_accounts WHERE user_id = $1', [payload.sub]),
        pgQuery<{ count: string }>('SELECT COUNT(*)::int AS count FROM email_messages WHERE user_id = $1', [payload.sub])
      ]);
      return NextResponse.json({ domains: Number(domains.rows[0].count), accounts: Number(accounts.rows[0].count), emailsSent: Number(emails.rows[0].count) });
    } else {
      const db = await getDb();
      const domainsCount = await db.collection('domains').countDocuments({ userId: payload.sub });
      const accountsCount = await db.collection('emailAccounts').countDocuments({ userId: payload.sub });
      const emailsCount = await db.collection('emailMessages').countDocuments({ userId: payload.sub });
  
      return NextResponse.json({ domains: domainsCount, accounts: accountsCount, emailsSent: emailsCount });
    }
  } catch (err) {
    console.error('Stats error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
