import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName } = body;
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    // Password policy: at least 8 characters, includes uppercase, lowercase, digit and symbol
    const pwRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!pwRe.test(password)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) return NextResponse.json({ error: 'User already exists' }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const result = await users.insertOne({ email: email.toLowerCase(), password: hashed, fullName: fullName || null, emailVerified: false, createdAt: new Date() });

    const payload = { sub: String(result.insertedId), email };
    const token = sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

    return NextResponse.json({ token, user: { id: String(result.insertedId), email, fullName } });
  } catch (err) {
    console.error('Register error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
