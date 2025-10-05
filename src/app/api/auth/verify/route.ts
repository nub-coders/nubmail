import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    let payload: any;
    try {
      payload = verify(token, secret) as any;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    if (payload?.type !== 'verify' || !payload?.sub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const userId = new (await import('mongodb')).ObjectId(payload.sub);
    const user = await users.findOne({ _id: userId });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await users.updateOne({ _id: userId }, { $set: { emailVerified: true } });

    // After verification redirect to login page with success message (client can show toast)
    const redirectUrl = '/?verified=true';
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Verify error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
