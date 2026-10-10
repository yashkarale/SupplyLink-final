# Supply Link – Product Blueprint and Implementation Roadmap

## 1. Product definition

Supply Link is a seller-first social-commerce SaaS for small businesses in India. The product lets a seller create a polished mini-store, share one public link, receive orders from customers, and manage store operations from a dashboard without needing a custom website.

The platform is designed around a simple flow:

1. Seller signs up and creates a business profile.
2. Seller adds products and storefront settings.
3. Storefront is published as a public URL.
4. Customers browse the store and place orders.
5. Seller manages orders, inventory, analytics, and subscriptions from a dashboard.

---

## 2. Current repository reality

The codebase already uses a pragmatic, startup-friendly stack instead of the Java/Spring Boot architecture proposed in the product spec:

- Frontend: React + Vite + JavaScript
- Backend: Express + MongoDB + JWT authentication
- AI service: Python FastAPI foundation
- Package evidence: `client/package.json`, `server/package.json`, `ml-service/requirements.txt`

This is a good choice for the project at this stage because it allows fast iteration, easy local development, and a simpler MVP for a small-seller marketplace. It does not need a major migration unless the team later decides to scale toward enterprise-grade Java infrastructure.

### What already works in the repo

From the current codebase:

- User registration and login flow with password hashing and JWT issuance
- Seller onboarding and public store creation flow
- Seller dashboard analytics generation from real order and product data
- Public storefront retrieval by slug
- Product creation and inventory access for authenticated sellers
- Core Express middleware for CORS, Helmet, rate limiting, and health checks
- Frontend onboarding and dashboard screens connected to live APIs

Relevant implementation files:

- `server/src/controllers/authController.js`
- `server/src/controllers/sellerController.js`
- `server/src/routes/sellerRoutes.js`
- `server/src/routes/productRoutes.js`
- `client/src/pages/OnboardingPage.jsx`
- `client/src/services/api.js`

### Verification status

Fresh validation succeeded:

- Frontend build: `npm run build` in `client` passes
- Backend tests: `npm test -- --run` in `server` passes (4/4 tests)

This means the project is not a blank screen; it is a working MVP foundation that is ready for the next product phase.

---

## 3. Product architecture and business model

### 3.1 User roles

#### Seller
- Creates business profile
- Publishes a public mini-store
- Manages product catalog and inventory
- Receives and processes orders
- Views dashboard metrics and reports
- Chooses a plan and subscription path

#### Buyer
- Visits a seller store by URL
- Browses products and variants
- Adds items to a cart
- Places order without needing a Supply Link account
- Receives order confirmation and contact details

#### Platform admin
- Manages seller accounts and policies
- Reviews subscription status
- Handles abuse, suspension, and operational security
- Monitors platform health

### 3.2 Core business rules

- Sellers must own only their own data.
- Customer prices and totals must be server-calculated, never trusted from the client.
- Store slugs are generated server-side and persisted.
- Product listings and order data must be scoped to the correct seller.
- Payment flows for seller subscriptions and customer orders should remain clearly separated.
- AI features must be optional and must never block store operations.

---

## 4. Business logic blueprint

### 4.1 Registration and authentication

Required flow:

- Register with name, email, and password
- Hash password with bcrypt
- Save only necessary user information
- Issue JWT token
- Require auth on all seller-only routes

Recommended next-step improvements:

- email verification token flow
- password reset flow
- rate limits per login/register endpoint
- refresh token or expiry policy enforcement
- admin authorization checks on protected admin endpoints

### 4.2 Seller onboarding and store creation

Required flow:

- Seller completes business profile
- Backend generates unique slug
- Store is saved with status and publication state
- Seller receives shareable public URL immediately

Recommended logic:

- if slug already exists, generate variant like `aditis-closet-7k2p`
- prevent duplicate slug reuse across stores
- keep slug stored in the database instead of regenerating on each request
- require explicit store publish action if draft mode is used

### 4.3 Product lifecycle

Each product should support:

- name, description, category
- images and pricing
- stock and low-stock logic
- published/archive state
- variants such as size/color

Validation rules:

- product name required
- price cannot be negative
- sale price must be valid compared to regular price
- stock cannot be negative
- archived products should not be purchasable
- public store APIs should only expose active products

### 4.4 Customer storefront and cart

Public page behavior:

- fetch seller by slug
- show only the matching seller’s published products
- show 404 when store is missing
- disable purchases for suspended or unpublished stores
- show retry-friendly error if backend is unavailable

Cart logic:

- customer adds product + variant + quantity
- frontend stores cart locally for convenience
- backend re-validates inventory and unit price at order creation
- do not trust client cart totals

### 4.5 Order handling

Order creation should be transactional:

- Validate seller and product ownership
- Validate stock and variant availability
- Price snapshot captured in order item
- Inventory reserved or deducted in a safe transaction
- Unique order reference created
- Duplicate submission prevention via idempotency key

Suggested order states:

- Pending confirmation
- Confirmed
- Processing
- Shipped
- Delivered
- Cancelled

Valid transition rules must be enforced so a cancelled order cannot quietly become delivered.

### 4.6 Dashboard analytics

Metrics should be computed from the real database, not hardcoded demo values.

Recommended metrics:

- total orders
- pending orders
- sales in selected time range
- average order value
- product inventory summary
- low stock items
- recent orders
- sales trend by day or week
- top-selling products

The repo already contains a dashboard analyzer pattern in `server/src/controllers/sellerController.js`, and this should be extended to real date filters and export logic.

### 4.7 Subscription model

The platform should keep a clear separation between:

- seller subscriptions to Supply Link
- customer payments for products on a seller storefront

Initial model recommendation:

- Keep seller subscriptions on Razorpay or a similar provider
- Use seller-led customer payments such as COD or direct UPI for v1
- Avoid marketplace payment collection unless a compliant settlement model is in place

This matches the product spec and keeps the business model simpler and safer.

---

## 5. Recommended technical roadmap for this repo

### Phase 1 – Production hardening

- finalize `.env` configuration and environment validation
- add admin role enforcement beyond the current seller-only flow
- add email verification and reset token support
- add shared API validation across auth, sellers, products, orders
- expand automated integration tests for key flows

### Phase 2 – Store publishing and storefront quality

- add publish/unpublish states to stores
- add slug uniqueness + conflict handling
- secure public store API for suspended/unpublished stores
- improve storefront page for mobile browsing and product search
- improve error states and 404 handling in public storefront pages

### Phase 3 – Catalog and order lifecycle

- add product image upload validation
- add sales-price validation and archive/restore logic
- add order status history and stock reservation logic
- add duplicate-order prevention and order tracking token support

### Phase 4 – Analytics and exports

- add date-range filters
- add export APIs for sales and inventory
- add low-stock alerts and forecasting summaries
- ensure metrics are based on actual records and timezone-aware reporting

### Phase 5 – Subscription and AI

- add plans and entitlements model
- create backend payment verification and webhook handling
- add AI provider abstraction with quota and fallback handling
- keep AI optional so storefront operations continue without AI

---

## 6. Suggested file-by-file plan for the current repo

### Frontend (`client/src`)

- `pages/OnboardingPage.jsx` — finalize onboarding UX and seller profile flow
- `pages/Storefront.jsx` — public browsing, product details, cart, and checkout flow
- `pages/Products.jsx` — product CRUD, filters, inventory and status management
- `pages/Orders.jsx` — order list, details, and status transitions
- `components/layout/` — app shells, navigation, and route guard polishing
- `services/api.js` — add reusable endpoints for orders, checkout, analytics, and plan logic

### Backend (`server/src`)

- `controllers/` — keep all business logic server-side
- `routes/` — map public and protected API endpoints
- `models/` — extend schemas for stores, orders, order items, subscriptions, and payment records
- `middleware/authMiddleware.js` — enforce seller/admin ownership checks
- `validators/` — add request validation for product and order operations

### Data layer

- MongoDB works well for the current repo and is suitable for the MVP
- Add stronger schemas for order items, order history, subscription records, and audit logs as the product matures
- Keep transaction-based inventory updates for order creation

---

## 7. Scope recommendation

The practical strategy is to keep the current stack and build the product aggressively against it, rather than forcing a Java/Spring migration before the MVP is proven.

The team should aim for this baseline completion state:

- seller signup + onboarding
- store create + publish + shareable public URL
- product CRUD + stock validation
- public storefront browsing
- guest order creation with validation
- seller order management
- sales analytics from real database records
- subscription plan structure
- AI feature abstraction without dependence on AI being available

That is a credible, production-oriented MVP that matches the product vision without distracting from the immediate business goal.

---

## 8. Recommendation for the next step

The next highest-priority feature is not a visual redesign; it is the end-to-end order lifecycle:

1. customer places order from public storefront
2. backend validates seller, product, pricing, stock, and customer fields
3. order is created transactionally
4. seller sees the order in dashboard
5. status can be updated and inventory history stays consistent

This is the real business engine that turns a storefront into a working commerce platform.
