# Deployment guide

Supply Link is **not production-ready** until the staging checks below pass. No hosting provider or production database has been selected or tested.

## Required services

- HTTPS hosting for the React/Vite client.
- HTTPS Node/Express API hosting with persistent environment secrets.
- MongoDB deployment supporting transactions (replica set or sharded cluster), backups, and TLS.
- Optional HTTPS ML service (`VITE_ML_URL`).
- Razorpay account and server credentials to enable paid seller subscriptions.

## Configure

1. Set the server environment from `server/.env.example`: `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, `CLIENT_URL` containing the exact HTTPS client origin(s), `NODE_ENV=production`, and `PORT` as required by the host. Use `/api/health` for process liveness and `/api/ready` for readiness (the latter returns 503 when MongoDB is disconnected).
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` only in the API secret manager. Paid checkout returns an explicit configuration error until both are set. Verification checks the Razorpay checkout signature and fetches the order and payment from Razorpay, requiring a captured payment with matching seller, plan, amount, and currency. A successful payment grants one calendar month of access; the seller must pay again manually after expiry. Automatic renewal, refunds, and subscription webhook reconciliation are not implemented. Do not describe the plans as auto-renewing until those lifecycle features exist and pass staging tests.
3. To allow new seller registration, configure `RESEND_API_KEY`, a verified sender in `EMAIL_FROM`, and the HTTPS frontend origin in `APP_BASE_URL`. New accounts cannot sign in until they click the emailed verification link (expires after 24 hours); verification can be resent from the login page. Existing accounts are kept usable for this rollout. Do not enable public registration until Resend delivery and the verification link work from the deployed frontend. Resend API acceptance is not a delivery confirmation. For transactional order email webhooks, configure `https://<api-host>/api/webhooks/resend`, set `RESEND_WEBHOOK_SECRET`, and subscribe to email lifecycle events. The handler has not been tested with a live provider account, and there is no durable retry queue for order-email dispatch.
4. Set the client build environment using `client/.env.example`. Use `VITE_API_URL=https://<api-host>/api`, or leave it unset when the API is reverse-proxied at the same origin under `/api`. Set `VITE_ML_URL` only for an HTTPS ML endpoint.
5. Confirm the public store's `storeSlug` is canonical, `isPublished` is true, and seller `status` is `active`. The public API intentionally hides missing, unpublished, and suspended stores.
6. Back up the database, review duplicate/conflicting records, then run `npm run migrate` from `server/` to create/verify model indexes. This is an index initializer, not a general data migration framework; add explicit versioned migration scripts when future schema changes require data conversion.
7. For the Atlas Free pilot, keep the cluster dedicated to Supply Link and set a conservative `MONGODB_ORDER_WRITE_LIMIT_MB` (default 350 MiB). Before creating a paid Razorpay order, accepting database-backed checkout, or saving product/inventory changes, the API checks this database's logical document plus index size. At the threshold those writes pause and checkout tells buyers to contact the seller. Atlas quota is cluster-wide, so lower the threshold if any other database shares the cluster. Use `npm run storage:report` to measure actual order document/index size; the check does not delete or archive orders and is not a hard cluster-wide quota monitor.
8. The Free seller plan allows two non-archived products. Archived products still occupy storage. Product image data URLs are rejected; up to eight external image URLs can be saved so binary image data does not consume MongoDB quota. Public stores show at most two products when a paid entitlement expires.

## Commands

```powershell
cd server
npm ci
npm test
npm run migrate
npm run storage:report
npm start
```

In another terminal:

```powershell
cd client
npm ci
npm run lint
npm run build
```

The local MongoDB compose file starts a single-node replica set for transactions:

```powershell
docker compose -f docs/docker-compose.yml up -d
```

Use `MONGODB_URI=mongodb://localhost:27017/supplylink?replicaSet=rs0` for that local database. Production should use a managed MongoDB URI, not the local example.

## Staging gates

- Verify the API health endpoint and a published store with real database data.
- Test two sellers and prove cross-seller product/order access is rejected.
- Test concurrent orders against the same stock and verify no oversell.
- Verify Razorpay signatures and order ownership with provider test credentials; test webhook behavior after webhook persistence is implemented.
- Test readiness probe behavior while MongoDB is available and unavailable.
- Test paid plan verification with a Razorpay captured payment and confirm failed/authorized-only payments cannot activate a plan.
- Verify client/storefront behavior after edits and after missed network requests.
- Configure backup/restore, monitoring, log retention, and rollback in the selected hosting provider.

The current repository has public store SSE and token-based order status tracking, but these have not been integration-tested against staging. SSE delivery is in-process and does not fan out across multiple API instances. Durable notifications and payment webhooks are not implemented. Do not mark those release gates passed until implemented and tested.
