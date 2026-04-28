import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { sign, verify } from 'jsonwebtoken';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions, getTokenFromRequest } from '@/lib/auth-token';

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

    const protocol = process.env.PROTOCOL || 'https';
    const host = process.env.HOST || process.env.VIRTUAL_HOST || 'localhost:5000';
    const response = NextResponse.redirect(new URL(`/verify-email?verified=1`, `${protocol}://${host}`));

    const currentAuthToken = getTokenFromRequest(req);
    if (currentAuthToken) {
      try {
        const currentPayload = verify(currentAuthToken, secret) as any;
        if (String(currentPayload?.sub) === String(payload.sub)) {
          const refreshedToken = sign(
            {
              sub: String(payload.sub),
              email: currentPayload.email,
              emailVerified: true,
              isAdmin: !!currentPayload.isAdmin,
              fullName: currentPayload.fullName,
            },
            secret,
            { expiresIn: '7d' }
          );
          response.cookies.set(AUTH_COOKIE_NAME, refreshedToken, buildAuthCookieOptions());
        }
      } catch {
      }
    }

    return response;
  } catch (err) {
    console.error('Verify error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
