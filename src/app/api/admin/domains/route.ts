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
    const domains = db.collection('domains');
    const users = db.collection('users');
    
    const allDomains = await domains.find({}).sort({ createdAt: -1 }).toArray();

    const domainsWithUsers = await Promise.all(
      allDomains.map(async (domain) => {
        const user = await users.findOne({ _id: new ObjectId(domain.userId) });
        return {
          id: String(domain._id),
          domainName: domain.domainName,
          verificationStatus: domain.verificationStatus,
          createdAt: domain.createdAt,
          userId: domain.userId,
          userEmail: user?.email || 'Unknown'
        };
      })
    );

    return NextResponse.json({ domains: domainsWithUsers });
  } catch (err) {
    console.error('Admin domains GET error', err);
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
    const domainId = url.searchParams.get('domainId');
    
    if (!domainId) {
      return NextResponse.json({ error: 'domainId required' }, { status: 400 });
    }

    const db = await getDb();
    const domains = db.collection('domains');
    
    const result = await domains.deleteOne({ _id: new ObjectId(domainId) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    await db.collection('emailAccounts').deleteMany({ domainId });

    return NextResponse.json({ message: 'Domain deleted successfully' });
  } catch (err) {
    console.error('Admin domains DELETE error', err);
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
    const { domainId, verificationStatus } = body;

    if (!domainId) {
      return NextResponse.json({ error: 'domainId required' }, { status: 400 });
    }

    if (!verificationStatus || !['pending', 'verified', 'failed'].includes(verificationStatus)) {
      return NextResponse.json({ error: 'Invalid verificationStatus' }, { status: 400 });
    }

    const db = await getDb();
    const domains = db.collection('domains');

    const result = await domains.updateOne(
      { _id: new ObjectId(domainId) },
      { $set: { verificationStatus } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Domain updated successfully' });
  } catch (err) {
    console.error('Admin domains PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
