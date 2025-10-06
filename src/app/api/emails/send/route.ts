import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { getDb } from '@/lib/mongodb';
import { sendSmtpEmail } from '@/utils/smtp';

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { to, subject, text, html, from } = body;
    
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, and message body' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const accounts = db.collection('emailAccounts');
    const user = await users.findOne({ _id: new (await import('mongodb')).ObjectId(payload.sub) });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!from) {
      return NextResponse.json({ error: 'Please select a sender account (from).' }, { status: 400 });
    }

    const ownedFrom = await accounts.findOne({
      emailAddress: String(from).toLowerCase(),
      userId: payload.sub,
    });
    if (!ownedFrom) {
      return NextResponse.json({ error: 'Invalid sender account.' }, { status: 403 });
    }

    if (!ownedFrom.smtpHost || !ownedFrom.smtpPort || !ownedFrom.smtpUser || !ownedFrom.smtpPass) {
      return NextResponse.json({ error: 'SMTP credentials not configured for this account.' }, { status: 400 });
    }

    const result = await sendSmtpEmail({
      from,
      to,
      subject,
      text: text || html?.replace(/<[^>]*>/g, ''),
      html: html || text?.replace(/\n/g, '<br>'),
      smtpConfig: {
        host: ownedFrom.smtpHost,
        port: ownedFrom.smtpPort,
        user: ownedFrom.smtpUser,
        pass: ownedFrom.smtpPass,
      }
    });

    const emailMessages = db.collection('emailMessages');
    const now = new Date();
    await emailMessages.insertOne({
      sender: String(from).toLowerCase(),
      recipients: Array.isArray(to) ? to : [to],
      subject,
      body: html || text,
      sentAt: now,
      userId: payload.sub,
      read: false
    });

    return NextResponse.json({ 
      message: 'Email sent successfully',
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    });
  } catch (err: any) {
    console.error('Send email error', err);
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 });
  }
}
