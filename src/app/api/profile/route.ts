import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions } from '@/lib/auth-token';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows: [user] } = await pgQuery(
      `SELECT id, email, full_name AS "fullName", email_verified AS "emailVerified",
              is_admin AS "isAdmin", created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (err) {
    console.error('Profile GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fullName, currentPassword, newPassword } = body;

    if (fullName !== undefined) {
      await pgQuery('UPDATE users SET full_name = $1 WHERE id = $2', [fullName || null, payload.sub]);
    }

    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      const { rows: [user] } = await pgQuery(
        'SELECT password_hash FROM users WHERE id = $1',
        [payload.sub]
      );
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 10);
      await pgQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, payload.sub]);
    }

    const { rows: [updated] } = await pgQuery(
      `SELECT id, email, full_name AS "fullName", email_verified AS "emailVerified",
              is_admin AS "isAdmin"
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    const secret = process.env.JWT_SECRET;
    let token: string | undefined;
    if (secret) {
      token = sign(
        { sub: String(updated.id), email: updated.email, emailVerified: !!updated.emailVerified, isAdmin: !!updated.isAdmin },
        secret,
        { expiresIn: '7d' }
      );
    }

    const response = NextResponse.json({ user: updated, token });
    if (token) {
      response.cookies.set(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
    }
    return response;
  } catch (err) {
    console.error('Profile PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await pgQuery('DELETE FROM users WHERE id = $1', [payload.sub]);

    const response = NextResponse.json({ message: 'Account deleted' });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (err) {
    console.error('Profile DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
