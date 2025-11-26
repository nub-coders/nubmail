// Minimal SMTP receiver that parses inbound messages and stores them in PostgreSQL and Maildir
// Uses smtp-server and mailparser. Intended to run as a sidecar service.

const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 25; // container port
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://nubmail:nubmail@postgres:5432/nubmail';
const MAILDIR_BASE = process.env.MAILDIR_BASE || '/app/maildata';

let pgPool;
function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: POSTGRES_URL, max: 10 });
  }
  return pgPool;
}

function extractAddresses(addressObject) {
  if (!addressObject || !Array.isArray(addressObject.value)) return [];
  return addressObject.value
    .map((addr) => (addr && addr.address ? String(addr.address).toLowerCase() : null))
    .filter(Boolean);
}

// Write email to Maildir format
async function writeToMaildir(emailAddress, subject, body, sentAt, sender, recipients, messageId) {
  try {
    // Use full email address with @ replaced by _at_ to avoid conflicts
    const safeEmailName = emailAddress.replace('@', '_at_');
    const maildirPath = path.join(MAILDIR_BASE, safeEmailName, 'Maildir', 'new');
    
    // Create Maildir structure if it doesn't exist
    fs.mkdirSync(maildirPath, { recursive: true });
    
    // Create unique filename
    const timestamp = Date.now();
    const filename = path.join(maildirPath, `${messageId || timestamp}-${timestamp}`);
    
    // Format email message in RFC 5322 format
    const emailContent = [
      `From: ${sender}`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${subject}`,
      `Date: ${sentAt.toUTCString()}`,
      `Message-ID: <${messageId || timestamp}@nubmail>`,
      '',
      body
    ].join('\n');
    
    fs.writeFileSync(filename, emailContent);
    console.log(`Wrote email to Maildir: ${filename}`);
    return true;
  } catch (err) {
    console.error(`Error writing to Maildir for ${emailAddress}:`, err);
    return false;
  }
}

const server = new SMTPServer({
  // We accept unauthenticated inbound from the internet (MX). Do not enable auth here.
  disabledCommands: ['AUTH'],
  logger: false,
  onConnect(session, callback) {
    // Optionally restrict by IPs or use a blocklist here.
    return callback();
  },
  onData(stream, session, callback) {
    (async () => {
      try {
        const parsed = await simpleParser(stream);

        const fromAddresses = extractAddresses(parsed.from);
        const toAddresses = extractAddresses(parsed.to).concat(extractAddresses(parsed.cc)).concat(extractAddresses(parsed.bcc));

        const sender = fromAddresses[0] || (parsed.from && parsed.from.text) || 'unknown@unknown';
        const recipients = Array.from(new Set(toAddresses));

        const subject = parsed.subject || '';
        const html = parsed.html ? (typeof parsed.html === 'string' ? parsed.html : String(parsed.html)) : undefined;
        const text = parsed.text || (html ? '' : '');
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
              
              // Write to Maildir for IMAP/POP3 access
              const messageId = result.rows[0]?.id || null;
              await writeToMaildir(rcpt, subject, body, sentAt, sender, [rcpt], messageId);
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


