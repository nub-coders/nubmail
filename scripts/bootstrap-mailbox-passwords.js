const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');

function parseArgs(argv) {
  const opts = {
    onlyMissing: true,
    dryRun: false,
    length: 16,
    out: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') opts.onlyMissing = false;
    else if (arg === '--only-missing') opts.onlyMissing = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--length') {
      const n = Number(argv[i + 1]);
      if (!Number.isInteger(n) || n < 8) throw new Error('--length must be an integer >= 8');
      opts.length = n;
      i += 1;
    } else if (arg === '--out') {
      const p = argv[i + 1];
      if (!p) throw new Error('--out requires a file path');
      opts.out = p;
      i += 1;
    }
  }

  return opts;
}

function generateStrongPassword(length) {
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '@#$%*+-_=!';
  const all = lowers + uppers + digits + symbols;

  const required = [
    lowers[crypto.randomInt(lowers.length)],
    uppers[crypto.randomInt(uppers.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  const chars = [...required];
  for (let i = chars.length; i < length; i += 1) {
    chars.push(all[crypto.randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgres://nubmail:nubmail@postgres:5432/nubmail';

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query(
      'SELECT id, email_address, password_hash FROM email_accounts ORDER BY email_address ASC'
    );

    if (!rows.length) {
      console.log('[bootstrap-mailbox-passwords] No email accounts found.');
      return;
    }

    const targets = opts.onlyMissing
      ? rows.filter((r) => !r.password_hash)
      : rows;

    if (!targets.length) {
      console.log('[bootstrap-mailbox-passwords] No target accounts (all already have password_hash).');
      return;
    }

    const generated = [];

    for (const account of targets) {
      const plain = generateStrongPassword(opts.length);
      const hash = await bcrypt.hash(plain, 10);

      if (!opts.dryRun) {
        await client.query('UPDATE email_accounts SET password_hash = $1 WHERE id = $2', [hash, account.id]);
      }

      generated.push({ email: account.email_address, password: plain });
    }

    const lines = [
      '# Mailbox Password Bootstrap Output',
      `# Generated at: ${new Date().toISOString()}`,
      `# Updated accounts: ${generated.length}`,
      '',
      ...generated.map((g) => `${g.email},${g.password}`),
      '',
      '# Use each password as IMAP/POP3/SMTP auth password for that mailbox.',
    ];

    const output = lines.join('\n');

    console.log(output);

    if (opts.out) {
      fs.writeFileSync(opts.out, output, { mode: 0o600 });
      console.log(`\n[bootstrap-mailbox-passwords] Wrote credentials to ${opts.out}`);
    }

    if (opts.dryRun) {
      console.log('\n[bootstrap-mailbox-passwords] Dry run only. No DB changes were made.');
    } else {
      console.log('\n[bootstrap-mailbox-passwords] Password hashes updated successfully.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[bootstrap-mailbox-passwords] Error:', err.message);
  process.exit(1);
});
