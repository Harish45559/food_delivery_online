// backend/src/db/index.js
// Builds DATABASE_URL from DB_* env vars if needed and URL-encodes the password.
// Logs a masked connection string for debugging and chooses SSL mode automatically.

const { Pool } = require('pg');

function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = process.env.DB_USER || 'postgres';
  const pass = process.env.DB_PASSWORD || '';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_NAME || 'postgres';

  // Ensure password is a string and URL-encode it
  const passStr = String(pass);
  const encodedPass = encodeURIComponent(passStr);

  return `postgresql://${user}:${encodedPass}@${host}:${port}/${db}`;
}

const connectionString = buildConnectionString();

function maskPwd(conn) {
  try {
    return conn.replace(
      /(\/\/[^:]+:)([^@]+)(@)/,
      (_, a, p, b) => `${a}${'<hidden>'}${b}`
    );
  } catch (e) {
    return conn;
  }
}

/**
 * Decide whether to enable SSL.
 *
 * Rules (in priority order):
 * 1. If FORCE_SSL === 'true' => enable SSL.
 * 2. If PGSSLMODE is set to 'require' or 'verify-full' etc. => enable SSL.
 * 3. If connection host parses to 'localhost' or '127.0.0.1' => disable SSL.
 * 4. Otherwise enable SSL when NODE_ENV === 'production'.
 *
 * This gives predictable behavior for local dev (no SSL) and for Render (SSL).
 */
function shouldUseSsl(connStr) {
  if (process.env.FORCE_SSL && String(process.env.FORCE_SSL).toLowerCase() === 'true') {
    return true;
  }
  if (process.env.PGSSLMODE && process.env.PGSSLMODE.toLowerCase() === 'require') {
    return true;
  }

  try {
    const parsed = new URL(connStr);
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return false;
    }
    // Also treat unix socket or Windows pipe as local (rare) - fallback handled below
  } catch (e) {
    // ignore parse errors and fall through
  }

  // Default: enable SSL in production, else disable
  return process.env.NODE_ENV === 'production';
}

const useSsl = shouldUseSsl(connectionString);

console.log('Using DB connection (masked):', maskPwd(connectionString));
console.log('NOTE: If the password contained special characters, it was URL-encoded.');
console.log(`DB SSL mode chosen: ${useSsl ? 'ENABLED (rejectUnauthorized: false)' : 'DISABLED (no SSL)'} (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err && err.stack ? err.stack : err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
