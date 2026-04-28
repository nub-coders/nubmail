import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { verify } from 'jsonwebtoken';
import { getTokenFromRequest } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401 });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
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

    const { rows } = await pgQuery<{ verification_code: string | null; verification_code_expiry: Date | null }>(
      'SELECT verification_code, verification_code_expiry FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.verification_code || !user.verification_code_expiry) {
      return NextResponse.json({ error: 'No verification code found. Please request a new code.' }, { status: 400 });
    }

    if (new Date() > new Date(user.verification_code_expiry)) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
    }

    if (user.verification_code !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    await pgQuery(
      'UPDATE users SET email_verified = true, verification_code = NULL, verification_code_expiry = NULL WHERE id = $1',
      [payload.sub]
    );

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Verify code error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
