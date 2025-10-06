import { NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { pgQuery, usePostgres } from '@/lib/postgres';

export async function getAdminFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  
  try {
    const payload = verify(token, secret) as any;
    if (usePostgres()) {
      const { rows } = await pgQuery<{ id: string; email: string; is_admin: boolean }>(
        'SELECT id, email, is_admin FROM users WHERE id = $1',
        [payload.sub]
      );
      const user = rows[0];
      if (!user || !user.is_admin) return null;
      return { id: String(user.id), email: user.email, isAdmin: true };
    } else {
      const db = await getDb();
      const users = db.collection('users');
      const user = await users.findOne({ _id: new ObjectId(payload.sub) });
      if (!user || !user.isAdmin) return null;
      return { id: String(user._id), email: user.email, isAdmin: true };
    }
  } catch {
    return null;
  }
}

export async function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  
  try {
    const payload = verify(token, secret) as any;
    return payload;
  } catch {
    return null;
  }
}
