import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
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

    const { rows } = await pgQuery('SELECT 1 FROM users WHERE id = $1', [payload.sub]);
    if (rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await pgQuery('UPDATE users SET email_verified = true WHERE id = $1', [payload.sub]);

    // After verification redirect to login page with success message (client can show toast)
    const redirectUrl = '/?verified=true';
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Verify error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
