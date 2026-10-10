# Supply Link

Supply Link is a SaaS starter for small sellers who run social commerce businesses. The project is organized into a React frontend, an Express API, and a Python AI/ML service.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Express + MongoDB + JWT auth
- ML Service: Python + FastAPI
- Styling: Tailwind CSS
- Testing: Vitest / Node test runner

## Repository structure

- `client/` - React dashboard and storefront UI
- `server/` - Express API + Mongo models + auth middleware
- `ml-service/` - Python ML service foundation
- `docs/` - Docker and project docs

## Quick start

### 1. Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

### 3. Dockerized MongoDB

```bash
docker compose -f docs/docker-compose.yml up -d
```

## Required env

Create a `.env` file in the server folder with values like:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/supplylink
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
NODE_ENV=development
```

## Current status

This is a startup-ready foundation with:

- secure Express configuration
- auth route and protected middleware
- MongoDB readiness
- rate limiting and CORS
- startup docs and environment sample
- frontend auth flow scaffold

## Next roadmap

1. Seller onboarding and store profile
2. Product CRUD and inventory logic
3. Cart, checkout, and order lifecycle
4. Subscription and billing
5. AI forecasting and recommendation service
6. Docker, CI/CD, and deployment

## Important note

Do not commit real secrets or production credentials. Use `.env` only for local development and load real values from a secure deployment platform when going live.
"# SupplyLink-final" 
