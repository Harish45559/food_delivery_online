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
-- Run the seed script to create a test user with email test@example.com and password password123:
-- node scripts/seed.js  (ensure DATABASE_URL is set in .env)
