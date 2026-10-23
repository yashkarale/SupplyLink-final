# Supply Link staging deployment plan: Render + MongoDB Atlas

**Status:** Preparation only. No Render or Atlas resources have been created or changed. No DNS, credentials, or provider APIs were touched.

This plan describes a staging-only deployment. It does not authorize a production deployment. Complete the dashboard steps in order at the end of this document.

## 1. Repository facts verified

| Area | Verified repository setting |
|---|---|
| Frontend | Vite + React, `client/package.json`; lockfile `client/package-lock.json`; build script `npm run build`; output directory `client/dist/`. |
| Backend | Express, `server/package.json`; lockfile `server/package-lock.json`; start script `npm start` (`node src/server.js`); runtime entry `server/src/server.js`. Use `server/` as Render Root Directory. |
| Runtime | No `.nvmrc`, `engines`, or `NODE_VERSION` pin was found. Select a Node LTS version supported by Render (recommend Node 22 LTS), pin it using Render's `NODE_VERSION` setting, and verify it against the lockfile before deploy. |
| Routes | API routes are mounted below `/api`: `/api/auth`, `/api/sellers`, `/api/products`, `/api/orders`, `/api/billing`, `/api/store`, `/api/notifications`, plus `/api/webhooks/resend` and `/api/webhooks/razorpay`. |
| Probes | `GET /api/health` is process liveness and does not query MongoDB. `GET /api/ready` returns 200 only when Mongoose is connected, otherwise 503. Use `/api/ready` for Render's HTTP health check so an instance without the database is not marked ready. |
| Client API | `VITE_API_URL` is the full API base including `/api`, for example `https://<api-service>.onrender.com/api`. Production fallback is same-origin `/api`, so set the variable when frontend and API are separate Render services. `VITE_ML_URL` is optional and should be unset for beta unless an authorized staging ML service exists. |
| Router | React uses `BrowserRouter` and client paths such as `/store/:slug`, `/track/:token`, `/dashboard`, and `/products`. Configure a Render Static Site rewrite `/*` to `/index.html` (Rewrite) for direct navigation and refresh. |
| CORS | `CLIENT_URL` is an exact comma-separated allowlist of browser origins, with scheme/host/port only, no path and no trailing slash. Set it to the exact staging Static Site origin. The API allows requests without an Origin for server-to-server/webhook use and returns 403 for unapproved browser origins. |
| Proxy trust | Express does not set `trust proxy`. Do not enable it with a guessed value. After the Render web service is provisioned, verify Render's documented proxy chain and the observed `req.ip`/rate-limit behavior. If enabling trust proxy is required, set the narrowest trusted hop/IP policy and test that a client cannot spoof `X-Forwarded-For`. Current rate limiting may see a shared proxy address; confirm before inviting a cohort. |
| Auth/cookies | Auth uses `Authorization: Bearer <JWT>` and browser `localStorage` (`supplylink_token`). Axios sets `withCredentials: true`, but there is no cookie session configuration in the inspected server code. Keep HTTPS; do not add `Access-Control-Allow-Origin: *`. JWT and credentials must stay backend-only. |
| Mongo connection | `server/src/config/database.js` calls `mongoose.connect(process.env.MONGODB_URI)`. Startup requires this variable and exits nonzero on connection failure. Set `NODE_ENV=production`; this also requires every `CLIENT_URL` entry to be HTTPS. Include the intended database name in the Atlas SRV URI path. |
| Startup/shutdown | Server listens on `PORT` (Render supplies this; do not hardcode it in Render). Node's default listen host is all interfaces. On SIGINT/SIGTERM the process stops its order-expiry timer, closes HTTP connections and disconnects Mongoose, with a 10-second forced-exit timer. Startup checks `MONGODB_URI`, `JWT_SECRET` (random, >=32 chars), and production HTTPS origins before connecting. |
| Background work | An in-process interval runs pending WhatsApp order expiration every five minutes, and SSE uses process-local events. Start only one API instance for initial beta unless order-expiry is moved behind a singleton/lock and cross-instance SSE behavior is addressed. |
| Indexes | `server/scripts/migrate.js` creates model indexes; `autoIndex` is disabled in server connection setup. Apply indexes to the empty staging DB with a reviewed `npm run migrate` run using a dedicated migration identity before launching the app. Do not point migration at production. |
| Dependencies | Both packages have committed npm lockfiles. Use `npm ci` in each service root; do not use `npm install` for the Render build. |

### Relevant code paths

- `client/package.json`, `client/package-lock.json`, `client/vite.config.js`, `client/src/services/api.js`, `client/src/main.jsx`, `client/src/App.jsx`
- `server/package.json`, `server/package-lock.json`, `server/src/server.js`, `server/src/app.js`, `server/src/config/database.js`, `server/scripts/migrate.js`
- Provider code: `server/src/services/emailService.js`, `server/src/services/mediaStorage.js`, `server/src/controllers/billingController.js`, `server/src/controllers/emailWebhookController.js`

## 2. Render settings

Create two separate services from the same repository and staging branch. Use a dedicated branch or an explicitly selected commit; avoid deploying an unreviewed worktree. Current worktree has many modified and untracked files, so first commit/review only the intended deployment-ready changes before linking auto-deploy.

### Static Site (frontend)

| Render field | Value |
|---|---|
| Name | `supplylink-staging-web` (change only if the name is unavailable) |
| Branch | Dedicated staging branch containing reviewed changes |
| Root Directory | `client` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Rewrite | Source `/*`, destination `/index.html`, action `Rewrite` |
| Environment | `VITE_API_URL=https://<actual-api-service-host>/api`; leave `VITE_ML_URL` unset unless its staging service is ready |
| Auto-deploy | Prefer manual deploy until acceptance tests pass; then enable only for the staging branch if desired |
| Custom domain | Optional staging-only domain, set only after approval; use the generated Render URL initially |

`VITE_*` values are compiled into public JavaScript and are visible to every visitor. Never put credentials, private endpoints, webhook keys, or database URIs in the Static Site environment.

### Web Service (API)

| Render field | Value |
|---|---|
| Name | `supplylink-staging-api` (change only if unavailable) |
| Branch | Same dedicated staging branch/commit as Static Site |
| Runtime | Node |
| Root Directory | `server` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/ready` |
| Instance count | One for initial staging validation; avoid horizontal scaling until the in-process worker is made singleton-safe |
| Port | Leave `PORT` to Render's provided value; server uses `process.env.PORT` |
| `NODE_ENV` | `production` (production security/runtime checks are intentionally enabled in staging) |
| `NODE_VERSION` | Pin Node 22 LTS only after confirming Render currently supports it and `npm ci` succeeds; repository does not pin a runtime |
| Logs | Retain Render stdout/stderr logs under restricted access; add alerts/retention appropriate to the beta before cohort access |
| Auto-deploy | Manual until staging acceptance; then branch-scoped if intended |

Render web services require binding the supplied port; Render currently documents `PORT` default 10000. The code's `PORT` default of 5000 applies only when Render does not set it. Render terminates public HTTPS and forwards to the service; validate the actual service URL and health path after creation. Render health checks accept 2xx/3xx and consider 4xx/5xx unhealthy. See [Render Web Services](https://render.com/docs/web-services), [Health Checks](https://render.com/docs/health-checks), [Static Sites](https://render.com/docs/static-sites), and [monorepo root directories](https://render.com/docs/monorepo-support).

### Deployment and rollback controls

- Keep staging service and Atlas cluster names clearly separate from production. Use no production `MONGODB_URI`, keys, webhook, or customer data.
- Keep auto-deploy disabled during initial verification. Deploy a known reviewed commit, record its commit SHA and Render deploy ID, then test it before directing beta users to the URL.
- Render's failed health check can prevent a new deploy from receiving traffic, but that is not a complete rollback plan. Confirm the dashboard's prior-deploy rollback action for each service. Record the prior known-good deploy IDs and rehearse rollback on staging. Roll back frontend and API to compatible versions together.
- Database index migrations are not automatically reversible. Start with an empty staging DB, back it up before later migrations, and document a forward-fix or restore path for every schema/index change.
- Before enabling a beta cohort, confirm Render's shutdown grace period exceeds the app's 10-second close timeout (or adjust service shutdown settings). Do not increase it beyond the platform limit without validation.

## 3. Environment inventory

Values below are placeholders. Enter secrets only in the API Web Service's Render secret environment interface. Never paste any secret into Git, the Static Site, issue text, this document, or build output.

### Static Site: public build-time values

| Variable | Staging value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://<actual-api-service-host>/api` | Required when separate origins are used. Must include `/api`, no trailing slash after it. Public. |
| `VITE_ML_URL` | unset | Optional public service URL only; omit until staging ML exists. |

### API Web Service: runtime values

| Variable | Staging value | Secret? | Required/behavior |
|---|---|---:|---|
| `NODE_ENV` | `production` | No | Enables secure startup checks. |
| `PORT` | Render-managed | No | Do not set manually unless required by support. |
| `MONGODB_URI` | `mongodb+srv://<staging-app-user>:<encoded-password>@<atlas-host>/supplylink_staging?retryWrites=true&w=majority&appName=supplylink-staging` | Yes | Atlas URI with exact DB name `supplylink_staging`; do not use a URI without the DB path. Keep URI password URL-encoded. |
| `JWT_SECRET` | Unique random staging-only value, >=32 characters | Yes | Generate/store directly in Render; never reuse local, staging, or production secrets. |
| `JWT_EXPIRES_IN` | `1d` | No | Existing default is one day. |
| `CLIENT_URL` | `https://<actual-static-site-host>` | No | Exact browser origin; comma-separated only if multiple approved staging origins are required. |
| `API_PUBLIC_URL` | `https://<actual-api-service-host>` | No | Public API origin, no `/api`; used to construct public payment-proof URLs. |
| `APP_BASE_URL` | `https://<actual-static-site-host>` | No | Email verification and tracking links. |
| `MONGODB_ORDER_WRITE_LIMIT_MB` | `256` | No | Existing template value; valid range 64–511. Reconfirm against the chosen Atlas tier/storage budget. |
| `RESEND_API_KEY` | `<staging-only Resend API key>` | Yes | Required to send verification/order email. Use verified staging sender only. |
| `RESEND_WEBHOOK_SECRET` | `<staging Resend webhook signing secret>` | Yes | Only when setting up the Resend webhook; endpoint `/api/webhooks/resend`. |
| `EMAIL_FROM` | `Supply Link Staging <staging@<verified-sender-domain>>` | No | Sender domain must be verified with the email provider. Restrict test recipient addresses/provider account as possible. |
| `CLOUDINARY_CLOUD_NAME` | `<separate-staging-cloud-name>` | No | Use a separate staging Cloudinary account/cloud. |
| `CLOUDINARY_API_KEY` | `<staging-cloudinary-api-key>` | Yes | API service only. |
| `CLOUDINARY_API_SECRET` | `<staging-cloudinary-api-secret>` | Yes | API service only. |
| `RAZORPAY_KEY_ID` | `rzp_test_<staging-key-id>` | Public-ish identifier; API only | Use a Razorpay test-mode account/key. Server returns the key ID to the frontend when checkout is created. Never use `rzp_live_`. |
| `RAZORPAY_KEY_SECRET` | `<staging-test-key-secret>` | Yes | API server only. |
| `RAZORPAY_WEBHOOK_SECRET` | `<staging-test-webhook-secret>` | Yes | Required for webhook verification at `/api/webhooks/razorpay`; keep distinct from API key secret. |

`STAGING_MONGODB_URI`, `RUN_STAGING_INTEGRATION`, `STAGING_DATABASE_CONFIRM`, `STAGING_HOST_CONFIRM`, and the analogous security-test variables are test-runner controls. Do not set them on the deployed API. The app needs `MONGODB_URI` only. Render's `PORT` is platform-managed.

The checked-in `server/.env.staging.example` currently does not include `RAZORPAY_WEBHOOK_SECRET`; add it in the Render dashboard as a secret when using the webhook. No secret value belongs in the example file. `server/.env.staging.example` and `client/.env.staging.example` are templates, not complete deployment configuration.

## 4. Atlas topology, access, indexes, transactions, and recovery

### Database plan

1. Create a dedicated Atlas **project and cluster for staging**, isolated from production. Pick a region close to the Render API region after deciding where beta data may be stored. Select a cluster tier that provides the required replica-set/transaction support, backups, and acceptable capacity; confirm current tier features and pricing in Atlas before selecting. Never assume a standalone server supports transactions. MongoDB multi-document transactions require a replica set or sharded cluster; Supply Link order creation, cancellation/restocking, payment state changes, and notification persistence use transactions. See [MongoDB transaction requirements](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/).
2. Configure Atlas Network Access only after the Render API service exists. Prefer a supported private connectivity path if available for the chosen plans. Otherwise add only the outbound IP/CIDR ranges Render documents for that API service/region. Do not use `0.0.0.0/0` as a permanent rule. If Render's usable egress ranges are broad/shared or cannot satisfy the intended boundary, stop and choose a network plan before continuing. Revisit egress ranges when the Render region/plan changes. Atlas only accepts connections from trusted IP entries; see [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).
3. Create separate database users. The runtime user should have read/write access scoped to `supplylink_staging` only. Do not grant `atlasAdmin`, `readWriteAnyDatabase`, or project-owner privileges to the app. Run `npm run migrate` with a separate short-lived migration identity, then remove/rotate that identity. Validate the exact privileges needed for `createIndexes` against a disposable staging target first; grant only database-scoped index privileges required. Atlas supports restricting users to specific resources and custom roles; see [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
4. Build an SRV connection string using the `supplylink_staging` database path and least-privilege staging user. Set `retryWrites=true&w=majority`; keep TLS enabled (Atlas SRV defaults use TLS unless explicitly disabled). URL-encode reserved characters in credentials. Verify the final connection from the deployed API without logging the URI.
5. Review indexes with `npm run migrate` before deploying app traffic. Current migration creates indexes for users, auth sessions, sellers, products, orders, email webhook events, subscription payments/checkouts, Razorpay webhook events, and notifications. Test uniqueness conflicts and index build time on staging. Do not invoke this command against any production URI.

### Backups and isolated restore

- Choose an Atlas tier/backup configuration that explicitly provides the desired automated backup and point-in-time recovery features. Decide recovery point objective (RPO), recovery time objective (RTO), retention, encryption/access policy, and alert owner before beta. Feature availability varies by cluster tier; verify the chosen tier in Atlas. Atlas restore supports managed restore jobs for eligible tiers; see [Atlas backup/restore](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).
- Enable and verify the Atlas backup schedule before storing test data that matters. Record the backup timestamp and retention window.
- Drill: create/restore a backup into a **separate isolated staging restore cluster or database**, never over the active staging cluster; use a distinct restore identity, restrict network access, and do not use production/customer records. Verify representative user, seller, product, inventory, order, subscription payment, notification, webhook-idempotency records and required indexes. Validate business invariants (seller ownership, order totals/status, product stock) with read-only queries; measure RPO/RTO; then remove the isolated restore target only after retaining the evidence and checking the target name twice.
- Prior audit evidence only establishes a synthetic local BSON/EJSON logical restore. It is not evidence of Atlas backup or restore behavior. Atlas managed backup/restore remains an explicit launch acceptance gate.

## 5. Provider configuration and safe acceptance

Use provider-owned staging/test accounts and synthetic addresses/data only. Do not contact real customers, create live charges, use production keys, or share credentials in tickets/logs. Set the webhook URLs to the Render API staging origin and exact routes. Use valid provider signing secrets and verify signatures; never disable signature checks.

| Integration | Staging setup | Acceptance |
|---|---|---|
| Email (Resend) | Verified staging sender/domain; test API key; `APP_BASE_URL` points to staging web; signed webhook secret configured if webhook events are enabled. | Send a verification email only to an owned test inbox; inspect link host, expiry, redacted logs, event signature/replay handling, provider failure and retry behavior. Validate order email idempotency on a synthetic order. |
| Images (Cloudinary) | Separate staging cloud/account and API credentials; use synthetic PNG/JPEG fixtures and staging folder. | Upload product image and seller QR; confirm only expected public product image is public, payment proof uses authenticated/private delivery; verify replacement/deletion and retention cleanup; test invalid MIME, oversized/dimensions, storage outage, and no credential leakage. |
| Billing (Razorpay) | Test-mode key ID/secret, distinct webhook signing secret, dashboard test mode, webhook to `/api/webhooks/razorpay`. | Create test order, complete only provider test-mode flow, verify server-side signature and fetched order/payment, subscription entitlement, signed webhook event, duplicate event idempotency, invalid signature, failed payment, refund/state transition, and event replay. Confirm no live key, real charge, or production webhook. |

Current audit says Resend/Cloudinary credentials and Razorpay webhook secret are unavailable; a previous Razorpay test-mode order-create request had no HTTP response. Provider tests remain blocked until staging credentials and outbound network are deliberately configured.

## 6. Staging acceptance test plan

Run these against staging after the UI and API deploys and the Atlas marker/topology have been verified. Use two separately registered synthetic seller accounts (A/B), synthetic customer addresses, distinct browser profiles, and test-only provider accounts. Do not put security integration-test variables on the Render API. The local guarded tests may be run from a secured operator workstation only after confirming the exact staging Atlas target, marker, credentials, replica-set topology and write scope; do not point destructive test cleanup at production.

1. **Health and transport:** `curl.exe -i https://<api-host>/api/health`; `curl.exe -i https://<api-host>/api/ready`; verify both serve HTTPS, health is 200, ready is 200 with `database: connected`, and Render deploy health check is green. Check the Static Site root and direct-refresh `/store/<slug>`, `/track/<token>`, `/login`, `/dashboard` routes.
2. **CORS/auth:** From the exact staging origin, verify API calls succeed; from a disallowed origin verify 403 and absent `Access-Control-Allow-Origin`. Register/login A and B; check email verification; verify bearer token use, expiration/logout revocation, HTTPS only and rate limit behavior from distinct clients. Confirm proxies/rate limiter see genuine client addresses.
3. **Tenant isolation:** As A and B create distinct products, inventory, orders, customers, notifications, store settings and subscription status. Attempt cross-tenant IDs on read/update/delete/analytics/billing routes; every access must return no foreign data/no mutation. Verify public store exposes intended catalog/store fields only and omits seller/private data.
4. **Products/images:** Upload valid product images/QR in staging; verify saved URL/delivery modes and ownership; reject invalid/oversized/malformed images; replace/delete and verify Cloudinary cleanup. Ensure payment proof image is private and signed download expires.
5. **Orders/inventory:** Create order from public storefront; manipulate submitted price and quantity; issue duplicate request ID concurrently; race two buyers for last stock; test insufficient inventory, invalid quantity, process/provider failure and cancellation/restock. Assert server-derived prices, exactly-once stock deduction/restoration and no orphan order/notification after transaction abort. Re-run on the deployed Atlas topology; local replica-set evidence does not transfer automatically.
6. **Analytics/customers/settings:** Verify each seller's totals and customer list include only their own persisted orders; update store settings and ensure public serialization is limited. Test pagination/volume risk is still open; keep beta data/volume small.
7. **Email and webhooks:** Run the provider tests above; replay same event and confirm no duplicate state change; invalid signatures must be rejected. Use a test inbox owned by the operator.
8. **Payment:** Test mode only. Confirm no entitlement on pending/failed payment; confirm only verified captured test payment changes plan; duplicate event/verification must be idempotent; test refund/failure transitions and ensure webhook payload/signature are not logged.
9. **Recovery/operations:** Complete Atlas isolated restore and record RPO/RTO. Trigger a Render staging rollback to a prior known-good deploy; verify service health and data compatibility. Review logs for credentials, JWTs, customer email/phone, proof tokens, and payment details. Verify monitoring/alerts and owner response path.

### Local verification commands

From PowerShell at the repository root (these are local checks; the guarded DB suites need the explicit disposable DB variables documented in `STARTUP_READINESS_AUDIT.md` and are not implicitly enabled here):

```powershell
Push-Location server
npm.cmd ci
npm.cmd test -- --reporter=dot
Pop-Location

Push-Location client
npm.cmd ci
npm.cmd test -- --reporter=dot
npm.cmd run build
Pop-Location
```

After staging deploy, probe using the actual generated API URL:

```powershell
curl.exe -i https://<api-service-host>/api/health
curl.exe -i https://<api-service-host>/api/ready
```

Expected: both `200`; `/api/ready` JSON says `checks.database` is `connected`. Also inspect browser Network panel and Render logs; do not copy tokens or secrets into evidence.

## 7. Unresolved blockers

- **No Render services/branch/domains exist yet.** Actual generated hostnames, Node runtime selection, deployment success, HTTPS, rewrite, CORS, proxy/rate-limit behavior, logs, health checks and rollback are unverified.
- **No verified staging Atlas project/cluster is selected.** Tier, region, transaction support, network path/egress allowlist, users/roles, SRV URI, indexes, and connection limits remain to be configured and tested.
- **The API staging template lacks `RAZORPAY_WEBHOOK_SECRET`.** Add it only as a dashboard secret if test webhooks are part of acceptance. The existing example file is not a complete inventory.
- **Provider credentials/tests remain incomplete.** Resend, Cloudinary and Razorpay staging/test credentials, sender verification and webhook signing configurations are prerequisites.
- **Managed Atlas backup/restore, Render rollback rehearsal, monitoring/alerts, and incident ownership remain unverified.** The prior local synthetic restore does not close this blocker.
- **Proxy trust and shared-IP rate limiting need deployed observation.** Do not broaden trust without testing spoofed forwarding headers.
- **The current repository worktree includes many modified and untracked files.** No Render auto-deploy should be connected to the branch until you have reviewed/committed only intended work and chosen a controlled deploy commit.

The staging launch stays **NO-GO** until the staging services and Atlas target are deployed, acceptance checks pass, backup restore and rollback are demonstrated, provider test paths work, and an operator/support owner is assigned.

## 8. Manual dashboard steps (in order)

1. **Review and prepare source control.** Inspect the existing Git diff (including untracked files), preserve existing work, and commit only the reviewed staging-ready source and this plan to a dedicated staging branch. Do not attach Render to an unreviewed dirty worktree. Choose the staging region and confirm data residency requirements.
2. **Atlas: create isolation boundary.** In MongoDB Atlas, create a staging-only project and cluster, choose a region near the future Render API, and select a tier only after confirming transactions plus the backup/restore features required for beta. Set cluster name to identify staging. Do not import production/customer data.
3. **Render: create API Web Service without credentials first.** Connect the repo/branch; set name `supplylink-staging-api`, Runtime Node, Root Directory `server`, Build `npm ci`, Start `npm start`; initially leave deploy paused/manual and set health check `/api/ready`. Pin a supported Node LTS version. Wait until Render shows the service and outbound network ranges; do not add permissive Atlas access rules.
4. **Atlas: restrict network and create users.** Prefer supported private connectivity; otherwise add only Render's applicable outbound IP/CIDR ranges for that service/region. Create app DB user scoped to `supplylink_staging` with only runtime read/write. Create a separate temporary migration user with only required DB-scoped index privileges. Store credentials in a password manager and URL-encode any URI-reserved characters. Do not use production users.
5. **Atlas: prepare database and migration.** Build a staging SRV URI whose path is `/supplylink_staging`. From a controlled operator shell, connect using the temporary migration identity; verify hostname, DB name, cluster topology and staging isolation before running `npm run migrate` from `server/`. Confirm indexes, then revoke/rotate the migration identity. Never run this against a production URI.
6. **Render: add API environment secrets/settings.** Add `NODE_ENV=production`, Atlas `MONGODB_URI`, fresh unique `JWT_SECRET`, exact `CLIENT_URL`, exact `API_PUBLIC_URL`, exact `APP_BASE_URL`, `JWT_EXPIRES_IN=1d`, and `MONGODB_ORDER_WRITE_LIMIT_MB=256`. Add staging-only Resend/Cloudinary/Razorpay secrets only when prepared. Do not set test-runner variables. Ensure all origins are HTTPS and no credential is in a `VITE_` variable.
7. **Deploy API to staging.** Trigger a manual deploy for the reviewed commit. Confirm build/runtime Node version, healthy `/api/ready`, connected DB, startup failure behavior, SIGTERM graceful shutdown, and restricted logs. Confirm actual request IP/rate limiting through Render proxy before opening access. If any health/database check fails, stop and fix staging; do not broaden Atlas access or disable security guards as a workaround.
8. **Render: create Static Site.** Connect the same reviewed branch/commit; name `supplylink-staging-web`, Root Directory `client`, Build `npm ci && npm run build`, Publish `dist`; set `VITE_API_URL` to `https://<actual-api-host>/api`, leave `VITE_ML_URL` unset; add rewrite `/*` → `/index.html` (Rewrite). Deploy manually.
9. **Connect exact origins and verify.** Update API `CLIENT_URL` to the actual Static Site origin (or approved staging custom domain) and redeploy API. Set `APP_BASE_URL` to that same web origin and `API_PUBLIC_URL` to API origin. Probe health/readiness, CORS allowed/denied, direct SPA routes, static assets and all webhook paths.
10. **Configure provider test dashboards.** Verify an owned staging sender domain with Resend, use a separate Cloudinary staging cloud, and enable Razorpay test mode. Create webhook endpoints with their exact signing secrets and HTTPS API URLs. Add those secrets only to the API service; test only with owned inboxes/synthetic assets/Razorpay test mode.
11. **Configure Atlas backup and drill.** Enable the selected cluster's managed backup schedule/retention; document RPO/RTO and alert ownership. Restore a backup into a separate isolated staging target, verify records/indexes/invariants, and record restore time. Do not restore over the active cluster.
12. **Acceptance, rollback, then limited beta decision.** Run every acceptance category in section 6 with two synthetic sellers, perform a Render rollback rehearsal on staging, confirm monitoring/log controls and incident owner, record commit/deploy IDs and evidence in the readiness audit. Only then make a separate go/no-go decision for a limited cohort. No production deploy or DNS change is part of these steps.

## External platform references

- Render [Static Sites](https://render.com/docs/static-sites), [Web Services](https://render.com/docs/web-services), [Health Checks](https://render.com/docs/health-checks), [Environment Variables and Secrets](https://render.com/docs/configure-environment-variables), [Monorepo Support](https://render.com/docs/monorepo-support)
- MongoDB [Transactions](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/), [Atlas Database Users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/), [Atlas IP Access List](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/), [Atlas Backup/Restore](https://www.mongodb.com/docs/atlas/backup-restore-cluster/)
