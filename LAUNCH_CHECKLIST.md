# Supply Link staging and private beta checklist

Assessment date: 2026-10-16

Status meanings: **VERIFIED** means a test or staging observation was executed; **FAILED** means an executed check exposed a defect or missing required implementation; **BLOCKED** means required external configuration/access is unavailable; **NOT TESTED** means no check was run.

## Local checks

- [x] **VERIFIED** - Dashboard revenue unit check includes only verified payments and delivered COD orders, excluding cancelled and returned orders.
- [x] **VERIFIED** - Client production build (`client`: `npm.cmd run build`).
- [x] **VERIFIED** - Client lint (`client`: `npm.cmd run lint`).
- [x] **VERIFIED** - Server suite: 15 files, 45 passed, 2 skipped (`server`: `npm.cmd test`). The skipped tests are the opt-in MongoDB staging cases.
- [x] **VERIFIED** - Staging test safety guards: database name rejection and exact database/host confirmation checks pass (`server`: `npm.cmd run test:staging`, without staging opt-in; 3 passed, 2 live DB tests skipped).
- [x] **VERIFIED** - Razorpay config guard refuses non-test key IDs in `NODE_ENV=staging` (unit test); this does not test provider credentials or payments.
- [ ] **BLOCKED** - Docker Compose validation; Docker is not installed in this environment. Review found Compose creates a root account, so its health check has been updated to authenticate. The documented local app URI now includes `authSource=admin` and `replicaSet=rs0`; this could not be validated without Docker.

## Staging database and seller isolation

- [x] **FAILED** - Local MongoDB replica-set preflight: the direct read-only `hello` response from `localhost:27017` had `isWritablePrimary: true` but no `setName` or replica-set members, proving the reachable service is standalone. The attempted `mongodb://localhost:27017/supplylink_staging?replicaSet=rs0` URI requested `rs0`, so the driver filtered this standalone node and reported `ReplicaSetNoPrimary`. No test records were created. Docker Compose defines the intended `rs0`; its auth settings were also inconsistent and have been corrected, but Docker is unavailable here.
- [x] **FAILED** - Opt-in `npm.cmd run test:staging` against the isolated local URI: `ReplicaSetNoPrimary` at `mongoose.connect` after the 8-second server-selection timeout; the two DB cases did not execute and no fixtures were created. The three pure URI-safety guard checks passed in the same file.
- [ ] **BLOCKED** - Managed staging MongoDB URI and transaction-capable replica set are not configured in this environment. Docker is not installed, so the repo's local single-node replica-set compose service cannot be started here.
- [ ] **BLOCKED** - Two-seller integration suite: coverage is prepared in `server/tests/staging.integration.test.js`, but no staging database is configured and live tests did not run. The suite now requires exact `STAGING_DATABASE_CONFIRM` and `STAGING_HOST_CONFIRM` values in addition to an explicitly named staging/test DB. Re-run with those confirmations and a dedicated transaction-capable `STAGING_MONGODB_URI`.
- [ ] **BLOCKED** - Staging verification of cross-seller product reads/edits, store settings, orders, analytics, slug isolation, and public data privacy.
- [ ] **VERIFIED** - Unauthenticated product image-upload endpoint returns 401 in the automated request test.
- [ ] **BLOCKED** - Full unauthenticated/protected route and seller isolation checks against MongoDB.

## Order and inventory integrity

- [ ] **NOT TESTED** - Code review: checkout requires a UUID request ID, unique seller-scoped idempotency key, atomic stock predicate, and MongoDB transaction. On duplicate-key race it re-reads and returns the existing order. A reused key with a changed payload returns the original order; staging execution remains blocked.
- [ ] **BLOCKED** - Execute idempotency, concurrent stock contention, cancellation restoration, repeated cancellation, and tenant cross-access tests against a replica set. Integration cases are prepared but could not connect to a primary.
- [ ] **NOT TESTED** - Cancellation code review: cancellation and stock restoration occur in one transaction; repeated CANCELLED status does not restore inventory again, and verified-paid orders cannot be cancelled without refund. Concurrent transaction behavior remains unverified against MongoDB.
- [ ] **BLOCKED** - Inventory delta writes use an atomic nonnegative stock predicate, but database behavior has not been exercised against MongoDB.
- [ ] **BLOCKED** - Full registration/login -> store -> product -> storefront -> checkout -> seller status -> analytics workflow in staging.
- [ ] **NOT TESTED** - Duplicate-order behavior for legacy clients that omit `requestId`; current API rejects those requests with 400. Update any external checkout clients to send a UUID.

## Email and image storage

- [ ] **BLOCKED** - Resend staging API request, email verification receipt, and delivery event/webhook. No Resend key was present in the process environment; configure a staging key, verified sender, and webhook secret in the staging host.
- [ ] **NOT TESTED** - Code review: image upload uses signed Cloudinary API requests, validates PNG/JPEG bytes, size/dimensions, seller ownership, checks HTTPS response URL, persists it to product, and attempts orphan cleanup after DB failure. Provider upload/retrieval, URL persistence through restart, and failure cases have not been integration-tested.
- [ ] **BLOCKED** - Actual Cloudinary product-image upload/retrieval after API restart or redeployment; Cloudinary credentials were not present in the process environment. Configure a separate staging account/cloud.
- [ ] **NOT TESTED** - Product-image retention/deletion in Cloudinary. Product image removal currently removes the URL through product edits but does not delete the remote asset.
- [ ] **NOT TESTED** - Payment QR and private screenshot upload/access with staging Cloudinary. The application constructs expiring Cloudinary private-download API URLs, but delivery has not been confirmed against the configured account.

## Razorpay and entitlements

- [ ] **VERIFIED** - Automated unit test rejects non-captured, wrong-seller, wrong-amount payments; server verification uses Razorpay-fetched order/payment details before granting monthly entitlement.
- [ ] **BLOCKED** - Razorpay test-mode checkout, real test signature, payment status, and entitlement change; no `rzp_test_` key was present in the process environment. Configure a test account and keys.
- [ ] **FAILED** - Razorpay lifecycle implementation remains incomplete: no signed webhook route/event deduplication, failed-payment reconciliation, refund/cancellation transition, or recurring renewal exists. Current flow creates a one-time Razorpay Order and verifies checkout by fetching captured order/payment details server-side. This requires code/product lifecycle design; credentials only block provider-level execution.
- [ ] **BLOCKED** - Razorpay provider verification: no test-mode key/webhook secret or configured account was available. After lifecycle implementation, run captured/failed payment, duplicate and invalid-signature webhook, refund/cancel, renewal/expiry, and plan-limit cases using test mode only.

## Hosting and pilot readiness

- [ ] **BLOCKED** - Frontend/backend staging URLs, HTTPS, deployment logs, CORS, and direct store-route fallback; no hosting provider or staging domain is configured.
- [ ] **BLOCKED** - Backups, restore drill, monitoring/alerts, rollback, and database capacity review against the actual pilot cluster.
- [ ] **NOT TESTED** - Browser/device usability and customer checkout on mobile.
- [ ] **BLOCKED** - Invite 3-5 pilot sellers only after database isolation, order integrity, email, and image storage checks pass.

## Exact next steps

1. Fix MongoDB target: either install/start Docker, run `docker compose -f docs/docker-compose.yml up -d`, and use `mongodb://root:example@localhost:27017/supplylink_staging?authSource=admin&replicaSet=rs0` for local testing, or create a dedicated managed staging replica set with a primary. Current `localhost:27017` is demonstrably standalone. Do not run until `hello` reports `setName: "rs0"` and a reachable primary.
2. Set only staging values in the staging secret manager, including `STAGING_MONGODB_URI`, `STAGING_DATABASE_CONFIRM` equal to its database name, `STAGING_HOST_CONFIRM` equal to URI host including port if present, and `RUN_STAGING_INTEGRATION=1`. Run `npm run test:staging` from `server/` and retain output.
3. Deploy staging API/frontend with `server/.env.staging.example` and `client/.env.staging.example` as templates. Confirm `/api/health`, `/api/ready`, storefront direct navigation, email receipt/webhook, and product image persistence across redeploy.
4. Implement Razorpay webhook event persistence/signature checks, idempotent failed/refund/cancel transitions, and decide the renewal model (Razorpay Subscriptions API plan IDs vs explicitly manual monthly renewal). Then test in Razorpay test mode; do not accept/advertise paid subscriptions until passed.
5. Complete the hosting/backup/browser checks above, then invite 3-5 sellers and record their workflow and willingness-to-pay evidence.

