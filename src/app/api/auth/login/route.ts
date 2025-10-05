import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    const db = await getDb();
    const users = db.collection('users');
    let user = await users.findOne({ email: email.toLowerCase() });

    // Determine whether auto-seeding is allowed. Allow in development or on preview hosts
    const host = (req.headers.get('host') || '').toLowerCase();
    const allowSeed = process.env.NODE_ENV !== 'production' || host.includes('projects.builder.codes') || host.includes('fly.dev') || host.includes('localhost');

    // Auto-seed development/preview user when not found to make testing easier
    if (!user && allowSeed) {
      const devPassword = process.env.DEV_SEED_PASSWORD || 'Air8858@';
      const hashed = await bcrypt.hash(devPassword, 10);
      const res = await users.insertOne({ email: email.toLowerCase(), password: hashed, fullName: 'Dev User', createdAt: new Date() });
      user = await users.findOne({ _id: res.insertedId });
      console.info('Auto-seeded dev user for host', host, email.toLowerCase());
    }

    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const payload = { sub: String(user._id), email: user.email };
    const token = sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

    return NextResponse.json({ token, user: { id: String(user._id), email: user.email, fullName: user.fullName } });
  } catch (err) {
    console.error('Login error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
