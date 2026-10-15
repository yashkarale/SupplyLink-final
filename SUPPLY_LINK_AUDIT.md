# Supply Link repository audit

Audit date: 2026-10-15

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
- Product deletion, image uploads/storage, store preview/customization, and SEO/share metadata are incomplete.
- AI UI and client integration exist, but no live service or data-backed analytics output was verified. The UI now shows unavailable values when disconnected.
- Subscription webhooks, idempotent payment-event persistence, and subscription entitlement enforcement are not verified.
- Seller order cancellation/restocking is not covered by transaction or integration tests.
- MongoDB integration, Razorpay integration, Docker Compose, deployment, multi-seller authorization, concurrent orders, tracking privacy, SSE delivery, and browser workflows were not verified against live services.
- Store A/Store B destination isolation is covered at helper level only; persisted database scoping and seller contact changes still need a MongoDB-backed test.
- No separate MongoDB migration runner is present. Mongoose indexes are declared in schemas; existing database compatibility still requires deployment review.

## Checks run

- `npm.cmd run build` in `client`: passed after route-level code splitting; largest reported chunk is about 337 kB.
- `npm.cmd run lint` in `client`: exited 0 with existing lint warnings.
- `npm.cmd test` in `server`: passed, 7 files and 18 tests (auth URL safety, canonical slug, WhatsApp format/link behavior, email configuration, webhook signature checks, existing billing/order tests).
- `npm.cmd audit --omit=dev` in `server` and `client`: both passed with 0 reported production dependency vulnerabilities (registry access required approval).
- `git diff --check`: passed (Git reported an LF/CRLF normalization notice for the storefront file).
- `docker compose -f docs/docker-compose.yml config`: blocked because Docker is not installed in this environment.
- Live API probe: `GET /api/health` returned 200; both tested public slug variants returned 404.
