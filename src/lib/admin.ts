import { NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export async function getAdminFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  
  try {
    const payload = verify(token, secret) as any;
    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(payload.sub) });
    
    if (!user || !user.isAdmin) return null;
    
    return { id: String(user._id), email: user.email, isAdmin: true };
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
