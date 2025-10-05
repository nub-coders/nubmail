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
    const domains = db.collection('domains');
    const docs = await domains.find({ userId: payload.sub }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ domains: docs.map(d => ({ id: String(d._id), domainName: d.domainName, verificationStatus: d.verificationStatus, createdAt: d.createdAt })) });
  } catch (err) {
    console.error('Domains GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { domainName } = body;
    if (!domainName) return NextResponse.json({ error: 'domainName required' }, { status: 400 });

    const db = await getDb();
    const domains = db.collection('domains');
    const now = new Date();
    const res = await domains.insertOne({ domainName, verificationStatus: 'pending', userId: payload.sub, createdAt: now });

    return NextResponse.json({ id: String(res.insertedId), domainName, verificationStatus: 'pending', createdAt: now });
  } catch (err) {
    console.error('Domains POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
