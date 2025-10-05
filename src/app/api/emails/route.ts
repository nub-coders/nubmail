import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'inbox';

    const db = await getDb();
    const users = db.collection('users');
    const { ObjectId } = await import('mongodb');
    
    const user = await users.findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const emailMessages = db.collection('emailMessages');
    let query: any = {};
    
    if (folder === 'inbox') {
      query.recipients = { $in: [user.email] };
    } else if (folder === 'sent') {
      query.sender = user.email;
    } else {
      query.recipients = { $in: [user.email] };
    }

    const emails = await emailMessages
      .find(query)
      .sort({ sentAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      emails: emails.map(e => ({
        id: String(e._id),
        sender: e.sender,
        recipients: e.recipients,
        subject: e.subject,
        body: e.body,
        sentAt: e.sentAt,
        read: e.read || false
      }))
    });
  } catch (err) {
    console.error('Emails GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { emailId, read } = body;

    if (!emailId || typeof read !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const { ObjectId } = await import('mongodb');
    
    const user = await users.findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const emailMessages = db.collection('emailMessages');
    
    const email = await emailMessages.findOne({ _id: new ObjectId(emailId) });
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const isRecipient = email.recipients && email.recipients.includes(user.email);
    const isSender = email.sender === user.email;

    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await emailMessages.updateOne(
      { _id: new ObjectId(emailId) },
      { $set: { read } }
    );

    return NextResponse.json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Email PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
