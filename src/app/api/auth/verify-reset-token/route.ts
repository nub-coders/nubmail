import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');

    const { rows } = await pgQuery<{ id: string; verification_code_expiry: Date }>(
      'SELECT id, verification_code_expiry FROM users WHERE verification_code = $1',
      [hashedToken]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 });
    }

    const user = rows[0];
    const now = new Date();
    const expiry = new Date(user.verification_code_expiry);

    if (expiry < now) {
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('Verify reset token error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
