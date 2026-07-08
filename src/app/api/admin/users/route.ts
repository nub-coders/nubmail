import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { getAdminFromToken } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { rows } = await pgQuery(
      `SELECT id, email, full_name AS "fullName", email_verified AS "emailVerified", 
              is_admin AS "isAdmin", created_at AS "createdAt"
       FROM users ORDER BY created_at DESC`
    );

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error('Admin users GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    if (userId === admin.id) {
      return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 });
    }

    const { rowCount } = await pgQuery('DELETE FROM users WHERE id = $1', [userId]);
    
    if (rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Admin users DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isAdmin: newIsAdmin, emailVerified } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    if (userId === admin.id && newIsAdmin === false) {
      return NextResponse.json({ error: 'Cannot remove admin status from your own account' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof newIsAdmin === 'boolean') {
      updates.push(`is_admin = $${paramIndex++}`);
      values.push(newIsAdmin);
    }
    if (typeof emailVerified === 'boolean') {
      updates.push(`email_verified = $${paramIndex++}`);
      values.push(emailVerified);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    values.push(userId);
    const { rowCount } = await pgQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Admin users PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
