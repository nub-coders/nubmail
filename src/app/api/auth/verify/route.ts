import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions, createSession, getTokenFromRequest, invalidateSession } from '@/lib/auth-token';
import { signSessionToken, verifyJwt } from '@/lib/jwt-server';

async function handle(token: string | null, req: NextRequest) {
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const payload = verifyJwt(token, { type: 'verify' });
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  const { rows } = await pgQuery<{ id: string; email: string; full_name: string | null; is_admin: boolean | null }>(
    'SELECT id, email, full_name, is_admin FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = rows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await pgQuery('UPDATE users SET email_verified = true WHERE id = $1', [payload.sub]);

  const protocol = process.env.PROTOCOL || 'https';
  const host = process.env.HOST || process.env.VIRTUAL_HOST || 'localhost:5000';
  const redirectUrl = new URL(`/verify-email?verified=1`, `${protocol}://${host}`);

  const response = req.method === 'GET'
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json({ verified: true, redirect: redirectUrl.toString() });

  const currentAuthToken = getTokenFromRequest(req);
  if (currentAuthToken) {
    const currentPayload = verifyJwt(currentAuthToken);
    if (currentPayload && String(currentPayload.sub) === String(payload.sub)) {
      const refreshedToken = signSessionToken({
        sub: String(user.id),
        email: user.email,
        emailVerified: true,
        isAdmin: !!user.is_admin,
        fullName: user.full_name,
      });
      if (refreshedToken) {
        try { await invalidateSession(currentAuthToken); } catch { /* noop */ }
        await createSession(
          String(user.id),
          refreshedToken,
          req.headers.get('user-agent') || undefined,
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
        );
        response.cookies.set(AUTH_COOKIE_NAME, refreshedToken, buildAuthCookieOptions());
      }
    }
  }

  return response;
}

// GET kept for backwards-compatible email links. Renders confirmation page that
// must POST to actually mark verification + rotate session.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const payload = verifyJwt(token, { type: 'verify' });
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  const protocol = process.env.PROTOCOL || 'https';
  const host = process.env.HOST || process.env.VIRTUAL_HOST || 'localhost:5000';
  return NextResponse.redirect(new URL(`/verify-email?token=${encodeURIComponent(token)}`, `${protocol}://${host}`));
}

export async function POST(req: NextRequest) {
  try {
    let token: string | null = null;
    try {
      const body = await req.json();
      token = typeof body?.token === 'string' ? body.token : null;
    } catch {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    }
    return await handle(token, req);
  } catch (err) {
    console.error('Verify error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
