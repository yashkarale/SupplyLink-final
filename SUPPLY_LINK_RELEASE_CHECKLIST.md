# Supply Link release checklist

Current release assessment: **NOT READY**.

## Verified locally

- [x] Client production build completes.
- [x] Server suite passes locally (15 files, 43 passed, 2 opt-in staging tests skipped; rerun 2026-10-16).
- [x] Client lint command exits successfully with no warnings.
- [x] Production dependency audit reports zero known vulnerabilities in both packages at audit time.
- [x] Git whitespace check passes.
- [x] Public API omits seller phone/WhatsApp fields from its JSON store object.
- [x] Paid subscription activation requires server-side Razorpay verification.
- [x] Subscription verification checks the fetched Razorpay payment is captured and matches the seller, plan, amount, and currency.
- [x] A successful paid checkout grants a one-month entitlement with an explicit expiry date.
- [x] Seller order updates cannot change payment status; cancellation and stock restoration run in one database transaction.
- [x] API exposes a MongoDB readiness probe and closes the database connection during graceful shutdown.
- [x] Free sellers are limited to two non-archived products, with transaction serialization for simultaneous product creation.
- [x] New product images cannot embed base64 file data; product images are limited to URLs.
- [x] Database-backed checkout stops at a configurable app-database storage threshold and a report command measures actual usage.
- [x] Public order tracking uses an unguessable token; tracking response omits buyer contact and address.
- [x] Public order tracking tokens expire after 90 days; older legacy orders use the same cutoff.
- [x] Public storefront SSE events and polling reconciliation are wired for single-process deployments.
- [x] WhatsApp contact resolves the persisted seller number, validates international format, and has no phone-number fallback.
- [x] Optional Resend order email reports provider acceptance separately from delivery and reports missing configuration.
- [x] Local Docker Mongo configuration is set to use a replica set (configuration could not be validated because Docker is unavailable).

## Required before staging

- [ ] Inspect/fix the actual `green-routes` seller record and confirm published/active state.
- [ ] Configure a verified Resend sending domain/key/webhook secret and verify provider acceptance plus webhook-backed delivery status in staging.
- [ ] Verify Store A/Store B WhatsApp destinations and contact edits against a real replica-set database; validate seller numbers with the sellers/WhatsApp.
- [ ] Run MongoDB-backed integration tests for store visibility, tenant isolation, product edits, order creation, concurrent stock updates, cancellation, and payment verification.
- [ ] Run `npm run storage:report` against the pilot database and confirm the 350 MB default threshold leaves sufficient headroom for the full Atlas cluster.
- [ ] Verify the Free two-product cap and the database-size gate under concurrent requests on a replica-set staging database.
- [ ] Test tracking expiry and ensure tracking tokens stay out of logs and seller-facing order responses in MongoDB-backed staging.
- [ ] Implement persisted notifications and choose/verify real-time transport and reconnect recovery.
- [ ] Add a shared event adapter before running multiple API instances.
- [ ] Add client/browser end-to-end tests for seller publish, buyer checkout, and status changes.
- [ ] Validate Docker Compose and replica-set initialization with Docker installed.
- [ ] Review remaining lint warnings and verify lazy-loaded routes in a browser.

## Required before production

- [ ] Back up staging data, review unique-index conflicts, and run `npm run migrate` before deployment.
- [ ] Configure HTTPS `CLIENT_URL`, `VITE_API_URL`, and any deployed `VITE_ML_URL`.
- [ ] Configure managed MongoDB with backups, restore testing, TLS, and transaction support.
- [ ] Set strong `JWT_SECRET`; verify all deployment secrets are stored outside source control.
- [ ] Configure and test Razorpay credentials and webhook signing/idempotency before enabling paid plans.
- [ ] The current plans require manual renewal; implement and test auto-renewal, refund handling, and subscription webhooks before marketing them as auto-renewing subscriptions.
- [ ] Configure Resend sender/API/webhook secrets and HTTPS `APP_BASE_URL`; implement a durable email queue/retry before relying on delivery state.
- [ ] Select image storage and retention policy if product uploads are enabled.
- [ ] Set monitoring, alerting, log retention, health checks, and rollback procedure.
- [ ] Run the release suite against staging and record results before launch.

## External contact limitation

WhatsApp `wa.me` destinations necessarily contain a recipient identifier. The app does not render the seller's number or return it as a JSON field, but a visitor can inspect the redirect destination. Full concealment requires WhatsApp Business Platform messaging through a credentialed backend.
