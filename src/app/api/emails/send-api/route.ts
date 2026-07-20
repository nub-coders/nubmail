import { NextRequest, NextResponse } from 'next/server';
import { getUserFromApiKey } from '@/lib/api-keys';
import { sendSmtpEmail } from '@/utils/smtp';
import { pgQuery } from '@/lib/postgres';
import { decryptField, isEncryptedField } from '@/lib/field-encryption';
import { deliverLocal } from '@/utils/local-delivery';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { sanitizeOutboundHtml } from '@/lib/email-body';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = rateLimit(`email-send-api:${ip}`, 60, 15 * 60 * 1000);
    if (rl.limited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } });
    }

    const apiUser = await getUserFromApiKey(req);
    if (!apiUser) return NextResponse.json({ error: 'Unauthorized (API key required)' }, { status: 401 });

    if (!apiUser.permissions.includes('send')) {
      return NextResponse.json({ error: 'This API key does not have send permission' }, { status: 403 });
    }

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

    let accountQuery = `SELECT ea.id, ea.email_address AS "emailAddress", ea.smtp_host AS "smtpHost", ea.smtp_port AS "smtpPort",
            ea.smtp_user AS "smtpUser", ea.smtp_pass AS "smtpPass", ea.use_built_in_smtp AS "useBuiltInSmtp"
     FROM email_accounts ea WHERE ea.email_address = $1 AND ea.user_id = $2`;
    const accountParams: any[] = [String(from).toLowerCase(), apiUser.id];

    if (apiUser.scopedAccountIds.length > 0) {
      accountQuery += ' AND ea.id = ANY($3)';
      accountParams.push(apiUser.scopedAccountIds);
    }

    const { rows } = await pgQuery(accountQuery, accountParams);
    let ownedFrom = rows[0];
    const senderDomain = String(from).toLowerCase().split('@')[1];

    if (!ownedFrom) {
      if (apiUser.scopedAccountIds.length > 0) {
        return NextResponse.json({ error: 'Sender not owned by API key user or not in API key scope' }, { status: 403 });
      }

      if (!senderDomain) {
        return NextResponse.json({ error: 'Invalid sender email address format' }, { status: 400 });
      }

      const { rows: domainRows } = await pgQuery<{ id: string; verification_status: string }>(
        'SELECT id, verification_status FROM domains WHERE LOWER(domain_name) = $1 AND user_id = $2',
        [senderDomain, apiUser.id]
      );
      const targetDomain = domainRows[0];

      if (!owner.is_admin) {
        if (!targetDomain || targetDomain.verification_status !== 'verified') {
          return NextResponse.json({ error: 'Sender domain not verified or not owned by user' }, { status: 403 });
        }
      }

      if (targetDomain?.id) {
        await pgQuery(
          `INSERT INTO email_accounts (email_address, storage_quota, domain_id, user_id, use_built_in_smtp)
           VALUES ($1, 1024, $2, $3, true)
           ON CONFLICT (email_address) DO NOTHING`,
          [String(from).toLowerCase(), targetDomain.id, apiUser.id]
        ).catch(() => {});
      }

      ownedFrom = { useBuiltInSmtp: true };
    }

    if (apiUser.scopedDomainIds.length > 0) {
      if (!senderDomain) {
        return NextResponse.json({ error: 'Invalid sender email address format' }, { status: 400 });
      }
      const { rows: domainRows } = await pgQuery<{ id: string }>(
        'SELECT id FROM domains WHERE id = ANY($1) AND domain_name = $2',
        [apiUser.scopedDomainIds, senderDomain]
      );
      if (domainRows.length === 0) {
        return NextResponse.json({ error: 'Sender domain not in API key scope' }, { status: 403 });
      }
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
        return NextResponse.json({ error: 'SMTP credentials incomplete.' }, { status: 400 });
      }
      smtpConfig = {
        host: ownedFrom.smtpHost,
        port: ownedFrom.smtpPort,
        user: ownedFrom.smtpUser,
        pass: isEncryptedField(ownedFrom.smtpPass) ? decryptField(ownedFrom.smtpPass) : ownedFrom.smtpPass,
      };
    }

    const allRecipients = Array.isArray(to) ? to : [to];
    const sanitizedHtml = typeof html === 'string' && html.trim().length > 0
      ? sanitizeOutboundHtml(html)
      : '';
    const messageBody = sanitizedHtml || text || '';

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
