import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
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

    const db = await getDb();
    const users = db.collection('users');
    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ message: 'User already exists', user: { email } });
    }

    const hashed = await bcrypt.hash(password, 10);
    const isAdmin = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
    await users.insertOne({ 
      email: email.toLowerCase(), 
      password: hashed, 
      fullName, 
      emailVerified: Boolean(isAdmin), 
      isAdmin: Boolean(isAdmin),
      createdAt: new Date() 
    });
    return NextResponse.json({ message: 'Seeded user', user: { email } });
  } catch (err) {
    console.error('Seed error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
