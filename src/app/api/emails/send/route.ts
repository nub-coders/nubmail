import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { getDb } from '@/lib/mongodb';
import { sendSmtpEmail } from '@/utils/smtp';
import { pgQuery, usePostgres } from '@/lib/postgres';

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { to, subject, text, html, from } = body;
    
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, and message body' }, { status: 400 });
    }

    if (usePostgres()) {
      const u = await pgQuery('SELECT 1 FROM users WHERE id = $1', [payload.sub]);
      if (u.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    } else {
      const db = await getDb();
      const users = db.collection('users');
      const user = await users.findOne(
        { _id: new (await import('mongodb')).ObjectId(payload.sub) },
        { projection: { _id: 1 } }
      );
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    if (!from) {
      return NextResponse.json({ error: 'Please select a sender account (from).' }, { status: 400 });
    }

    let ownedFrom: any = null;
    if (usePostgres()) {
      const { rows } = await pgQuery(
        `SELECT email_address AS "emailAddress", smtp_host AS "smtpHost", smtp_port AS "smtpPort",
                smtp_user AS "smtpUser", smtp_pass AS "smtpPass", use_built_in_smtp AS "useBuiltInSmtp"
         FROM email_accounts WHERE email_address = $1 AND user_id = $2`,
        [String(from).toLowerCase(), payload.sub]
      );
      ownedFrom = rows[0];
    } else {
      const db = await getDb();
      const accounts = db.collection('emailAccounts');
      ownedFrom = await accounts.findOne(
        {
          emailAddress: String(from).toLowerCase(),
          userId: payload.sub,
        },
        { projection: { smtpHost: 1, smtpPort: 1, smtpUser: 1, smtpPass: 1, useBuiltInSmtp: 1 } }
      );
    }
    if (!ownedFrom) {
      return NextResponse.json({ error: 'Invalid sender account.' }, { status: 403 });
    }

    let smtpConfig;
    
    if (ownedFrom.useBuiltInSmtp) {
      smtpConfig = {
        host: process.env.INTERNAL_SMTP_HOST || 'smtp-sender',
        port: Number(process.env.INTERNAL_SMTP_PORT || 587),
        user: '',
        pass: '',
      };
    } else {
      if (!ownedFrom.smtpHost || !ownedFrom.smtpPort || !ownedFrom.smtpUser || !ownedFrom.smtpPass) {
        return NextResponse.json({ error: 'SMTP credentials not configured for this account.' }, { status: 400 });
      }
      smtpConfig = {
        host: ownedFrom.smtpHost,
        port: ownedFrom.smtpPort,
        user: ownedFrom.smtpUser,
        pass: ownedFrom.smtpPass,
      };
    }

    const result = await sendSmtpEmail({
      from,
      to,
      subject,
      text: text || html?.replace(/<[^>]*>/g, ''),
      html: html || text?.replace(/\n/g, '<br>'),
      smtpConfig
    });

    const now = new Date();
    if (usePostgres()) {
      await pgQuery(
        `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, user_id, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          String(from).toLowerCase(),
          Array.isArray(to) ? to : [to],
          subject,
          html || text,
          now,
          payload.sub,
          false
        ]
      );
    } else {
      const db = await getDb();
      const emailMessages = db.collection('emailMessages');
      await emailMessages.insertOne({
        sender: String(from).toLowerCase(),
        recipients: Array.isArray(to) ? to : [to],
        subject,
        body: html || text,
        sentAt: now,
        userId: payload.sub,
        read: false
      });
    }

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
