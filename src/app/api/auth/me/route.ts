import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '') || null;
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401 });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    let payload: any;
    try {
      payload = verify(token, secret) as any;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { rows: [user] } = await pgQuery(
      'SELECT id, email, full_name as "fullName", email_verified as "emailVerified", is_admin as "isAdmin" FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ user: { id: String(user.id), email: user.email, fullName: user.fullName, emailVerified: !!user.emailVerified } });
  } catch (err) {
    console.error('Me error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
