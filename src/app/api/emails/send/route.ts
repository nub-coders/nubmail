import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { sendSmtpEmail } from '@/utils/smtp';
import { pgQuery } from '@/lib/postgres';

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { to, subject, text, html, from } = body;
    
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, and message body' }, { status: 400 });
    }

    const u = await pgQuery('SELECT 1 FROM users WHERE id = $1', [payload.sub]);
    if (u.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!from) {
      return NextResponse.json({ error: 'Please select a sender account (from).' }, { status: 400 });
    }

    const { rows } = await pgQuery(
      `SELECT email_address AS "emailAddress", smtp_host AS "smtpHost", smtp_port AS "smtpPort",
              smtp_user AS "smtpUser", smtp_pass AS "smtpPass", use_built_in_smtp AS "useBuiltInSmtp"
       FROM email_accounts WHERE email_address = $1 AND user_id = $2`,
      [String(from).toLowerCase(), payload.sub]
    );
    const ownedFrom = rows[0];

    if (!ownedFrom) {
      return NextResponse.json({ error: 'Invalid sender account.' }, { status: 403 });
    }

  let smtpConfig;
  let dkimConfig: { domainName: string; keySelector: string; privateKey: string } | undefined;

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

    // Per-domain DKIM: attempt to sign with the sender's domain for BOTH built-in and custom SMTP
    try {
      const senderDomain = String(from).split('@')[1]?.toLowerCase();
      if (senderDomain) {
        // Ensure table exists in case migrations haven't created it yet
        await pgQuery(`
          CREATE TABLE IF NOT EXISTS domain_dkim (
            id SERIAL PRIMARY KEY,
            domain_name TEXT UNIQUE NOT NULL,
            selector TEXT NOT NULL,
            public_key TEXT NOT NULL,
            private_key TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);
        let { rows: dkim } = await pgQuery<{ selector: string; private_key: string }>(
          `SELECT selector, private_key FROM domain_dkim WHERE domain_name = $1`,
          [senderDomain]
        );
        if (!dkim[0]) {
          // If the domain belongs to this user, auto-generate a DKIM key on first send
          const domRes = await pgQuery<{ exists: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM domains WHERE domain_name = $1 AND user_id = $2) AS exists`,
            [senderDomain, payload.sub]
          );
          if (domRes.rows[0]?.exists) {
            const { generateKeyPair } = await import('crypto');
            const pair = await new Promise<{ publicKeyPem: string; privateKeyPem: string }>((resolve, reject) => {
              generateKeyPair(
                'rsa',
                { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } },
                (err, pub, priv) => {
                  if (err) return reject(err);
                  resolve({ publicKeyPem: pub, privateKeyPem: priv });
                }
              );
            });
            const selector = 'mail';
            await pgQuery(
              `INSERT INTO domain_dkim(domain_name, selector, public_key, private_key)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (domain_name)
               DO UPDATE SET selector = EXCLUDED.selector, public_key = EXCLUDED.public_key, private_key = EXCLUDED.private_key, created_at = NOW()`,
              [senderDomain, selector, pair.publicKeyPem, pair.privateKeyPem]
            );
            // Re-read
            dkim = (
              await pgQuery<{ selector: string; private_key: string }>(
                `SELECT selector, private_key FROM domain_dkim WHERE domain_name = $1`,
                [senderDomain]
              )
            ).rows;
          }
        }
        if (dkim[0]) {
          dkimConfig = {
            domainName: senderDomain,
            keySelector: dkim[0].selector,
            privateKey: dkim[0].private_key,
          };
        }
      }
    } catch (e) {
      console.warn('DKIM lookup failed, sending without DKIM for this message:', (e as any)?.message || e);
    }

    // Log SMTP config (without sensitive data) for debugging
    console.log('SMTP Config:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      hasAuth: !!(smtpConfig.user && smtpConfig.pass),
      useBuiltIn: ownedFrom.useBuiltInSmtp,
      from,
      to
    });

    const result = await sendSmtpEmail({
      from,
      to,
      subject,
      text: text || html?.replace(/<[^>]*>/g, ''),
      html: html || text?.replace(/\n/g, '<br>'),
      smtpConfig,
      dkim: dkimConfig
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
        payload.sub,
        false
      ]
    );

    return NextResponse.json({ 
      message: 'Email sent successfully',
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    });
  } catch (err: any) {
    console.error('Send email error', err);
    
    // Handle specific SMTP errors
    if (err.code === 'EENVELOPE' && err.response?.includes('554 5.7.1')) {
      return NextResponse.json({ 
        error: 'Email delivery rejected by server. This may be due to SMTP relay restrictions or authentication issues. Please check your SMTP server configuration or try a different email provider.',
        details: err.response 
      }, { status: 500 });
    }
    
    if (err.code === 'EAUTH') {
      return NextResponse.json({ 
        error: 'SMTP authentication failed. Please check your email account credentials.',
        details: err.response 
      }, { status: 500 });
    }
    
    if (err.code === 'ECONNECTION') {
      return NextResponse.json({ 
        error: 'Failed to connect to SMTP server. Please check your server configuration.',
        details: err.response 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: err.message || 'Failed to send email',
      code: err.code,
      details: err.response 
    }, { status: 500 });
  }
}
