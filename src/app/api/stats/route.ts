import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';

async function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  try {
    const payload = verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const domainsCount = await db.collection('domains').countDocuments({ userId: payload.sub });
    const accountsCount = await db.collection('emailAccounts').countDocuments({ userId: payload.sub });
    const emailsCount = await db.collection('emailMessages').countDocuments({ userId: payload.sub });

    return NextResponse.json({ domains: domainsCount, accounts: accountsCount, emailsSent: emailsCount });
  } catch (err) {
    console.error('Stats error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
