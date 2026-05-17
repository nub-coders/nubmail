import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { createHash } from 'crypto';
import { pgQuery } from './postgres';

export const AUTH_COOKIE_NAME = 'nubmail_auth';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function looksLikeJwt(token: string): boolean {
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

export async function createSession(userId: string, token: string, userAgent?: string, ipAddress?: string) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000);
  const tokenHash = hashToken(token);
  await pgQuery(
    'INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  );
}

export async function verifySession(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = verify(token, secret) as any;
    if (!payload || !payload.sub) return null;

    const tokenHash = hashToken(token);
    const { rows } = await pgQuery(
      'SELECT s.id as "sessionId", u.id as "id", u.email, u.full_name as "fullName", u.email_verified as "emailVerified", u.is_admin as "isAdmin" FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND s.is_active = TRUE',
      [tokenHash]
    );

    if (rows.length === 0) return null;
    return rows[0];
  } catch (err) {
    return null;
  }
}

export async function invalidateSession(token: string) {
  const tokenHash = hashToken(token);
  await pgQuery('UPDATE sessions SET is_active = FALSE WHERE token_hash = $1', [tokenHash]);
}
