import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pgQuery } from '@/lib/postgres';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions, createSession } from '@/lib/auth-token';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { signSessionToken } from '@/lib/jwt-server';

export async function POST(req: NextRequest) {
  try {
    // Rate limit login attempts: 5 per IP per 15 minutes
    const ip = getClientIP(req.headers);
    const { limited, retryAfterMs } = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (limited) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 900000) / 1000)) } }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let email: string | undefined;
    let password: string | undefined;
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json();
        email = body?.email;
        password = body?.password;
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData();
        email = form.get('email')?.toString();
        password = form.get('password')?.toString();
      } else {
        return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    const { rows } = await pgQuery<{ id: string; email: string; password_hash: string; full_name: string | null; email_verified: boolean | null; is_admin: boolean | null }>(
      'SELECT id, email, password_hash, full_name, email_verified, is_admin FROM users WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
    let user = rows[0];

    // Constant-time guard against user enumeration: always run bcrypt.
    const dummyHash = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8JZSxEU8vsIfYxIdvROGv6mFHWkQVa';
    const passwordOk = await bcrypt.compare(password, user ? user.password_hash : dummyHash);
    if (!user || !passwordOk) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Mark admin users as verified on login
    if (user.is_admin && !user.email_verified) {
      await pgQuery('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
      // Re-fetch user to get updated value
      const { rows: updatedRows } = await pgQuery<{ id: string; email: string; password_hash: string; full_name: string | null; email_verified: boolean | null; is_admin: boolean | null }>(
        'SELECT id, email, password_hash, full_name, email_verified, is_admin FROM users WHERE id = $1',
        [user.id]
      );
      user = updatedRows[0];
    }

    const token = signSessionToken({
      sub: String(user.id),
      email: user.email,
      emailVerified: !!user.email_verified,
      isAdmin: !!user.is_admin,
    });
    if (!token) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create a database-backed session for revocation and tracking
    const userAgent = req.headers.get('user-agent') || undefined;
    const ipAddress = getClientIP(req.headers);
    await createSession(String(user.id), token, userAgent, ipAddress);

    const response = NextResponse.json({ user: { id: String(user.id), email: user.email, fullName: user.full_name, emailVerified: !!user.email_verified, isAdmin: !!user.is_admin } });
    response.cookies.set(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
    return response;
  } catch (err) {
    console.error('Login error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
