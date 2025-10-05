import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';

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

    const body = await req.json();
    const { code } = body;
    
    if (!code) {
      return NextResponse.json({ error: 'Verification code required' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new (await import('mongodb')).ObjectId(payload.sub) });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return NextResponse.json({ error: 'No verification code found. Please request a new code.' }, { status: 400 });
    }

    if (new Date() > new Date(user.verificationCodeExpiry)) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
    }

    if (user.verificationCode !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    await users.updateOne(
      { _id: user._id },
      { 
        $set: { emailVerified: true },
        $unset: { verificationCode: '', verificationCodeExpiry: '' }
      }
    );

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Verify code error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
