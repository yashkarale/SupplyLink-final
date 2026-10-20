# Supply Link repository audit

Audit date: 2026-10-16

## Stack found

- Client: React 19, React Router, Vite, Tailwind CSS, Axios, Oxlint.
- API: Express 5, Mongoose 9, JWT bearer authentication, Helmet, CORS, rate limiting.
- Database: MongoDB. Order creation uses MongoDB transactions, which require a replica set.
- ML: a separate FastAPI service is referenced by the client. No live ML connection was verified.
- Payments: Razorpay order creation and signature verification exist for seller subscriptions. Credentials and a live transaction were not verified.
- Tests: Vitest on the server. No client test script or end-to-end/browser test suite was found.

## Implemented and checked in this work

- Store API response shape is shared between `/api/store/:slug` and `/api/sellers/store/:slug`; public responses omit seller phone and WhatsApp values.
- Slugs are normalized to lowercase hyphenated values in client store links, public storefront requests, seller onboarding, public store reads, and public order creation.
- Public product listing returns published products only. Storefront API failures and empty catalogs do not render demonstration products.
- Product creation and editing use authenticated, seller-scoped API routes. Product edits ignore client-supplied ownership fields.
- Checkout calculates totals from database prices and atomically decrements stock in a transaction; client-supplied totals/discounts are not trusted.
- Orders now return an unguessable tracking token once; the persisted token hash backs a public tracking endpoint that omits buyer contact/address details. The tracking page polls for current status and status history.
- Seller WhatsApp values are validated and normalized to international format, public store JSON exposes only a contact-availability flag, and the redirect resolves only the configured WhatsApp value without falling back to a phone number. Cart inquiries use published seller catalog data and explicitly do not create/reserve an order.
- Order creation can optionally submit seller and buyer email through the Resend API. Order email attempt status is persisted as not-configured, accepted, failed, or skipped; provider acceptance is not described as delivery.
- Authentication no longer accepts GET/query credentials, and request logs redact sensitive query values including login email/password and tracking tokens.
- Store-scoped Server-Sent Events are emitted after product/inventory writes and successful order transactions. The storefront refetches authoritative state on events/reconnect and retains polling as fallback.
- Paid subscription demo success was removed. Razorpay verification checks signature and fetched order owner/plan/amount/currency.
- Client production API base can be configured with `VITE_API_URL`; same-origin deployments default to `/api`.
- Server startup validates required database/JWT settings and production HTTPS frontend origins.
- Local Docker MongoDB configuration enables a single-node replica set for transaction support.
- Hardcoded public-store products, customer email placeholders, fake notification activity, and fake AI measurements were removed or replaced with unavailable states.

## Known incomplete or unverified areas

- The running API returned 404 for both `green routes` and `green-routes`. The public query returns only published, non-suspended seller stores. The matching MongoDB seller record could not be inspected in this environment, so it is not yet known whether the record is absent, unpublished, suspended, or stored under a different legacy slug.
- Store event delivery currently uses an in-process event emitter. It works for a single API process only; multiple API instances need a shared broker/adapter. The storefront still polls every 15 seconds as fallback.
- Tracking currently uses polling, not SSE. Tracking links do not have expiry/revocation controls.
- Durable order-status notifications are not implemented.
- The notification UI accepts local browser events only; notifications are neither persisted nor retrieved from MongoDB.
- Resend has not been configured or live-tested; email verification/password reset/status emails and a durable retry/outbox are absent. A signed delivery-webhook endpoint is implemented but provider configuration and live delivery events are unverified.
- WhatsApp number format can be validated but active WhatsApp registration cannot be confirmed without an actual provider/account verification flow. Direct `wa.me` reveals the recipient identifier in the redirect destination.
- Product deletion, store preview/customization, and SEO/share metadata are incomplete. Product image Cloudinary upload support has been added but is not live-verified.
- AI UI and client integration exist, but no live service or data-backed analytics output was verified. The UI now shows unavailable values when disconnected.
- Subscription webhooks, idempotent payment-event persistence, and subscription entitlement enforcement are not verified.
- Seller order cancellation/restocking is not covered by transaction or integration tests.
- MongoDB integration, Razorpay integration, Docker Compose, deployment, multi-seller authorization, concurrent orders, tracking privacy, SSE delivery, and browser workflows were not verified against live services.
- Store A/Store B destination isolation is covered at helper level only; persisted database scoping and seller contact changes still need a MongoDB-backed test.
- No separate MongoDB migration runner is present. Mongoose indexes are declared in schemas; existing database compatibility still requires deployment review.

## Checks run

- `npm.cmd run build` in `client`: passed after route-level code splitting; largest reported chunk is about 337 kB.
- `npm.cmd run lint` in `client`: exited 0 with no lint diagnostics in the 2026-10-16 run.
- `npm.cmd test` in `server`: passed, 13 files and 40 tests (auth URL safety, canonical slug, WhatsApp format/link behavior, email configuration, webhook signature checks, media storage, plan entitlements, readiness, and existing billing/order tests).
- `npm.cmd audit --omit=dev` in `server` and `client`: both passed with 0 reported production dependency vulnerabilities (registry access required approval).
- `git diff --check`: passed (Git reported an LF/CRLF normalization notice for the storefront file).
- `docker compose -f docs/docker-compose.yml config`: blocked because Docker is not installed in this environment.
- Live API probe: `GET /api/health` returned 200; both tested public slug variants returned 404.

## Re-audit and repairs — 2026-10-16

- **High, repaired:** login and registration previously relied only on the global API request limit. They now have endpoint-specific limits (10 login attempts per 15 minutes; 5 registrations per hour). These are in-memory limits and need a shared store if the API is horizontally scaled.
- **High, repaired:** inventory delta updates could silently clamp below-zero changes to zero, and a request with neither stock field could succeed as a no-op. Inventory now requires exactly one integer `stock` or `delta` value and applies deltas atomically with a nonnegative-stock condition.
- **Medium, repaired:** `Order.sellerId` stores authenticated User IDs, but its Mongoose population reference named Seller. The schema now references User; this metadata correction does not change stored IDs.
- **Medium, outstanding:** dashboard/order/product listing queries are not consistently paginated and some analytics load full seller collections into application memory. Add bounded pagination/aggregation before substantial growth.
- **High, launch blocker:** core tenant and order guarantees still lack MongoDB-backed integration tests. Existing tests exercise helpers and request-level behavior; they do not establish isolation or stock behavior against a replica set.
- **High, launch blocker:** no verified live MongoDB deployment, email sender/webhook, Cloudinary configuration, Razorpay transaction, or staging deployment. The readiness test observed 503 when no database connection was available.
- **Medium, monetization gap:** paid plans are monthly manual-renewal plans; yearly billing, recurring renewal, refund handling, webhook reconciliation, and distinct feature entitlements are not implemented. Do not market automatic subscriptions or accept production billing until these lifecycle items are implemented and verified.

### Re-run after repairs

- Client production build: passed (`npm.cmd run build`).
- Client lint: passed (`npm.cmd run lint`).
- Server tests: passed (13 files, 40 tests; `npm.cmd test`).
- Git whitespace checks: passed (`git diff --cached --check` and `git diff --check`).
- Live DB, provider, Docker, deployment, browser, and multi-seller integration checks: not performed in this environment.

**Verdict: NOT READY.** Local build and tests pass, but live infrastructure, staging tenant-isolation/order tests, and billing lifecycle checks remain launch gates.

## Staging preparation update — 2026-10-16

- Added `server/tests/staging.integration.test.js`, gated by `RUN_STAGING_INTEGRATION=1`, using a separate `STAGING_MONGODB_URI`. It rejects database names without `staging` or `test` and tests two-seller data access, settings/slug collision, public privacy, product creation, order visibility, dashboard separation/revenue, repeated request idempotency, concurrent stock contention, and cancellation restoration.
- Added seller-scoped checkout idempotency using a unique partial index and request UUID. Storefront retries keep the same key; new carts/orders get a new key. Existing external clients must now send `requestId`.
- Added seller-authenticated Cloudinary product image upload and a product form file picker. Live persistence/redeployment could not be checked without Cloudinary staging credentials.
- Dashboard recognized sales now count verified payments and delivered COD orders while excluding cancelled/returned orders; a unit test covers this definition.
- Added separate staging environment templates and expanded deployment instructions. Environment inspection found no staging MongoDB URI, Resend key, Cloudinary credentials, Razorpay test keys, or staging URLs configured.
- Local MongoDB TCP and a read-only handshake were reachable, but the requested `replicaSet=rs0` URI failed with `ReplicaSetNoPrimary` / server selection timeout. The staging integration suite stopped before creating records.
- Latest local checks: server suite 15 files, 43 passed, 2 staging cases skipped; client build and lint pass. The opt-in database workflow is still unverified.

The line-item status and exact next steps are tracked in `LAUNCH_CHECKLIST.md`.
