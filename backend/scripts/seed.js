// backend/scripts/seed.js
// Robust DB initializer: creates core tables + runs SQL from backend/sql/ (including menu_init.sql)

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/db"); // reuse shared SSL-enabled pool
const bcrypt = require("bcrypt");

async function runSql(client, sql, label) {
  if (!sql || !sql.trim()) return;

  try {
    await client.query(sql);
    console.log(`✔ Executed: ${label}`);
  } catch (err) {
    console.error(`❌ Error executing (${label}):`, err.message || err);
    throw err;
  }
}

async function runSqlFile(client, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`(Skipping) SQL file not found: ${filePath}`);
    return;
  }

  console.log(`\n📄 Running SQL file: ${path.basename(filePath)}`);

  const content = fs.readFileSync(filePath, "utf8");

  // Split into statements safely by semicolon
  const statements = content
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    await runSql(client, stmt, `${path.basename(filePath)} [part ${i + 1}]`);
  }
}

(async () => {
  const pool = db.pool;
  let client;

  try {
    client = await pool.connect();
    console.log("Connected → running database initialisation...\n");

    //
    // 1️⃣ USERS TABLE
    //
    await runSql(
      client,
      `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        otp_code VARCHAR(10),
        otp_expires_at TIMESTAMP,
        reset_token VARCHAR(255),
        reset_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
      `,
      "users table"
    );

    //
    // 2️⃣ ORDERS TABLE
    //
    await runSql(
      client,
      `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        stripe_pid TEXT UNIQUE,
        status TEXT,
        total_gbp NUMERIC,
        notes TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_address TEXT,
        paid_by TEXT,
        delivery_type VARCHAR(20)
      );
    `,
      "orders table"
    );

    //
    // 3️⃣ USER ADDRESSES TABLE
    //
    await runSql(
      client,
      `
      CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        label VARCHAR(100),
        name VARCHAR(255),
        phone VARCHAR(50),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
      ON user_addresses(user_id);
    `,
      "user_addresses table"
    );

    //
    // 4️⃣ MENU INITIALISATION (your menu_init.sql)
    //
    const sqlDir = path.join(__dirname, "..", "sql");
    const menuInit = path.join(sqlDir, "menu_init.sql");

    await runSqlFile(client, menuInit);

    //
    // 5️⃣ UPSERT SEED USER (safe)
    //
    const email = process.env.SEED_USER_EMAIL || "test@example.com";
    const password = process.env.SEED_USER_PASSWORD || "password123";
    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

    const hash = await bcrypt.hash(password, rounds);

    const result = await client.query(
      `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET password_hash = EXCLUDED.password_hash,
                    name = EXCLUDED.name,
                    updated_at = NOW()
      RETURNING id;
      `,
      [email, hash, "Seed User"]
    );

    console.log(`\n✔ Seed user ready (id ${result.rows[0].id})`);
    console.log("✔ Database initialisation completed.\n");

    process.exitCode = 0;
  } catch (err) {
    console.error("\n❌ DB Initialisation failed:", err.message || err);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await db.pool.end();
  }
})();
