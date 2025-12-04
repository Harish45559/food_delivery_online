# React + Node.js + PostgreSQL Starter (updated)

Changes added:
- seed script: backend/scripts/seed.js creates test user test@example.com / password123
- reset-token flow (email link) instead of OTP storage
- Dockerfiles for backend & frontend and docker-compose.yml to run Postgres + backend + frontend
- Frontend validation utilities and a ProtectedRoute component
- Tailwind config files added (install dev deps to use Tailwind)

## Quick Docker (build + run)
docker-compose up --build

## Seed (local without Docker)
cd backend
cp .env.example .env   # set DATABASE_URL to your DB
npm install
node scripts/seed.js

