import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pgQuery } from '@/lib/postgres';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions, createSession } from '@/lib/auth-token';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { signSessionToken } from '@/lib/jwt-server';

export async function POST(req: NextRequest) {
  try {
    // Rate limit registration attempts: 3 per IP per 30 minutes
    const ip = getClientIP(req.headers);
    const { limited, retryAfterMs } = rateLimit(`register:${ip}`, 3, 30 * 60 * 1000);
    if (limited) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 1800000) / 1000)) } }
      );
    }

    const body = await req.json();
    const { email, password, fullName } = body;
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    // Password policy: at least 8 characters, includes uppercase, lowercase, digit and symbol
    const pwRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!pwRe.test(password)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol' }, { status: 400 });
    }

    const existing = await pgQuery('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing && existing.rows && existing.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const inserted = await pgQuery<{ id: string }>(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase(), hashed, fullName || null]
    );

    const userId = String(inserted.rows[0].id);
    const token = signSessionToken({ sub: userId, email });
    if (!token) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create a database-backed session
    const userAgent = req.headers.get('user-agent') || undefined;
    await createSession(userId, token, userAgent, ip);

    const response = NextResponse.json({ user: { id: userId, email, fullName } });
    response.cookies.set(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
    return response;
  } catch (err) {
    console.error('Register error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
