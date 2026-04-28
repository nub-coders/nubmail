import { NextRequest } from 'next/server';

export const AUTH_COOKIE_NAME = 'nubmail_auth';

function looksLikeJwt(token: string): boolean {
  // Guard against common malformed values like "null" or "undefined".
  return /^[A-Za-z0-9\-_.]+\.[A-Za-z0-9\-_.]+\.[A-Za-z0-9\-_.]+$/.test(token);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const headerToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (headerToken && looksLikeJwt(headerToken)) {
    return headerToken;
  }

  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value?.trim() || '';
  if (cookieToken && looksLikeJwt(cookieToken)) {
    return cookieToken;
  }

  return null;
}

export function buildAuthCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
