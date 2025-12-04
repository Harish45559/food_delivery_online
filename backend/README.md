Backend (Express + Postgres)

1. Setup

- Copy .env.example to .env and update values:
  cp .env.example .env
  (edit DATABASE_URL, SMTP credentials, JWT_SECRET, FRONTEND_URL)

2. Install deps
   npm install

3. Create database table
   psql "<your DATABASE_URL>" -f sql/init.sql
   (or run the seed script which creates the table automatically)

4. Create seed user (test@example.com / password123)
   npm run seed

5. Start server
   npm run dev # uses nodemon

# or

npm start

API endpoints:

- POST /api/auth/register { name, email, password }
- POST /api/auth/login { email, password } -> { token }
- POST /api/auth/forgot-password { email } -> sends reset link
- POST /api/auth/reset-password { token, email, newPassword }
- GET /api/protected/secret (requires Authorization: Bearer <token>)
