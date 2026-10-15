# Supply Link complete guide

Audit date: 2026-10-15. This guide describes the checked-in implementation, not a claim that an external deployment is live.

## Product and architecture

Supply Link is a seller storefront and operations app for small businesses and social sellers. Sellers register, create a single seller profile/store, manage products and orders, share a public `/store/:slug` page, contact buyers on WhatsApp, and may pay for a Supply Link plan. Buyers can browse a published catalog, send a WhatsApp inquiry, or submit a separate persisted order and track its status. Supply Link's configured revenue model is seller plans; sellers' merchandise sales are not platform revenue. AI add-on revenue is not implemented.

The frontend is JavaScript with React 19, React Router, Vite, Tailwind CSS, Axios, and Recharts. The API is JavaScript on Node.js and Express 5, with Mongoose models in MongoDB. JWT bearer tokens protect seller routes. A separate optional ML URL is referenced by the client; this repository does not contain or verify that service. Subscription checkout uses Razorpay one-time orders and signature/order verification; automatic recurring billing and webhooks are absent.

## Important file map

| File or folder | Responsibility and dependencies | If changed incorrectly |
|---|---|---|
| `client/src/main.jsx`, `client/src/App.jsx` | React boot and routes; lazy-loads pages and layouts. | App entry or public/seller routes fail. |
| `client/src/services/api.js` | Axios API calls, auth token, public store/order requests, SSE, contact URL construction. | Client/server paths or auth headers diverge. |
| `client/src/utils/slugify.js` | Canonical frontend store slugs and public links. | Dashboard links can point to a different store URL. |
| `client/src/pages/AuthPage.jsx` | Registration/login UI and token setup. | Seller sign-in flow breaks. |
| `client/src/pages/OnboardingPage.jsx` | Seller/store form; persists through `/api/sellers/onboarding`. | Seller profile or first store publication fails. |
| `client/src/pages/Products.jsx`, `Inventory.jsx` | Seller catalog and stock actions. | Catalog writes and seller inventory become stale or unsafe. |
| `client/src/pages/Storefront.jsx` | Public catalog, WhatsApp inquiry, checkout, cart, and product presentation. | Public buying/contact flow breaks. |
| `client/src/pages/TrackOrder.jsx` | Reads token-authorized order status. | Buyer tracking link stops resolving. |
| `client/src/pages/Settings.jsx` | Loads authenticated seller data and saves store slug, description, name, and WhatsApp number. | Store link/contact no longer match persisted seller data. |
| `client/src/pages/Billing.jsx` | Razorpay browser checkout for seller plans. | Subscription checkout UI fails. |
| `server/src/server.js`, `app.js` | Env checks, DB connection, middleware, API route mounting, health endpoint. | API startup, security headers, CORS, or routing break. |
| `server/src/middleware/authMiddleware.js` | JWT verification and protected route identity. | Seller API access can be exposed or blocked. |
| `server/src/models/User.js`, `Seller.js`, `Product.js`, `Order.js` | Account, one-per-user seller/store, product, and order schemas/indexes. | Validation, ownership references, or indexes change. |
| `server/src/routes/*.js` | HTTP method/path and auth middleware mapping. | Client requests can hit wrong or unprotected handlers. |
| `server/src/controllers/sellerController.js` | Onboarding/profile/dashboard/public store/contact/SSE and store settings. | Public privacy or seller scoping changes. |
| `server/src/controllers/productController.js` | Seller-owned product CRUD and inventory changes. | Tenant isolation and catalog data change. |
| `server/src/controllers/orderController.js` | Server-calculated order totals, inventory transaction, tracking, email dispatch, seller status changes. | Orders, stock, payments, or buyer privacy break. |
| `server/src/controllers/billingController.js` | Razorpay order and signature verification. | Paid plan activation can be incorrect. |
| `server/src/services/emailService.js` | Optional Resend transactional email API call and explicit provider status. | Order email behavior and delivery claims change. |
| `server/src/controllers/emailWebhookController.js`, `server/src/services/emailWebhookService.js`, `server/src/utils/resendWebhook.js`, `server/src/models/EmailWebhookEvent.js` | Verify Resend webhook signatures, deduplicate/store minimal event data, and reconcile lifecycle status against orders. | Email status could be forged, lost, or attached to the wrong order. |
| `server/src/utils/storeEvents.js` | In-process store SSE event bus. | Single-process storefront refresh stops; it is not a shared broker. |
| `server/src/utils/whatsapp.js` | E.164 validation and WhatsApp link/message generation. | Wrong seller destination or malformed chat link. |
| `server/tests/` | Vitest route, billing, slug, email config, and WhatsApp helper tests. | Regressions may go undetected. |
| `server/.env.example`, `client/.env.example`, `DEPLOYMENT.md` | Safe configuration examples and deployment instructions. | Production configuration can be incomplete. |

## Real data flows

### Seller creates or updates a product

React Products form → Axios authenticated request → Express product route → JWT middleware → controller scopes the query/write to `req.user.userId` → Mongoose writes Product → controller emits a store-scoped in-process event after persistence → open public storefront refetches the public API; 15-second polling is a fallback. There is no shared event broker, so events do not fan out between API instances.

### Buyer opens WhatsApp

Storefront → API-relative `/api/store/:slug/contact` → server resolves the published, active seller by canonical slug → validates the seller's configured WhatsApp E.164 value → optionally loads selected published products owned by that seller → constructs an encoded `wa.me` link. A cart message is an inquiry and estimated listed total, not an order or stock reservation. WhatsApp needs a recipient identifier in the link; the public number is not rendered as page text, but cannot be fully concealed through direct click-to-chat.

### Buyer submits checkout

Storefront sends product IDs, quantities, and buyer details → public order controller resolves seller and published seller-owned products → server calculates listed prices and totals → MongoDB transaction conditionally decrements stock and creates Order → only after commit, the API emits the catalog event and attempts optional seller/buyer email → returns order reference and one-time tracking token. Tracking stores a token hash and exposes only limited order status/items. The order begins `PENDING` and is not a seller-accepted order. Email `accepted` means the provider accepted the request, not that the recipient received it. A signed Resend webhook can update stored status to sent, delivered, delayed, bounced, complained, or failed; it has not been live-tested and dispatch has no durable retry worker.

### Billing and AI

Razorpay order creation stores the target plan and user in order notes; payment verification compares HMAC and fetched order owner/plan/amount/currency before activating the seller plan. There is no webhook-based renewal/reconciliation, and the app does not verify recurring charges. AI Insights reads an optional external ML service from `VITE_ML_URL`; no service implementation or live response was verified. The FAQ assistant on storefront is deterministic text, not a model.

## State and troubleshooting

- **Frontend state** is the currently rendered form/catalog/cart. It is not proof of a saved record.
- **Backend business logic** validates ownership, prices, stock, and status transitions.
- **MongoDB records** are the durable source for sellers, products, and orders.
- **SSE events** are short-lived hints to refetch persisted data; they do not carry private records.
- **Notifications** currently include transient browser events and attempted order email. There is no durable in-app notifications collection.
- **AI output** is external and optional; unavailable credentials should not be read as real analytics.

Debug by following the request in browser network tools, checking the matching Express route/controller, then inspecting the relevant MongoDB record. `401` usually means missing/expired JWT; `403` means authorization rejected; public `404` means no matching published active store/resource; `500` means server-side failure (check sanitized server logs). If products are absent, check the Seller `storeSlug`, `isPublished`, and `status`, then Product `sellerId`, `status`, and `isPublished`. If live storefront refresh fails, inspect `/events` and the authoritative store API; polling is the fallback. Notifications are not persisted. Stock and orders are written transactionally, requiring a replica set. AI requires a valid HTTPS `VITE_ML_URL` and a separately operated service.

## Operational boundaries

This project has no browser/E2E suite, provider integration tests, migration runner, durable job queue, image upload service, persisted in-app notification center, or cross-process SSE adapter. MongoDB transactions require replica-set support. Read `SUPPLY_LINK_AUDIT.md`, `SUPPLY_LINK_BUG_REPORT.md`, `SUPPLY_LINK_RELEASE_CHECKLIST.md`, and `DEPLOYMENT.md` before a staging release.
