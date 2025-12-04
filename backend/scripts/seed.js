// backend/scripts/seed.js
// Seed script that reuses the app DB pool (so SSL and config from src/db apply).
// Usage: NODE_ENV=production DATABASE_URL="..." node scripts/seed.js
require('dotenv').config();
const db = require('../src/db'); // reuse the pool from src/db (ensures SSL settings)
const bcrypt = require('bcrypt');

(async () => {
  const pool = db.pool;
  let client;
  try {
    client = await pool.connect();

    console.log('Connected to DB, running seed...');

    // ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        otp_code VARCHAR(10),
        otp_expires_at TIMESTAMP,
        reset_token VARCHAR(255),
        reset_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    const email = process.env.SEED_USER_EMAIL || 'test@example.com';
    const password = process.env.SEED_USER_PASSWORD || 'password123';
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

    console.log(`Seeding user: ${email} (bcrypt rounds: ${rounds}) - DO NOT use these credentials in production`);

    const hash = await bcrypt.hash(password, rounds);

    const insertResult = await client.query(
      `INSERT INTO users (email, password_hash, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             name = EXCLUDED.name,
             updated_at = now()
         RETURNING id;`,
      [email, hash, 'Test User']
    );

    console.log('Seed user upserted. user id:', insertResult.rows[0].id);

    console.log('Seed finished successfully.');
    process.exitCode = 0;
  } catch (err) {
    console.error('Seed failed:', {
      message: err && err.message,
      code: err && err.code,
      stack: err && err.stack
    });
    process.exitCode = 1;
  } finally {
    try {
      if (client) client.release();
      // end the pool so the script can exit cleanly
      await pool.end();
    } catch (e) {
      // log but don't overwrite previous error code
      console.error('Error during pool shutdown:', e && e.message);
    }
  }
})();
