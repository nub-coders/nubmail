import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifySession } from '@/lib/auth-token';

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401 });

    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    return NextResponse.json({ user, token });
  } catch (err) {
    console.error('Me error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
