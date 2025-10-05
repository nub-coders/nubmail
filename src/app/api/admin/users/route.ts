import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAdminFromToken } from '@/lib/admin';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const allUsers = await users.find({}).sort({ createdAt: -1 }).toArray();

    const usersList = allUsers.map(u => ({
      id: String(u._id),
      email: u.email,
      fullName: u.fullName,
      emailVerified: !!u.emailVerified,
      isAdmin: !!u.isAdmin,
      createdAt: u.createdAt
    }));

    return NextResponse.json({ users: usersList });
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

    const db = await getDb();
    const users = db.collection('users');
    
    const result = await users.deleteOne({ _id: new ObjectId(userId) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await db.collection('domains').deleteMany({ userId });
    await db.collection('emailAccounts').deleteMany({ userId });
    await db.collection('emailMessages').deleteMany({ userId });

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

    const db = await getDb();
    const users = db.collection('users');

    const update: any = {};
    if (typeof newIsAdmin === 'boolean') update.isAdmin = newIsAdmin;
    if (typeof emailVerified === 'boolean') update.emailVerified = emailVerified;

    const result = await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Admin users PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
