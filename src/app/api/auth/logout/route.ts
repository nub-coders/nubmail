import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getTokenFromRequest, invalidateSession } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      await invalidateSession(token);
    } catch (err) {
      console.error('Logout session invalidation failed', err);
    }
  }

  const response = NextResponse.json({ message: 'Logged out' });
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
