import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { pgQuery } from './postgres';

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

/**
 * Creates a database-backed session for a user.
 */
export async function createSession(userId: string, token: string, userAgent?: string, ipAddress?: string) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000); // 7 days
  await pgQuery(
    'INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
    [userId, token, expiresAt, userAgent, ipAddress]
  );
}

/**
 * Verifies a token against the database-backed sessions.
 */
export async function verifySession(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = verify(token, secret) as any;
    if (!payload || !payload.sub) return null;

    const { rows } = await pgQuery(
      'SELECT s.id as "sessionId", u.id as "id", u.email, u.full_name as "fullName", u.email_verified as "emailVerified", u.is_admin as "isAdmin" FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND s.is_active = TRUE',
      [token]
    );

    if (rows.length === 0) return null;
    return rows[0];
  } catch (err) {
    return null;
  }
}

/**
 * Invalidates a session in the database.
 */
export async function invalidateSession(token: string) {
  await pgQuery('UPDATE sessions SET is_active = FALSE WHERE token_hash = $1', [token]);
}
