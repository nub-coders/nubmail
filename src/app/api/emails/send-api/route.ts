import { NextRequest, NextResponse } from 'next/server';
import { getUserFromApiKey } from '@/lib/api-keys';
import { sendSmtpEmail } from '@/utils/smtp';
import { pgQuery } from '@/lib/postgres';
import { deliverLocal } from '@/utils/local-delivery';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

// API-key based send endpoint
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = rateLimit(`email-send-api:${ip}`, 60, 15 * 60 * 1000);
    if (rl.limited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } });
    }

    const apiUser = await getUserFromApiKey(req);
    if (!apiUser) return NextResponse.json({ error: 'Unauthorized (API key required)' }, { status: 401 });

    const { rows: ownerRows } = await pgQuery<{ email_verified: boolean | null; is_admin: boolean | null }>(
      'SELECT email_verified, is_admin FROM users WHERE id = $1',
      [apiUser.id]
    );
    const owner = ownerRows[0];
    if (!owner) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!owner.is_admin && !owner.email_verified) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

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

    const allRecipients = Array.isArray(to) ? to : [to];
    const messageBody = html || text || '';

    const { localRecipients, externalRecipients } = await deliverLocal({
      recipients: allRecipients,
      sender: String(from).toLowerCase(),
      subject,
      body: messageBody,
    });

    let result = { messageId: undefined as string | undefined, accepted: localRecipients as string[], rejected: [] as string[] };

    if (externalRecipients.length > 0) {
      const smtpResult = await sendSmtpEmail({
        from,
        to: externalRecipients,
        subject,
        text: text || html?.replace(/<[^>]*>/g, ''),
        html: html || text?.replace(/\n/g, '<br>'),
        smtpConfig,
      });
      result = {
        messageId: smtpResult.messageId,
        accepted: [...localRecipients, ...smtpResult.accepted],
        rejected: smtpResult.rejected,
      };
    }

    const now = new Date();
    await pgQuery(
      `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, user_id, read)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        String(from).toLowerCase(),
        allRecipients,
        subject,
        messageBody,
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
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
