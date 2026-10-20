# Supply Link — Commerce Studio implementation status

Last updated: 2026-10-20

## Phase checklist

- [x] Phase 1 — Inspect architecture, Tailwind v4, scripts, existing storefront/dashboard
- [ ] Phase 2 — Design system tokens, typography, shared primitives
- [ ] Phase 3 — Public storefront Commerce Studio redesign (preserve slug/order/WhatsApp)
- [ ] Phase 4 — Dashboard shell, products, inventory, orders, customers, analytics
- [ ] Phase 5 — Workflow verification
- [ ] Phase 6 — Production build, tests, remaining work

## Baseline (pre-this-session)

- Client: React 19 + Vite + Tailwind CSS **v4.3** (`@tailwindcss/vite`). Scripts: `dev`, `build`, `lint` (oxlint), `preview`, `test` (vitest).
- Server: Express + MongoDB/Mongoose. Scripts: `dev`, `start`, `test`, `migrate`.
- Framer Motion is already installed.
- Storefront at `/store/:slug` loads `fetchPublicStore`, cart/checkout, WhatsApp, payment-proof upload. File was ~3600 lines with doubled blank lines and a sage/forest visual layer.
- Dashboard pages already use live APIs; visual identity was still indigo/slate SaaS.
- Do not treat previous “premium polish” notes as complete Commerce Studio work.

## Next files to edit if a session ends mid-work

1. `client/src/pages/Storefront.jsx`
2. `client/src/pages/StorefrontPremium.css`
3. `client/src/index.css`, `client/src/App.css`
4. `client/src/components/layout/*`
5. Dashboard pages under `client/src/pages/`

## Secrets

Do not print `.env` values. Production still needs `CLIENT_URL`, `VITE_API_URL`, and related env vars.

## Current session update (2026-10-20)

### Completed in this session

- Fixed the Inventory page's undefined `Search` icon and removed unused adjustment imports/state.
- Replaced stock writes on every input keystroke with an explicit adjustment dialog and one server request on submit. The dialog accepts non-negative whole quantities, and the backend endpoint remains responsible for seller ownership and persistence.
- Connected Inventory loading, search, stock filters, and sorting to the rendered table; added a distinct no-match state.
- Added Inventory UI coverage for search filtering and one-call persistence after submitting a stock adjustment.
- Reviewed the existing product and public-store flow. Product stock updates call the authenticated seller-scoped endpoint; successful updates publish a store catalog event, which the slug-based storefront listens to and uses to reload the seller's real catalog.
- On the storefront, added a graceful product-card image fallback for broken seller image URLs and changed the low-stock label to show the actual remaining quantity (for example, "Only 3 left"). The existing Commerce Studio layout, slug-based data loading, search/filtering, cart, and payment-pending rules are retained.
- Follow-up polish: made the Inventory low-stock threshold input explicitly use the selected light/dark color scheme with high-contrast text and a mobile-wrapping control row. Reworked the storefront hero collection panel into an editorial product spotlight that uses real in-stock catalog entries/images and removed the unsupported "Customer favourites" label.
- Responding to the focused storefront brief, updated the seller-branded header and description-led hero, replaced generic platform copy with seller-specific wording, made product cards single-column on narrow phones, added reduced-motion-aware Framer Motion reveals and mobile menu animation, and added quantity selection in product details. Product selection is keyed to the live catalog so current stock is reflected after store refreshes. The seller schema has no logo field, so the header uses the real store name and its initial.
- Added a storefront UI test for slug-specific catalog loading, displayed inventory, quantity limits, and adding the chosen quantity to the bag. Test setup now includes an IntersectionObserver stub for Framer Motion viewport reveals.

### Commands and results

- `client: npm.cmd run build` - passed after the storefront redesign and Inventory updates.
- `client: npm.cmd run lint` - completed with three existing warnings in `AppLayout.jsx`, `Toast.jsx`, and the store-loading effect in `Storefront.jsx`; Inventory warnings are resolved.
- `client: npm.cmd test -- --reporter=dot` - 5 files and 16 tests passed, including Inventory save/filter/contrast checks and a slug/catalog/product quantity storefront flow.
- `server: npm.cmd test -- --reporter=dot` - 15 files passed, 1 skipped; 45 tests passed, 9 skipped.
- `git diff --check` - passed; Git printed line-ending conversion notices for existing modified files.

### Remaining work / verification limits

- The requested storefront redesign is implemented against the existing API and verified with component tests and a production build. Full browser checks at 360/390/430/768/desktop and live MongoDB-backed storefront/order tests remain unperformed. The wider dashboard/orders/customers/analytics audit is still incomplete.
- Browser checks at the requested viewport sizes and end-to-end authenticated product/inventory/order flows were not run in this session.
- No live MongoDB-backed API or storefront refresh test was performed; only the relevant implementation paths and automated suites were reviewed.
- The three client lint warnings listed above remain to be reviewed.
