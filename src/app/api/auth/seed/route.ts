import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  // Dev-only seeding endpoint. Disabled in production.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    // Accept JSON body if provided. If not provided, fall back to ADMIN_EMAIL/ADMIN_PASS env vars.
    const body = await req.json().catch(() => ({}));
    let email = body?.email;
    let password = body?.password;
    const fullName = body?.fullName || 'Admin User';

    if (!email || !password) {
      // Use explicit admin env vars if available
      if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASS) {
        email = process.env.ADMIN_EMAIL;
        password = process.env.ADMIN_PASS;
      }
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required for seeding' }, { status: 400 });
    }

    const existing = await pgQuery('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ message: 'User already exists', user: { email } });
    }

    const hashed = await bcrypt.hash(password, 10);
    const isAdmin = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
    await pgQuery(
      'INSERT INTO users (email, password_hash, full_name, email_verified, is_admin) VALUES ($1, $2, $3, $4, $5)',
      [email.toLowerCase(), hashed, fullName, Boolean(isAdmin), Boolean(isAdmin)]
    );
    return NextResponse.json({ message: 'Seeded user', user: { email } });
  } catch (err) {
    console.error('Seed error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
