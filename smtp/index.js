// Minimal SMTP receiver that parses inbound messages and stores them in PostgreSQL and Maildir
// Uses smtp-server and mailparser. Intended to run as a sidecar service.

const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const { Pool } = require('pg');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 25; // container port
const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('FATAL: POSTGRES_URL must be set');
  process.exit(1);
}
const MAILDIR_BASE = process.env.MAILDIR_BASE || '/app/maildata';
const SMTP_BANNER_HOST = process.env.SMTP_BANNER_HOST || 'mails.nubcoder.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';
const INBOUND_ALLOWED_DOMAINS = new Set(
  String(process.env.INBOUND_ALLOWED_DOMAINS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
);

function isInboundDomainAllowed(domain) {
  // If no allowlist is configured, rely on verified-domain account checks.
  if (INBOUND_ALLOWED_DOMAINS.size === 0) return true;
  return INBOUND_ALLOWED_DOMAINS.has(domain);
}

let pgPool;
function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: POSTGRES_URL, max: 10 });
  }
  return pgPool;
}

let pushConfigured = false;
let pushChecked = false;

function ensurePushConfigured() {
  if (pushChecked) return pushConfigured;
  pushChecked = true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    pushConfigured = false;
    return pushConfigured;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushConfigured = true;
  return pushConfigured;
}

function truncate(input, max = 96) {
  if (!input || input.length <= max) return input || '';
  return `${input.slice(0, max - 1)}...`;
}

async function sendPushForMessage(pool, { userId, sender, subject, emailId, recipient }) {
  if (!ensurePushConfigured()) return;

  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
      WHERE user_id = $1`,
    [userId]
  );

  if (!rows || rows.length === 0) return;

  const payload = JSON.stringify({
    title: 'New email received',
    body: `${truncate(sender, 48)}${subject ? `: ${truncate(subject, 88)}` : ''}`,
    tag: `email-${emailId}`,
    url: `/dashboard/inbox/${emailId}`,
    data: {
      emailId,
      recipient,
      sender,
    },
  });

  const staleEndpoints = [];

  await Promise.all(rows.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
        { TTL: 60 }
      );
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) {
        staleEndpoints.push(sub.endpoint);
        return;
      }
      console.warn('SMTP push send failed', { userId, endpoint: sub.endpoint, code });
    }
  }));

  if (staleEndpoints.length > 0) {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = ANY($2::text[])',
      [userId, staleEndpoints]
    );
  }
}

function extractAddresses(addressObject) {
  if (!addressObject || !Array.isArray(addressObject.value)) return [];
  return addressObject.value
    .map((addr) => (addr && addr.address ? String(addr.address).toLowerCase() : null))
    .filter(Boolean);
}

// Write email to Maildir. Prefer raw RFC822 source so IMAP clients render correctly.
async function writeToMaildir(emailAddress, rawMessage, subject, body, sentAt, sender, recipients, messageId) {
  try {
    // Use the raw email address so IMAP and SMTP agree on the mailbox path.
    const safeEmailName = emailAddress.toLowerCase();
    const maildirPath = path.join(MAILDIR_BASE, safeEmailName, 'Maildir', 'new');
    
    // Create Maildir structure if it doesn't exist
    fs.mkdirSync(maildirPath, { recursive: true });
    
    // Create unique filename
    const timestamp = Date.now();
    const filename = path.join(maildirPath, `${messageId || timestamp}-${timestamp}`);
    
    const fallbackContent = [
      `From: ${sender}`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${subject}`,
      `Date: ${sentAt.toUTCString()}`,
      `Message-ID: <${messageId || timestamp}@nubmail>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body
    ].join('\r\n');

    fs.writeFileSync(filename, rawMessage && rawMessage.length ? rawMessage : fallbackContent);
    console.log(`Wrote email to Maildir: ${filename}`);
    return true;
  } catch (err) {
    console.error(`Error writing to Maildir for ${emailAddress}:`, err);
    return false;
  }
}

const server = new SMTPServer({
  name: SMTP_BANNER_HOST,
  banner: `${SMTP_BANNER_HOST} ESMTP`,
  // We accept unauthenticated inbound from the internet (MX). Do not enable auth here.
  disabledCommands: ['AUTH'],
  logger: false,
  onRcptTo(address, session, callback) {
    (async () => {
      try {
        const rcpt = (address && address.address ? String(address.address) : '').toLowerCase().trim();
        if (!rcpt || !rcpt.includes('@')) {
          return callback(new Error('550 5.1.3 Bad recipient address syntax'));
        }

        const domain = rcpt.split('@')[1];
        if (!isInboundDomainAllowed(domain)) {
          return callback(new Error('550 5.7.1 Relaying denied'));
        }

        const pool = getPgPool();
        const { rowCount } = await pool.query(
          `SELECT 1
             FROM email_accounts ea
             JOIN domains d ON d.id = ea.domain_id
            WHERE lower(ea.email_address) = $1
              AND lower(d.domain_name) = $2
              AND d.verification_status = 'verified'
            LIMIT 1`,
          [rcpt, domain]
        );

        if (!rowCount) {
          return callback(new Error('550 5.1.1 Recipient address rejected: User unknown in local recipient table'));
        }

        return callback();
      } catch (err) {
        console.error('SMTP onRcptTo error:', err);
        return callback(new Error('451 4.3.0 Temporary lookup failure'));
      }
    })();
  },
  onConnect(session, callback) {
    // Optionally restrict by IPs or use a blocklist here.
    return callback();
  },
  onData(stream, session, callback) {
    (async () => {
      try {
        const rawChunks = [];
        for await (const chunk of stream) {
          rawChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const rawMessage = Buffer.concat(rawChunks);
        const parsed = await simpleParser(rawMessage);

        const fromAddresses = extractAddresses(parsed.from);
        const toAddresses = extractAddresses(parsed.to).concat(extractAddresses(parsed.cc)).concat(extractAddresses(parsed.bcc));

        const sender = fromAddresses[0] || (parsed.from && parsed.from.text) || 'unknown@unknown';
        const recipients = Array.from(new Set(toAddresses));

        const subject = parsed.subject || '';
        let html = parsed.html ? (typeof parsed.html === 'string' ? parsed.html : String(parsed.html)) : undefined;
        const text = parsed.text || (html ? '' : '');

        // If the message has attachments with CIDs, replace cid: references in the
        // HTML with data URLs so web clients can render inline images.
        if (html && Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
          for (const att of parsed.attachments) {
            try {
              const cid = att.cid;
              if (!cid || !att.content) continue;
              const contentType = att.contentType || 'application/octet-stream';
              const b64 = Buffer.isBuffer(att.content) ? att.content.toString('base64') : Buffer.from(String(att.content)).toString('base64');
              const dataUrl = `data:${contentType};base64,${b64}`;
              // Replace both cid:cid and cid:<cid> usages
              const cidVariants = [cid, `<${cid}>`].filter(Boolean);
              for (const v of cidVariants) {
                const re = new RegExp(`cid:${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
                html = html.replace(re, dataUrl);
              }
            } catch (err) {
              console.warn('Failed to inline attachment cid', err);
              continue;
            }
          }
        }

        const body = html || text || '';
        const sentAt = parsed.date ? new Date(parsed.date) : new Date();

        const pool = getPgPool();
        // Find matching accounts for recipients
        const recips = recipients.length > 0 ? recipients : [];
        let inserted = 0;
        if (recips.length > 0) {
          const { rows } = await pool.query(
            'SELECT email_address, user_id FROM email_accounts WHERE email_address = ANY($1::text[])',
            [recips]
          );
          const addressToUser = new Map(rows.map(r => [String(r.email_address).toLowerCase(), r.user_id]));
          for (const rcpt of recips) {
            const uid = addressToUser.get(String(rcpt).toLowerCase()) || null;
            if (uid) {
              const result = await pool.query(
                `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, user_id, read)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [sender, [rcpt], subject, body, sentAt, uid, false]
              );
              inserted++;

              const messageId = result.rows[0]?.id || null;

              await sendPushForMessage(pool, {
                userId: uid,
                sender,
                subject,
                emailId: messageId,
                recipient: rcpt,
              });
              
              // Write to Maildir for IMAP/POP3 access
              await writeToMaildir(rcpt, rawMessage, subject, body, sentAt, sender, [rcpt], messageId);
            }
          }
        }
        // If no specific user matched, store a single unassigned message
        if (inserted === 0) {
          await pool.query(
            `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, read)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sender, recips, subject, body, sentAt, false]
          );
        }

        callback();
      } catch (err) {
        console.error('SMTP onData error:', err);
        callback(err);
      }
    })();
  },
});

server.on('error', (err) => {
  console.error('SMTP server error:', err);
});

server.listen(SMTP_PORT, '0.0.0.0', () => {
  console.log(`SMTP server listening on 0.0.0.0:${SMTP_PORT}`);
});

process.on('SIGTERM', async () => {
  try {
    await server.close();
  } catch {}
  try {
    if (pgPool) await pgPool.end();
  } catch {}
  process.exit(0);
});


