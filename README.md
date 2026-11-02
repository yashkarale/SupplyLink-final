# Supply Link

Supply Link is a seller-first commerce platform with a React frontend, Express backend, MongoDB data layer, public marketplace discovery, seller storefronts, online checkout, offline POS sales, and unified analytics. This repository is organized as a multi-tenant seller SaaS with a public marketplace and seller-only dashboard.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Express + MongoDB + JWT session auth
- Data layer: Mongoose models, inventory ledger, order snapshots, public store routes
- Integrations: Resend email, Razorpay billing, Cloudinary image upload, optional ML service
- Testing: Vitest for backend and frontend regression tests

## Repository structure

- `client/` — seller dashboard, storefront UI, analytics, POS flows
- `server/` — API, middleware, controllers, migrations/scripts, tests
- `docs/` — deployment and infrastructure notes
- `ml-service/` — optional ML service, not part of the core deployment path

## Local development

### 1. Start MongoDB

```bash
docker compose -f docs/docker-compose.yml up -d
```

### 2. Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

### 4. Health checks

- API health: `http://localhost:5000/api/health`
- Database readiness: `http://localhost:5000/api/ready`

## Architecture overview

- Public marketplace routes expose only published sellers and published products.
- Seller-only routes are protected by JWT auth and session validation.
- Seller ownership and tenant isolation are enforced through sellerId checks on product, order, and dashboard operations.
- Orders store a snapshot of product and customer data to preserve historical analytics even if catalog data changes.
- Stock mutation is centralized through `server/src/services/inventoryService.js` and not through direct `Product.findOneAndUpdate` writes from controllers.
- Offline POS uses the same Order collection with `orderType: 'OFFLINE_POS'`, while public checkout uses `orderType: 'ONLINE'`.
- Analytics use revenue classification logic and rely on order status and payment status rather than raw totals alone.

## Environment variable checklist

Create a production-safe `.env` file in the server folder. The repository includes a working example in `server/.env.example`.

Required values:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:5000
MONGODB_URI=mongodb://localhost:27017/supplylink
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
JWT_EXPIRES_IN=1d
NODE_ENV=development
MONGODB_ORDER_WRITE_LIMIT_MB=350
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
EMAIL_FROM=Supply Link <orders@example.com>
APP_BASE_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Production rules:

- `JWT_SECRET` must be at least 32 characters and unique.
- `CLIENT_URL` must be HTTPS in production and can accept multiple origins separated by commas.
- `APP_BASE_URL` must be the HTTPS frontend origin used for email verification links.
- `MONGODB_URI` must point to a MongoDB replica-capable cluster for transaction-safe stock/order writes.
- Cloudinary keys are required for QR and proof uploads; the app fails closed without them.
- Resend and Razorpay values are required for email verification and plan/billing flows.

## API overview

- `/api/auth/*` — registration, email verification, login, logout, session validation
- `/api/sellers/*` — seller onboarding, store settings, dashboard, customer summary, public store metadata
- `/api/products/*` — seller-managed catalog and inventory operations
- `/api/orders/*` — public order checkout, POS sales, tracking, seller order status updates
- `/api/billing/*` — subscription plans and payment verification
- `/api/marketplace/*` — public discovery of sellers and products
- `/api/store/*` — public store pages and WhatsApp/contact flows
- `/api/webhooks/*` — external provider callbacks

## Testing

Run the repo tests before making production changes:

```bash
cd server && npm test
cd client && npm test -- --run
```

This project has a mix of real backend assertions and route-level checks, but some external integrations remain environment-dependent and are not considered production-verified without a live service configuration.

## Deployment procedure

1. Prepare a MongoDB Atlas or replica-capable MongoDB cluster.
2. Configure backend environment variables from `server/.env.example`.
3. Set `CLIENT_URL` explicitly to the HTTPS frontend domain and allow the API origin for CORS.
4. Set `APP_BASE_URL` to the live frontend URL used for email links.
5. Build the frontend against the deployed API URL.
6. Start the backend with a valid `MONGODB_URI` and `JWT_SECRET`.
7. Confirm `/api/health` and `/api/ready` respond successfully.
8. Verify seller onboarding, store publishing, product creation, and order flows in staging before production.
9. Keep secrets in the deployment platform secret store; do not commit them to the repo.

## Known limitations

- No production deployment is executed as part of this repository review.
- Live email and payment provider flows require real credentials and can fail if not configured correctly.
- Order expiry, payment webhook handling, and file storage rely on external services and should be treated as operationally sensitive.
- The codebase is not a full SaaS platform rewrite; it is a working seller commerce implementation that requires operational hardening before production rollout.

## Important constraints

- Do not deploy from this workspace.
- Do not modify production data.
- Do not change subscription pricing.
- Do not add new product features in this phase.
- Preserve the current Paper & Ledger design system.

For additional operational guidance, see the deployment notes in `docs/` and the server `README` for the environment checklist.

