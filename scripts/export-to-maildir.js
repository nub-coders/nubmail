// Export emails from PostgreSQL to Maildir for all users
// Usage: node scripts/export-to-maildir.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://nubmail:nubmail@localhost:5432/nubmail';
const MAILDIR_BASE = process.env.MAILDIR_BASE || '/app/maildata'; // Use container-writable directory

async function main() {
  const client = new Client({ connectionString: POSTGRES_URL });
  await client.connect();

  // Get all email accounts (not users)
  const accountsRes = await client.query('SELECT id, email_address, user_id FROM email_accounts');
  for (const account of accountsRes.rows) {
    // Use full email address with @ replaced by _at_ to avoid conflicts
    const safeEmailName = account.email_address.replace('@', '_at_');
    const maildir = path.join(MAILDIR_BASE, safeEmailName, 'Maildir', 'new');
    fs.mkdirSync(maildir, { recursive: true });

    // Get all emails for this email account's user
    const emailsRes = await client.query('SELECT id, subject, body, sent_at FROM email_messages WHERE user_id = $1', [account.user_id]);
    for (const email of emailsRes.rows) {
      const filename = path.join(maildir, `${email.id}-${Date.now()}`);
      const content = `Subject: ${email.subject}\nDate: ${email.sent_at.toUTCString()}\n\n${email.body}`;
      fs.writeFileSync(filename, content);
    }
    console.log(`Exported ${emailsRes.rowCount} emails for ${account.email_address}`);
  }

  await client.end();
  console.log('Export complete.');
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
