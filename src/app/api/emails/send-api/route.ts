import { NextRequest, NextResponse } from 'next/server';
import { getUserFromApiKey } from '@/lib/api-keys';
import { sendSmtpEmail } from '@/utils/smtp';
import { pgQuery } from '@/lib/postgres';

// API-key based send endpoint
export async function POST(req: NextRequest) {
  try {
    const apiUser = await getUserFromApiKey(req);
    if (!apiUser) return NextResponse.json({ error: 'Unauthorized (API key required)' }, { status: 401 });

    const body = await req.json();
    const { to, subject, text, html, from } = body;
    if (!from || !to || !subject || (!text && !html)) {
      return NextResponse.json({ error: 'Required: from, to, subject, and text or html' }, { status: 400 });
    }

    // Validate sender ownership
    const { rows } = await pgQuery(
      `SELECT email_address AS "emailAddress", smtp_host AS "smtpHost", smtp_port AS "smtpPort",
              smtp_user AS "smtpUser", smtp_pass AS "smtpPass", use_built_in_smtp AS "useBuiltInSmtp"
       FROM email_accounts WHERE email_address = $1 AND user_id = $2`,
      [String(from).toLowerCase(), apiUser.id]
    );
    const ownedFrom = rows[0];
    if (!ownedFrom) return NextResponse.json({ error: 'Sender not owned by API key user' }, { status: 403 });

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
        return NextResponse.json({ error: 'SMTP credentials incomplete.' }, { status: 400 });
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
      smtpConfig,
    });

    const now = new Date();
    await pgQuery(
      `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, user_id, read)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        String(from).toLowerCase(),
        Array.isArray(to) ? to : [to],
        subject,
        html || text,
        now,
        apiUser.id,
        false,
      ]
    );

    return NextResponse.json({
      message: 'Email sent',
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    });
  } catch (err: any) {
    console.error('API send error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
