// backend/src/db/index.js
// Builds DATABASE_URL from DB_* env vars if needed and URL-encodes the password.
// Logs a masked connection string for debugging.

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
    return conn.replace(/(\/\/[^:]+:)([^@]+)(@)/, (_, a, p, b) => `${a}${'<hidden>'}${b}`);
  } catch (e) {
    return conn;
  }
}

console.log('Using DB connection (masked):', maskPwd(connectionString));
console.log('NOTE: If the password contained special characters, it was URL-encoded.');

const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err && err.stack ? err.stack : err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
