import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const accounts = db.collection('emailAccounts');
    const docs = await accounts.find({ userId: payload.sub }).sort({ createdAt: -1 }).toArray();
    
    return NextResponse.json({
      accounts: docs.map(a => ({
        id: String(a._id),
        emailAddress: a.emailAddress,
        storageQuota: a.storageQuota || 0,
        domainId: a.domainId,
        smtpHost: a.smtpHost,
        smtpPort: a.smtpPort,
        smtpUser: a.smtpUser,
        createdAt: a.createdAt
      }))
    });
  } catch (err) {
    console.error('Accounts GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { emailAddress, domainId, smtpHost, smtpPort, smtpUser, smtpPass } = body;
    
    if (!emailAddress || !domainId) {
      return NextResponse.json({ error: 'emailAddress and domainId required' }, { status: 400 });
    }

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'SMTP credentials required (host, port, user, pass)' }, { status: 400 });
    }

    const db = await getDb();
    const domains = db.collection('domains');
    const { ObjectId } = await import('mongodb');
    
    const domain = await domains.findOne({
      _id: new ObjectId(domainId),
      userId: payload.sub,
      verificationStatus: 'verified'
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found or not verified' }, { status: 404 });
    }

    const accounts = db.collection('emailAccounts');
    const existing = await accounts.findOne({ emailAddress: emailAddress.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'Email account already exists' }, { status: 409 });
    }

    const now = new Date();
    const result = await accounts.insertOne({
      emailAddress: emailAddress.toLowerCase(),
      storageQuota: 1024,
      domainId,
      userId: payload.sub,
      smtpHost,
      smtpPort: Number(smtpPort),
      smtpUser,
      smtpPass,
      createdAt: now
    });

    return NextResponse.json({
      id: String(result.insertedId),
      emailAddress: emailAddress.toLowerCase(),
      storageQuota: 1024,
      domainId,
      smtpHost,
      smtpPort: Number(smtpPort),
      smtpUser,
      createdAt: now
    });
  } catch (err) {
    console.error('Accounts POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const accountId = url.searchParams.get('id');
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const db = await getDb();
    const accounts = db.collection('emailAccounts');
    const { ObjectId } = await import('mongodb');
    
    const result = await accounts.deleteOne({
      _id: new ObjectId(accountId),
      userId: payload.sub
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
