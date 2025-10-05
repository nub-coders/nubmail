import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify, sign } from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '') || null;
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401 });

    const secret = process.env.JWT_SECRET || 'dev-secret';
    let payload: any;
    try {
      payload = verify(token, secret) as any;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new (await import('mongodb')).ObjectId(payload.sub) });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Create a verification token
    const verifyToken = sign({ sub: String(user._id), type: 'verify' }, secret, { expiresIn: '7d' });
    const host = req.headers.get('host') || process.env.DOMAIN || 'localhost';
    const protocol = process.env.PROTOCOL || 'http';
    const verificationUrl = `${protocol}://${host}/api/auth/verify?token=${verifyToken}`;

    // In production you should email the link. For now return it in the response so it can be used for testing.
    return NextResponse.json({ message: 'Verification link created', verificationUrl });
  } catch (err) {
    console.error('Send verification error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
