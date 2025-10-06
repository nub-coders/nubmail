const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminEmail || !adminPass) {
    console.error('ADMIN_EMAIL and ADMIN_PASS environment variables are required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || 'postgres://nubmail:nubmail@postgres:5432/nubmail'
  });

  try {
    await client.connect();
    
    // Check if admin already exists
    const checkResult = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail.toLowerCase()]);
    
    if (checkResult.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPass, 10);

    // Insert admin user
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, is_admin)
      VALUES ($1, $2, $3, true)
    `, [adminEmail.toLowerCase(), hashedPassword, 'Admin User']);

    console.log('Admin user created successfully');

  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initAdmin();
