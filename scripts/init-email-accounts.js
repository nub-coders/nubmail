const { Client } = require('pg');

async function initEmailAccounts() {
  const domain = process.env.DOMAIN;
  
  if (!domain) {
    console.log('[init-email-accounts] No DOMAIN environment variable set, skipping email account creation');
    return;
  }

  // Extract base domain (remove port if present)
  const baseDomain = domain.split(':')[0];
  
  console.log(`[init-email-accounts] Setting up email accounts for domain: ${baseDomain}`);

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || 'postgres://nubmail:nubmail@postgres:5432/nubmail'
  });

  try {
    await client.connect();
    console.log('[init-email-accounts] Connected to PostgreSQL');

    // Ensure email_accounts table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id SERIAL PRIMARY KEY,
        email_address TEXT UNIQUE NOT NULL,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        use_built_in_smtp BOOLEAN DEFAULT true,
        user_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create verify@ and test@ email accounts
    const emailAccounts = [
      `verify@${baseDomain}`,
      `test@${baseDomain}`
    ];

    for (const emailAddress of emailAccounts) {
      // Check if account already exists
      const existingAccount = await client.query(
        'SELECT id FROM email_accounts WHERE email_address = $1',
        [emailAddress]
      );

      if (existingAccount.rows.length === 0) {
        // Create new email account
        await client.query(`
          INSERT INTO email_accounts (
            email_address, 
            use_built_in_smtp, 
            smtp_host, 
            smtp_port, 
            smtp_user, 
            smtp_pass
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          emailAddress,
          true, // use built-in SMTP
          null, // smtp_host (null for built-in)
          null, // smtp_port (null for built-in)
          null, // smtp_user (null for built-in)
          null  // smtp_pass (null for built-in)
        ]);

        console.log(`[init-email-accounts] Created email account: ${emailAddress}`);
      } else {
        console.log(`[init-email-accounts] Email account already exists: ${emailAddress}`);
      }
    }

    console.log('[init-email-accounts] Email accounts initialization completed');

  } catch (error) {
    console.error('[init-email-accounts] Error:', error.message);
  } finally {
    await client.end();
  }
}

// Run the initialization
initEmailAccounts().catch(console.error);
