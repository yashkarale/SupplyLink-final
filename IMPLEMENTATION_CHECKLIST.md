# Supply Link Implementation Checklist

## Phase 1 — Audit (COMPLETE)
- [x] Mapped architecture: React 19 + Vite + Tailwind client, Express 5 + Mongoose 9 server
- [x] Identified entry points: client/src/main.jsx, server/src/server.js
- [x] Audited all routes, controllers, models, middleware, services, utils
- [x] Identified gaps: no Framer Motion, no client tests, incomplete Razorpay lifecycle, no persistent notifications, no product image upload, no pagination on some queries
- [x] Verified tenant isolation patterns (seller-scoped queries, JWT-derived ownership)
- [x] Verified security: Helmet, CORS, rate limiting, JWT, bcrypt, webhook signatures

## Phase 1 — Audit (COMPLETE)
- [x] Mapped architecture: React 19 + Vite + Tailwind client, Express 5 + Mongoose 9 server
- [x] Identified entry points: client/src/main.jsx, server/src/server.js
- [x] Audited all routes, controllers, models, middleware, services, utils
- [x] Identified gaps: no Framer Motion, no client tests, incomplete Razorpay lifecycle, no persistent notifications, no product image upload, no pagination on some queries
- [x] Verified tenant isolation patterns (seller-scoped queries, JWT-derived ownership)
- [x] Verified security: Helmet, CORS, rate limiting, JWT, bcrypt, webhook signatures

## Phase 2 — Startup, Configuration, Build
- [x] Client production build passes (`npm run build` in client/)
- [x] Client test infrastructure: Vitest + jsdom + testing-library installed, 13 tests passing
- [x] Framer Motion installed
- [ ] Verify .env.example files are complete with placeholder names only
- [ ] Check .gitignore covers .env, build artifacts, logs

## Phase 3 — Auth, Authorization, Tenant Isolation
- [x] Fixed AuthPage label accessibility (htmlFor/id association)
- [ ] Verify JWT auth middleware enforces email verification (already implemented)
- [ ] Verify all private routes use `protect` middleware (already implemented)
- [ ] Verify seller-scoped queries on Product, Order, Seller models (already implemented)
- [ ] Verify no client-supplied sellerId is trusted for authorization (already implemented)
- [ ] Add rate limiting on auth and sensitive endpoints (already present)
- [ ] Verify CORS and Helmet production settings (already present)

## Phase 4 — Products, Public Stores, Live Preview, Orders, Inventory, Customers
- [ ] Verify product CRUD works end to end (server-side validation, ownership checks)
- [ ] Verify public storefront loads from `/store/:slug`
- [ ] Verify live preview uses same data as published store
- [ ] Verify order creation with server-calculated totals and stock decrement
- [ ] Verify inventory consistency (atomic stock updates, cancellation restoration)
- [ ] Add product image upload via Cloudinary on client side
- [ ] Add pagination to getSellerOrders, getSellerDashboard

## Phase 5 — Analytics and Notifications
- [ ] Verify analytics computed from actual DB records
- [ ] Implement persistent in-app notification system (Notification model + API)
- [ ] Add notification UI (inbox, unread counts, real-time via SSE/polling)

## Phase 6 — Razorpay Subscription Billing Lifecycle
- [ ] Implement Razorpay webhook event deduplication (RazorpayWebhookEvent model exists)
- [ ] Implement subscription renewal/expiration logic
- [ ] Implement cancellation and grace period handling
- [ ] Implement refund handling
- [ ] Server-side enforcement of paid-plan entitlements
- [ ] Billing history in dashboard

## Phase 7 — Premium UI Redesign with Framer Motion
- [x] Add Framer Motion to client dependencies
- [x] Create shared animated components (MotionPage, SkeletonLoader, Toast, Modal, Button, Input)
- [x] Client build passes with new components
- [x] Wrap app with ToastProvider
- [x] Add MotionPage route transitions to AppLayout
- [ ] Add useToast to key pages for feedback
- [ ] Add skeleton loading states to pages
- [ ] Redesign key pages with premium styling
- [ ] Respect prefers-reduced-motion, keyboard navigation, focus indicators
- [ ] Mobile-responsive layouts

## Phase 8 — Testing
- [x] Client Vitest setup and tests for slugify, api, AuthPage (13 passing)
- [ ] Add client tests for Products, Storefront, Orders
- [ ] Add backend security tests (cross-tenant access, price manipulation, webhook replay)
- [ ] Add E2E browser tests
- [ ] Run all tests and fix failures

## Phase 9 — Production Configuration and Deployment
- [ ] Production build configuration
- [ ] Environment variable documentation
- [ ] MongoDB production connection settings
- [ ] CORS for real frontend origin
- [ ] Health/readiness endpoints (already present)
- [ ] Deployment documentation (DEPLOYMENT.md, LAUNCH_CHECKLIST.md)
- [ ] Backup, recovery, rollback procedures

## Phase 10 — Final Release Audit
- [ ] Verify all acceptance criteria
- [ ] Final report