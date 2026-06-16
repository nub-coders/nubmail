import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ 
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol' 
      }, { status: 400 });
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

    // Hash the new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear the reset token
    await pgQuery(
      'UPDATE users SET password_hash = $1, verification_code = NULL, verification_code_expiry = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    // Invalidate all active sessions for this user
    await pgQuery(
      'UPDATE sessions SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE',
      [user.id]
    );

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
