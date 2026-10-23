# Supply Link startup readiness audit

**Audit date:** 2026-10-21 (Asia/Kolkata)  
**Scope:** Continued review of the repository snapshot and pre-existing uncommitted work. Guarded tests wrote only to the confirmed disposable local replica set `localhost:27017/supplylink_staging`; the configured application `.env` Mongo URI was not contacted. One authorized Razorpay test-mode order-create request was attempted but returned no HTTP response; no payment was initiated.

## A. Executive verdict

**NO-GO for a limited controlled beta.** Local tenant/order tests and a synthetic logical backup/restore drill passed on the disposable local `rs0` replica set. A platform-neutral staging env template and local health/readiness/CORS checks are prepared, but no hosting platform, real staging endpoint, managed database, backup service, or fully configured provider test accounts are identified. Production topology, TLS delivery, provider behavior, and managed recovery remain unverified.

## B. Verification summary

| Check | Result |
|---|---|
| Full server suite with both guarded DB suites enabled (`cd server && npm.cmd test -- --reporter=dot`) | 72 passed, 0 skipped, 0 failed; 18 files passed |
| Client tests (`cd client && npm.cmd test -- --reporter=verbose`) | 19 passed, 0 skipped, 0 failed; 6 files passed |
| Explicit staging suite on confirmed local target (`npm.cmd run test:staging -- --reporter=verbose`) | 12 passed, 0 skipped, 0 failed (9 DB cases + 3 guard tests) |
| Explicit security suite on confirmed local target (`npm.cmd test -- --run tests/security.test.js --reporter=verbose`) | 7 passed, 0 skipped, 0 failed |
| Client production build | Passed (`vite build`; 2,980 modules transformed) |
| Client lint | Exit 0; 3 warnings (Toast export boundary, Customers state update in effect, Storefront state update in effect) |
| Server static syntax/import check | `rg --files src -g '*.js' -g '!**/node_modules/**'` followed by `node --check`; 42 application JS files passed. Server has no lint script. |
| Backend script syntax check | `rg --files src scripts -g '*.js' -g '!**/node_modules/**'` then `node --check` each path; 45 JS files passed, including `scripts/backup-restore-drill.js`. |
| Staging Mongo integration | 9 database cases and 3 guard cases passed against `supplylink_staging` on writable replica set `rs0`; rollback and concurrent checkout paths exercised. |
| DB-backed security integration | All 7 cases passed against the same exact host/database with required opt-in, confirmation variables, and write-marker guard. |
| Local staging app probes | `/api/health` 200; `/api/ready` 200 with DB connected; configured HTTPS CORS origin allowed; unapproved origin rejected with 403 and no allow-origin header. Production startup also rejected an HTTP `CLIENT_URL` before connecting to MongoDB. |
| Synthetic backup/restore drill | Passed: BSON Extended JSON archive restored six synthetic business collections and their indexes to an isolated local test DB; critical values and dates verified. Does not validate managed snapshots, PITR/oplog, encryption, or production data. |
| Dependency advisory audit | Still blocked by prior unreachable npm advisory endpoint; not retried without evidence that endpoint reachability recovered. |
| Provider integrations | Resend and Cloudinary credentials absent. A Razorpay test-mode order-create request returned a network `TypeError` without an HTTP response; no payment was initiated and order creation outcome is indeterminate. Webhook secret absent. |
| Browser E2E, accessibility audit, load test | Not run; no E2E/browser harness or staging endpoint is configured |
| Production deployment, managed backups/restore, provider delivery | Unverified; no platform/account configuration is present. Synthetic local restore passed, but managed recovery and provider delivery did not. |

**Current test totals:** 91 passed, 0 skipped, 0 failed (72 server + 19 client). Focused runs are included in these totals and are not added again. The checked-in `server/test_output.txt` was not used as evidence.

The final server run enabled both guarded DB suites. Mongo cleanup left zero documents in application collections and one expected staging guard marker. The database contains collection/index metadata created by tests; it is not an empty database.

**Finding counts:** 0 P0, 3 P1, 10 P2, 1 P3. These include verified implementation gaps and launch-critical validations that remain unverified; they are not counts of confirmed vulnerabilities.

## C. Core workflow matrix

| Feature | Implementation status | Evidence | Result and limitation |
|---|---|---|---|
| Seller registration/login | Implemented with bcrypt, email verification, rate limits, persisted revocable JWT sessions | `authController.js`, `authRoutes.js`, auth tests | Unit/API behavior passed. Real email delivery, session TTL/index behavior, password reset, and email ownership lifecycle not verified; no password reset route exists. |
| Store setup and public URL | Implemented with unique seller slug, configured contact redirect, published store API | `sellerController.js`, `Seller.js`, slug tests | Code and unit checks only; fresh browser/public URL not tested against persisted staging data. |
| Product and inventory | Seller-scoped CRUD, validation, plan limits, stock adjustment, image upload hooks | `productController.js`, `Product.js`, client and staging tests | Local database tenant/stock cases passed. Cloudinary upload was not called. |
| Customer checkout and orders | Public checkout uses server product prices, request idempotency, conditional stock decrement, and transactional stock/order/notification writes; cancellation restores stock transactionally | `orderController.js`, order tests, staging integration tests | Local `rs0` tests passed concurrent purchase, rollback, duplicate, cancellation, invalid quantity, insufficient stock, and price tampering. Production topology is unverified. Only seller-managed WhatsApp/UPI proof verification is implemented. Supply Link does not collect customer payments. |
| Seller orders/customers/analytics | Seller filters are present; recognized revenue derives from persisted orders; customers are grouped by contact identity | `sellerController.js`, `customerMetrics.js`, analytics and staging tests | Unit and local two-tenant API checks passed. Orders and dashboard inputs are currently unbounded in-memory reads. |
| Notifications | Seller-scoped list/read/delete and transaction-aware creation; pagination on read | `notificationController.js`, notification and staging tests | Local persisted tenant isolation and transaction rollback cases passed; external live notification delivery is not implemented/verified. |
| Subscription billing | One-time Razorpay order checkout for Supply Link plans, server-side amount/ownership/capture verification, signed webhook and refund handling | `billingController.js`, billing tests | Unit checks passed. Test-mode API order creation was attempted but produced no response; no payment was initiated. Webhook signing secret and delivery remain unverified. Renewal is another one-time checkout, not an automatically recurring subscription. |
| AI insights | Optional external `VITE_ML_URL` service | `api.js`, `AIInsights.jsx` | Explicitly unavailable without external service; not a core verified feature. |
| Live updates | Public-store catalog uses in-process EventEmitter + SSE; seller dashboard/order views fetch on page load | `storeEvents.js`, `sellerController.js` | Single-process catalog updates only. No cross-instance delivery and no live dashboard/order updates. |

## D. Security assessment

- **Authentication:** Passwords are bcrypt-hashed; new accounts require email verification; login, registration, and resend endpoints have rate limits; bearer sessions can be revoked. JWTs are held in browser `localStorage`, so an XSS compromise can expose a live token. No password reset or account deletion flow was found.
- **Authorization and tenant isolation:** Static trace found seller-owned product, order, notification, seller-profile, dashboard, customer, and billing-status routes using `req.user.userId` for owner filters; onboarding/settings bind to the authenticated user. Public store APIs resolve a published seller by slug and return a deliberately reduced store shape. Background order expiry is a system-wide worker scoped to pending orders and restocks using each order's seller ID; email delivery webhooks reconcile by provider message ID. Two-tenant tests passed for products, inventory, orders, customers, analytics, notifications, billing status, forged seller IDs, and public-store serialization on the local staging replica set. Production-target isolation is not verified.
- **Test database safety:** The baseline `server/tests/security.test.js` used unfiltered collection deletes. It now requires `RUN_SECURITY_INTEGRATION=1`, exact URI database/host confirmations, a guarded staging/test marker and writable replica-set topology, and scopes cleanup to fixture seller IDs including notifications. Its seven database-backed tests passed locally.
- **Checkout integrity:** Prices are read from published products, stock updates use `stock >= quantity` predicates, duplicate request IDs have a unique seller-scoped index, and notification writes share the transaction. Cancellation and expired WhatsApp order restocking also use transactions. Local `rs0` replica-set tests passed concurrent purchase, oversell rejection, invalid quantity, duplicate request, cancellation/restock once, and injected notification failure rollback. This verifies the tested local topology only; production transaction support remains unverified.
- **Payments:** Razorpay integration is for Supply Link plan checkout. Provider signatures are checked and payment/order values fetched before activation; webhook events are persisted with unique event IDs and duplicate handling. A configured `rzp_test_` key ID and secret were used only for one minimal test-mode order-create request; network `TypeError` returned no HTTP response, so order creation is indeterminate. No payment was initiated. Webhook secret is absent; signed event, duplicate event, failure, refund, and state-transition behavior remain unverified against Razorpay. Seller-to-customer payment collection is not implemented; WhatsApp/UPI screenshot verification is a seller decision.
- **Input/privacy:** Request body size, image type/size/dimensions, email, phone, postal code, and checkout item count receive validation. Public store serialization omits seller phone/WhatsApp; public order tracking returns limited order status/items. Customer PII is returned to the authenticated seller as expected. Product/order/dashboard lists can grow without pagination.
- **Secrets and transport:** Server startup enforces a 32-character JWT secret and production HTTPS frontend origins. No production secret store, domain, TLS, CORS origin, or Mongo network policy could be verified. Request logs redact selected query parameters and order tracking tokens, but there is no external log/error monitoring evidence.

## E. Deployment readiness

| Item | State |
|---|---|
| Build scripts | Client build works locally. No root orchestration or backend deploy build exists. |
| Hosting, domain, TLS, reverse proxy, SPA fallback | No hosting platform, domains, manifest, or deploy account is specified. The frontend is a Vite static build and the backend is a Node/Express process; platform choice, DNS, TLS termination, API routing, SPA fallback, proxy trust hops, and rollout/rollback strategy are decisions still required. Local HTTPS-origin/CORS guards pass, but no external HTTPS endpoint was tested. |
| Staging environment template | `server/.env.staging.example` is now platform-neutral and explicitly uses production runtime behavior with staging URLs/test credentials. Static validation confirmed required variable names, HTTPS URL schemes, and separation of integration-test variables. Thirteen placeholder values and `.example` domains remain, so this is not deployable configuration. |
| Mongo production access and topology | `.env` target was not contacted. Its URI metadata is SRV with no explicit DB path and username not marked staging/test; actual topology, TLS, IP allowlist, database role, and transaction capability are unknown. Local `rs0` supports tested transactions only on that local service. |
| Index rollout | Local staging DB contains expected unique/idempotency/TTL indexes. `server/scripts/migrate.js` creates schema indexes with `autoIndex:false`; production-like duplicate-data preflight, index build, and rollback have not been exercised. Do not run against production without an approved target and backup. |
| Backup and recovery | Guarded synthetic logical EJSON backup/restore passed locally, restoring user, seller, product, order, subscription payment, and notification documents plus indexes. No managed backup schedule, encrypted artifact, point-in-time/oplog restore, retention policy, RPO/RTO, or production-like restore has been tested. |
| Email provider | Resend integration exists; staging key, sender-domain verification, inbox, and webhook secret are absent. Provider calls were not made. |
| Images | Cloudinary integration exists; no staging account credentials are configured. Upload, deletion, access privacy, and retention were not tested against the provider. |
| Payments | `.env` Razorpay key ID is test-mode and its secret is configured, but outbound test API returned a network error without a response. No charge was initiated; result of the create-order request is indeterminate. Webhook signing secret is absent. |
| Health, logging, monitoring, rollback | Local health/readiness behavior verified. App logs to stdout/stderr with URL redaction but no structured external sink, retention, error monitoring, alerting, CI/CD, or rollback procedure is configured. The app serves HTTP; the selected platform must terminate HTTPS. Configure Express `trust proxy` only after the proxy hop count/platform is known so rate-limit client IPs remain correct. |
| Legal/contact pages | No verified privacy, terms, return/refund, shipping, or seller contact policy evidence in the runtime app. Seller-specific delivery terms are not enforced by checkout. |

### Hosting decisions still required

- Choose the static frontend host and Node API host, their regions/runtime versions, and whether they share an origin or use separate HTTPS domains.
- Assign real staging and production DNS names; define TLS termination, API routing, SPA fallback, health probe paths, and the exact trusted proxy hop count.
- Choose a managed MongoDB provider/tier/region and replica-set topology. Define VPC/private endpoint or IP allowlist, application and migration users/roles, encryption, backup/PITR, retention, and database connection limits.
- Choose the secret manager, CI/CD identity, deployment approval and rollback path, log retention/sink, metrics/error monitoring, alert routes, and incident/support owner.
- Decide whether the order-expiry worker and process-local SSE are acceptable on one API instance. Multiple API replicas would run a worker per process and do not share SSE events; use a singleton/lock or dedicated worker before horizontal scaling.

## F. Launch blockers

1. **P1 — Hosting and production-like database architecture are undecided.** Select frontend/backend hosts, domains, TLS/proxy topology, managed Mongo tier/region/replica set, private network/IP allowlist, least-privilege DB users, and secret manager. Local tests do not establish these controls.
2. **P1 — Managed recovery and operational controls are unverified.** A synthetic logical restore passed, but configure encrypted backups/PITR, retention, monitoring/alerts, incident owner, RPO/RTO, and exercise restore/rollback on the selected managed staging service.
3. **P1 — Provider test paths are incomplete.** Configure authorized staging Resend and Cloudinary accounts and Razorpay test webhook credentials; exercise delivery, upload/delete, signature, duplicate event, failure, and payment-state behavior. Razorpay order-create had no network response; no payment was initiated.

There are no confirmed P0 runtime vulnerabilities from the local evidence collected so far. Passing local tests do not rule out environment-specific cross-tenant risks in the production deployment.

## Remediation completed during this audit

| Finding | Change | Verification |
|---|---|---|
| Security integration suite could delete whole collections and auto-run on any open Mongo connection | `security.test.js` uses the model-bound Mongoose singleton, explicit opt-in, URI/database/host confirmation, staging/test DB name/user (or guarded local Mongo), writable replica-set topology, and exact write marker; fixture cleanup includes notifications | Seven guarded security cases passed; post-run DB counts confirmed no test documents remained. |
| Price-tampering test expected rejection even though checkout correctly prices from the persisted product | Regression verifies order placement at server price, persisted line/total, and stock deduction | Passed in guarded security and full server suite. |
| Staging tenant suite omitted some A/B and stock cases | Added billing-status separation, forged seller IDs, invalid quantities, and insufficient-stock non-mutation assertions | 12/12 staging suite tests passed, including all 9 DB cases. |
| CORS denied origins were surfaced as internal-server errors | CORS rejection now carries HTTP 403; readiness regression test asserts denied origins get no `Access-Control-Allow-Origin` header | Full server suite passed with the additional assertion; local configured-origin probe allowed only the staging HTTPS origin. |
| No repeatable safe local recovery drill was available | Added opt-in `server/scripts/backup-restore-drill.js`; it restricts the target to confirmed local `supplylink_staging`, refuses pre-existing drill DBs, writes synthetic fixtures, restores BSON EJSON plus indexes into a second isolated DB, verifies records, and removes only run-marked drill DBs | Drill passed for six synthetic collections; no production or managed backup service was contacted. |

## Database test prerequisites and target decision

`server/tests/staging.integration.test.js` requires all of the following before it connects or writes:

1. `RUN_STAGING_INTEGRATION=1`.
2. `STAGING_MONGODB_URI` pointing to the intended database.
3. The database name must contain a complete `staging` or `test` segment separated by `_` or `-`.
4. `STAGING_DATABASE_CONFIRM` must exactly equal that decoded database name.
5. `STAGING_HOST_CONFIRM` must exactly equal the URI host (lowercase, including port if present).
6. For remote MongoDB, the username must contain `staging` or `test`; the exception is unauthenticated `localhost`, `127.0.0.1`, or `::1` on port 27017.
7. The database must contain `_supplylink_staging_test_guard` document `_id: staging-integration-target` with `environment: staging`, exact `database` and `host`, and `allowTestWrites: true`.

`server/tests/security.test.js` requires `RUN_SECURITY_INTEGRATION=1`, `STAGING_MONGODB_URI`, `SECURITY_DATABASE_CONFIRM`, and `SECURITY_HOST_CONFIRM`. It opens the model-bound Mongoose connection itself, then requires a database name containing a complete `staging`/`test` segment, exact URI host/database confirmations, writable replica-set/sharded topology, and matching write marker. Remote targets require staging/test usernames; unauthenticated local Mongo on port 27017 is allowed only with all other checks. Cleanup is fixture-scoped, including order notifications.

The `server/.env` SRV target had no explicit database path and a username not identifying staging/test; it was not connected. Docker CLI is unavailable, but a separately running local MongoDB service was independently connected read-only first and verified as `localhost:27017`, database `supplylink_staging`, replica set `rs0`, writable primary. Its exact marker was verified before tests. Guarded runs used `RUN_STAGING_INTEGRATION=1`, `RUN_SECURITY_INTEGRATION=1`, `STAGING_MONGODB_URI=mongodb://localhost:27017/supplylink_staging?replicaSet=rs0`, both database confirmations as `supplylink_staging`, and both host confirmations as `localhost:27017`; variables were removed immediately afterward. Final read-only counts showed zero documents in application collections and only the exact guard marker. This local evidence does not verify production.

The application uses MongoDB transactions (`withTransaction`) for order placement, cancellation/restock, product plan-limit changes, manual payment confirmation, and subscription writes. Local `rs0` transaction tests passed; configured SRV/production topology was not checked. No transaction claim is made for a deployment until its topology is verified.

## Seller-owned data access trace

| Data/operation | Code-level ownership evidence | DB verification |
|---|---|---|
| Products and inventory | Reads/updates/deletes include `_id` and `sellerId: req.user.userId`; create writes that authenticated ID after payload spread | Local staging test passed read/edit/stock isolation, forged seller ID on create, concurrent decrement and oversell rejection |
| Orders and payment proof | Seller list/status/proof queries include authenticated seller ID; public checkout derives seller from published slug and server loads product under that seller; tracking/proof endpoints require high-entropy bearer tokens | Local tests passed order list/status, checkout, duplicate, cancellation/restock and failure rollback; live proof upload/provider path not exercised |
| Customers, analytics, dashboard | Order reads filter by authenticated seller ID; aggregates are derived from those orders | Local A/B overlapping-contact metrics and seller-scoped API tests passed; unbounded read size remains a capacity risk |
| Notifications | List/read/update/delete filters use authenticated seller ID; order notifications are created for seller from order context | Local A/B read/update/delete isolation and transaction rollback tests passed |
| Store settings/profile | Read/write uses authenticated user ID; global unique slug check only checks collisions, public store is resolved by slug | Local forged seller ID/settings and public serialization checks passed; public output excludes phone and WhatsApp |
| Subscription/billing | Status filter uses authenticated user; checkout lookup matches both provider order ID and authenticated seller; webhook resolves seller from server-created checkout/payment records | Local billing-status A/B separation passed. Payment checkout/webhook persistence and provider callbacks were not exercised |
| Background jobs/webhooks | Expiry job acts on eligible pending records and restocks via order seller ID; email events reconcile provider message IDs; Razorpay events resolve persisted checkout/payment IDs | Static trace only; no scheduled job or external provider event was triggered |

## G. Residual risks

- A local green suite does not establish database isolation, operational recovery, or real provider behavior.
- Dashboard, customer, and order routes read all seller records into memory; large tenants can exhaust memory or become slow.
- In-process SSE loses events across multiple backend instances and has no durable replay.
- The order-expiry timer starts in every API process; horizontal scaling needs one worker or a distributed lock to avoid duplicate worker execution.
- No automated deletion/retention lifecycle for seller accounts/customer PII was found; only payment screenshot retention cleanup is implemented.
- No E2E coverage proves the complete registration-to-order lifecycle in a real browser.
- Browser JWT storage exposes sessions to same-origin script injection; production CSP and XSS review remain important.
- Frontend bundle includes a 483 KB main JS chunk and a 337 KB chart chunk before gzip; mobile performance needs measurement.

## Finding register

| ID | Severity | Finding | Evidence / next action |
|---|---|---|---|
| P1-1 | P1 | Hosting and production-like database architecture are undecided | Choose hosts/domains/proxy/TLS and managed Mongo topology/network/roles; then rerun tenant and transaction checks there. |
| P1-2 | P1 | Managed recovery and operational controls remain unverified | Synthetic EJSON drill passed; managed encrypted backup/PITR, retention, alerts, RPO/RTO and service restore remain untested. |
| P1-3 | P1 | Staging provider paths are incomplete | Resend/Cloudinary credentials absent; Razorpay test call had no response and webhook secret absent. Run provider checks once staged credentials/network are ready. |
| P2-1 | P2 | Bearer token is stored in browser localStorage | Review XSS/CSP controls; consider an HttpOnly secure session design. |
| P2-2 | P2 | Password reset/account recovery is not implemented | Add a verified, revocable reset flow before broad seller onboarding. |
| P2-3 | P2 | Orders, dashboard, and customer data are loaded without pagination | Add bounded seller-scoped queries and aggregate data in MongoDB. |
| P2-4 | P2 | Seller/customer record deletion and customer PII retention are not defined | Define and implement deletion/retention policy. |
| P2-5 | P2 | SSE uses process-local EventEmitter and only updates public catalog | Use shared event delivery or describe updates as single-instance; add seller-side live refresh if required. |
| P2-6 | P2 | Paid plans are one-time checkouts rather than auto-renewing subscriptions | State the billing model clearly and add renewal/cancellation lifecycle only if promised. |
| P2-7 | P2 | Supply Link does not collect seller-to-customer payments | Keep customer payment claims limited to COD or seller-managed payment/proof flows. |
| P2-8 | P2 | Shipping, returns, privacy, and terms information was not verified in the customer flow | Publish seller/platform policies appropriate to launch markets. |
| P2-9 | P2 | Browser E2E, accessibility, and mobile performance have not been measured | Add staging browser coverage and accessibility/performance checks. |
| P2-10 | P2 | Dependency advisory audit was blocked by network access | Run lockfile audits in CI with a reachable npm advisory service. |
| P3-1 | P3 | Three frontend lint warnings remain | Resolve or justify the Toast, Customers, and Storefront warnings. |

## H. Prioritized action plan

1. Select and document the frontend host, Node API host, DNS names, HTTPS termination, reverse-proxy hop count, SPA fallback, runtime/region, deploy pipeline, and rollback method.
2. Provision a separate production-like managed Mongo staging cluster with replica-set transactions, private networking/IP allowlist, a database-scoped least-privilege application user, and a separate migration identity. Do not use the unverified `.env` SRV target.
3. Fill `server/.env.staging.example` and `client/.env.staging.example` in the host secret/build manager with real staging-only values; use separate test-job credentials for the gated DB suites. Confirm exact CORS origin, HTTPS URLs, readiness probe, and stdout log forwarding.
4. Run the guarded tenant/order suite and index migration against that staging cluster after confirming target name, host, marker, and topology.
5. Configure authorized staging-only Resend, Cloudinary, and Razorpay test accounts/webhooks. Test provider failures, delivery callbacks, upload/delete/privacy, signed and duplicate webhooks, refunds, and payment-state reconciliation without sending to real customers or charging live payments.
6. Configure managed encrypted backups/PITR and retention. Execute a restore into a separate managed staging cluster, verify users/products/orders/payments/notifications and indexes, and record RPO/RTO. Define index migration and rollback behavior.
7. Add uptime/error monitoring and alerts; configure restricted log retention and incident/support ownership. Verify CORS, security headers, proxy IP/rate limits, secrets access, and PII redaction in the selected host.
8. Resolve dependency advisories from a network-enabled CI runner; resolve or justify the three lint warnings.
9. Close existing privacy/security/capacity risks: define PII deletion/retention, publish privacy/terms/shipping/returns policies, review localStorage/XSS/CSP, and bound/paginate seller data queries.
10. Run browser E2E, accessibility, and mobile performance checks on the real staging URLs. Approve a limited cohort only after provider, recovery, monitoring, rollback, and incident ownership all pass.

## I. Release checklist

### Local verification

- [x] Server tests and client tests passed locally (72 server + 19 client, zero skipped).
- [x] Client production build completed.
- [x] Client lint exited 0; three warnings remain.
- [x] Scope security test cleanup to fixtures and require explicit disposable-database confirmation/marker.
- [x] Validate platform-neutral staging env template: required keys present, HTTPS URLs, test-only Razorpay key placeholder, integration-test settings excluded from app runtime.
- [x] Local health/readiness/CORS and production HTTPS-origin guard checks passed.
- [x] Run synthetic BSON EJSON backup/restore drill with business-record and index verification.
- [ ] Resolve dependency audit from a reachable advisory service.

### Staging verification

- [x] Verify exact disposable local Mongo host/database, writable `rs0` replica set, and test-write marker.
- [x] Run guarded staging and security integration suites locally (12/12 and 7/7 passed, zero skipped).
- [ ] Verify the intended staging/production-like Mongo host, database, dedicated user, topology, and marker.
- [ ] Choose and configure the actual staging hosting platform, domains, proxy/TLS, secret store, log sink, and deploy/rollback path.
- [ ] Verify full seller and customer workflows from separate browser sessions.
- [ ] Verify provider test-mode email, image, and Razorpay webhook paths.

### Security validation

- [x] Run two-tenant API tests across implemented seller-owned resources and altered IDs/inputs on local staging Mongo.
- [ ] Repeat security tests against the intended production-like staging deployment.
- [ ] Review rate limits, CORS, CSP/security headers, token handling, and PII retention.
- [ ] Confirm no secret or customer PII appears in logs or frontend bundles.

### Production configuration and recovery

- [ ] Configure HTTPS domain, SPA fallback, API proxy, secrets, least-privilege Mongo access, and separate production credentials.
- [ ] Configure uptime/error monitoring and alerts.
- [ ] Configure and verify managed backup schedule, retention, encryption, and a managed restore drill.
- [x] Synthetic local logical backup/restore drill; managed backup/PITR restore still pending.
- [ ] Review migration/rollback procedure before any production schema/index change.

### Controlled beta and rollback

- [ ] Define a limited seller cohort and support/incident owner.
- [ ] Monitor authentication, checkout, order/stock consistency, provider delivery, database capacity, and errors.
- [ ] Document release rollback and stop-order procedures; expand only after observed stable operation.

## Evidence notes

- Git status showed numerous pre-existing modified and untracked files, including application code, tests, and checklists. They were treated as user work and were not reverted.
- No staged changes were present. Existing changes and unrelated untracked files were preserved.
- `server/.env` was parsed without printing credentials. Its Mongo URI metadata did not identify an eligible test database and was not used. No Resend or Cloudinary credentials were used; the configured Razorpay test-mode credentials were used for one test-order request only.
- Docker CLI is unavailable. A separately running Mongo service was verified directly with a read-only `hello` and marker query before allowing test writes: `supplylink_staging`, `localhost:27017`, writable primary in replica set `rs0`.
- Final exact server test command (run in `server`, with environment variables set immediately before it and removed immediately after): `$env:RUN_SECURITY_INTEGRATION='1'; $env:RUN_STAGING_INTEGRATION='1'; $env:STAGING_MONGODB_URI='mongodb://localhost:27017/supplylink_staging?replicaSet=rs0'; $env:SECURITY_DATABASE_CONFIRM='supplylink_staging'; $env:SECURITY_HOST_CONFIRM='localhost:27017'; $env:STAGING_DATABASE_CONFIRM='supplylink_staging'; $env:STAGING_HOST_CONFIRM='localhost:27017'; npm.cmd test -- --reporter=dot`. Result: 18 files passed, 72 passed, 0 skipped, 0 failed.
- Final client commands: `npm.cmd test -- --reporter=dot` (6 files, 19 passed), `npm.cmd run build` (2,980 modules), and `npm.cmd run lint` (exit 0, same three warnings); final backend test was the guarded command above (18 files, 72 passed), and `rg --files src scripts -g '*.js' -g '!**/node_modules/**'` plus `node --check` passed 45 files.
- CORS regression is in `server/tests/readiness.test.js`: denied origins receive 403 and no `Access-Control-Allow-Origin`. A local process probe with the app model-bound Mongoose instance returned `/api/health` 200, `/api/ready` 200/database connected, allowed origin `https://staging.supplylink.example`, and denied origin 403. The initial probe using the root Mongoose singleton returned readiness 503; using the application's model-bound singleton corrected the probe setup.
- Production HTTPS startup guard: with `NODE_ENV=production`, `CLIENT_URL=http://staging.invalid`, the local staging URI, and a local-only valid-length `JWT_SECRET`, `node src/server.js` exited 1 with `Production CLIENT_URL must contain the HTTPS frontend origin(s).` before attempting a database connection.
- Staging config static validation parsed both `.env.staging.example` files without displaying values. Required variable names, HTTPS URL schemes, and separation of integration-test variables passed; 13 URI/secret placeholders and `.example` domains remain. The template is not deployable until the platform and actual staging services are selected.
- Backup command in `server`: `$env:RUN_BACKUP_RESTORE_DRILL='1'; $env:BACKUP_RESTORE_DRILL_URI='mongodb://localhost:27017/supplylink_staging?replicaSet=rs0'; $env:BACKUP_RESTORE_DATABASE_CONFIRM='supplylink_staging'; $env:BACKUP_RESTORE_HOST_CONFIRM='localhost:27017'; node scripts/backup-restore-drill.js; $code=$LASTEXITCODE; Remove-Item Env:RUN_BACKUP_RESTORE_DRILL,Env:BACKUP_RESTORE_DRILL_URI,Env:BACKUP_RESTORE_DATABASE_CONFIRM,Env:BACKUP_RESTORE_HOST_CONFIRM -ErrorAction SilentlyContinue; exit $code`. Result: PASS; one synthetic user, seller, product, order, subscription payment, and notification restored; key values, dates, and indexes verified; archive was 6,844 bytes; source/restore test databases and temp archive were removed.
- Mongo index/topology check used read-only `hello`, `listIndexes`, and `countDocuments` against local test DB. It reported writable `rs0`, expected user/session/seller/product/order/webhook/payment/notification indexes, zero application documents, and one marker. The uncontacted SRV target remains unknown.
- Razorpay probe sent `POST https://api.razorpay.com/v1/orders` for 100 paise INR with a unique synthetic receipt, test-mode credentials loaded from `.env`, and a 10-second timeout. Node fetch returned `TypeError` without HTTP status/body; no payment/charge endpoint was called. Remote test-order creation remains indeterminate. Resend/Cloudinary credentials and Razorpay webhook secret were absent.
- Staging cleanup reported removal of 2 users, 2 sellers, 5 products, 12 notifications, 2 sessions, and 7 orders. Security cleanup was extended to notifications after a read-only residue check found four earlier audit-generated notifications; those exact four records were removed only after revalidating the database marker. Final read-only counts again showed zero application documents and one guard document; no backup-drill database or temporary archive remained.
- Test iteration history: the first staging attempt timed out because test and model imports used separate Mongoose singletons; tests now use the model-bound singleton. The next attempt exposed three fixture/test expectation failures (the Free-plan fixture hit its product cap in two cases, and an accepted checkout reduced stock before a later assertion); the fixture now uses an active Launch plan and the checkout case cancels/restores stock before later assertions. The final guarded suite and subsequent full server suite both passed with zero failures.
- Provider credential presence was checked without printing values: Resend/Cloudinary keys and Razorpay webhook secret are absent; a Razorpay test-mode key ID/secret are configured in `server/.env`. A single test-mode create-order request returned a network `TypeError` with no HTTP response. No customer email, image operation, payment/charge, production deployment, or live infrastructure change was performed. npm advisory audit remains blocked by the previously unreachable endpoint and was not retried because reachability recovery was not established.
