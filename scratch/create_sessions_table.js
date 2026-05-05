const { Pool } = require('pg');
require('dotenv').config();

// Use localhost instead of 'postgres' hostname because we are running outside of the docker network
const connectionString = 'postgres://nubmail:nubmail@127.0.0.1:5432/nubmail';

const pool = new Pool({
  connectionString: connectionString
});

async function main() {
  console.log('Creating sessions table...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT,
        is_active BOOLEAN DEFAULT TRUE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
    console.log('Sessions table created successfully.');
  } catch (err) {
    console.error('Error creating sessions table:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main();
