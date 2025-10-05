import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  // Dev-only seeding endpoint. Disabled in production.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.email || 'dev@nub-coder.tech';
    const password = body?.password || 'Air8858@';
    const fullName = body?.fullName || 'Dev User';

    const db = await getDb();
    const users = db.collection('users');
    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ message: 'User already exists', user: { email } });
    }

    const hashed = await bcrypt.hash(password, 10);
    await users.insertOne({ email: email.toLowerCase(), password: hashed, fullName, createdAt: new Date() });
    return NextResponse.json({ message: 'Seeded user', user: { email, password } });
  } catch (err) {
    console.error('Seed error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
