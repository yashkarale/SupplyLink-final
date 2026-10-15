# Supply Link

Supply Link is a seller storefront and operations application for small businesses and social-commerce sellers. The repository contains a React frontend and Express API. The client can call an optional external ML service, but that service is not included in this repository.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Express + MongoDB + JWT auth
- Optional ML integration: external HTTP service configured with `VITE_ML_URL` (not included or verified here)
- Styling: Tailwind CSS
- Testing: Vitest / Node test runner

## Repository structure

- `client/` - React dashboard and storefront UI
- `server/` - Express API + Mongo models + auth middleware
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
MONGODB_URI=mongodb://localhost:27017/supplylink?replicaSet=rs0
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
NODE_ENV=development
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
EMAIL_FROM=Supply Link <orders@example.com>
APP_BASE_URL=http://localhost:5173
```

Paid subscriptions require Razorpay test or live credentials. Paid plans stay unavailable until both keys are configured; payment verification checks the signature and the Razorpay order's seller, plan, amount, and currency. Keep the key secret in the server's deployment secret store. Serve the frontend and API over HTTPS in production, and set `CLIENT_URL` to the allowed frontend origin(s).

The public store API omits seller phone and WhatsApp values. Contact clicks resolve the seller on the server and redirect to WhatsApp. WhatsApp requires the recipient identifier in its destination URL, so a determined visitor can still see it there. Fully concealing it requires a WhatsApp Business Platform backend integration and its credentials.

WhatsApp numbers must use international format (for India, `+91` plus a valid 10-digit mobile number). A valid number format does not prove the number has an active WhatsApp account. Storefront WhatsApp messages are inquiries only; checkout is the separate persisted order workflow.

Order email is optional and uses the Resend API when both `RESEND_API_KEY` and `EMAIL_FROM` are configured. Configure a verified sender domain and production `APP_BASE_URL`. Without these values, email status is explicitly `not_configured`; when the API accepts an email request, this still does not prove inbox delivery. The signed webhook endpoint can record provider delivery events after `RESEND_WEBHOOK_SECRET` is configured, but it has not been verified against a live Resend account and there is no durable retry queue.

For deployment, set `VITE_API_URL` to the HTTPS API base in the client build environment (or use the same-origin `/api` default), and set `VITE_ML_URL` only when an HTTPS ML service is deployed. The backend refuses to start without `MONGODB_URI` and a 32-character `JWT_SECRET`; in production it also requires HTTPS `CLIENT_URL` origins. MongoDB transactions used for product limits, order stock, and subscription persistence require a replica set; the local Docker configuration starts a single-node replica set. Back up and review existing data before running `npm run migrate` to create/verify indexes.

## Current status

Core seller, catalog, storefront, order, tracking, and seller-plan code exists, but the project is **not production-ready**. Integration gaps include live database/provider verification, durable notifications, payment webhooks/renewals, image storage, cross-instance realtime, browser E2E, and full multi-seller security tests. Read `SUPPLY_LINK_AUDIT.md`, `SUPPLY_LINK_BUG_REPORT.md`, and `SUPPLY_LINK_RELEASE_CHECKLIST.md` before staging.

The Free plan currently allows two non-archived products. The server checks app database logical size before accepting new checkout orders, creating paid Razorpay orders, or saving product/inventory changes; `MONGODB_ORDER_WRITE_LIMIT_MB` defaults to 350 MiB. This is a safety stop, not an order-count guarantee. Run `cd server && npm run storage:report` against the target database and remember Atlas's free quota covers the entire cluster, not just this app database.

## Project guides

- `SUPPLY_LINK_COMPLETE_GUIDE.md` - architecture, files, data flow, and debugging.
- `SUPPLY_LINK_BUSINESS_WORKFLOW.md` - platform, seller, and buyer operating flows.
- `SUPPLY_LINK_UI_UX_REVIEW.md` - UI findings and browser verification limits.
- `SUPPLY_LINK_CAPACITY_AND_COSTS.md` - schema-based storage estimates and current vendor references.
- `SUPPLY_LINK_BUSINESS_MODEL.md` - scenario assumptions and illustrative unit economics.
- `DEPLOYMENT.md` - environment and staging steps.

## Important note

Do not commit real secrets or production credentials. Use `.env` only for local development and load real values from a secure deployment platform when going live.
"# SupplyLink-final" 
