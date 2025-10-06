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

    // Get user from PostgreSQL
    const { rows } = await pgQuery<{ id: string; email: string; full_name: string | null; is_admin: boolean }>(
      'SELECT id, email, full_name, is_admin FROM users WHERE id = $1',
      [payload.sub]
    );
    
    const user = rows[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        fullName: user.full_name,
        isAdmin: user.is_admin
      } 
    });
  } catch (err) {
    console.error('Me error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
