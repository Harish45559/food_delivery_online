require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
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

    const email = 'test@example.com';
    const password = 'password123';
    const hash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO users (email, password_hash, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;`,
      [email, hash, 'Test User']
    );

    console.log('Seed created:', { email, password });
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
})();
