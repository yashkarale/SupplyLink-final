# Supply Link implementation plan

Status: active; most recent review and remaining phases 21–22 work are recorded here. This is not a completion claim.

## Stage 1 — storefront and seller data

- Acceptance: canonical store links resolve the same database slug; public API returns only explicitly public seller/product fields; unpublished stores/products are not publicly visible; failed loads are distinguishable from empty stores.
- Current status: code paths updated and client build/server tests pass. Live data still needs an active published seller record. The screenshot's seller record could not be inspected.

## Stage 2 — product and inventory lifecycle

- Acceptance: seller-scoped create/read/update/delete, draft/published state, atomic stock changes, no cross-seller access, and public changes reconciled after save.
- Current status: create/list/update and stock update exist. Delete, image upload/storage, comprehensive authorization tests, and push-based propagation remain.

## Stage 3 — order lifecycle and customer tracking

- Acceptance: server-priced orders, stock consistency under concurrency, seller-authorized transitions, durable history, customer-safe tracking token, and reliable recovery after disconnect.
- Current status: server price validation, transaction-based stock decrement/order insert, seller-scoped status routes, and an unguessable token hash with PII-limited tracking endpoint/page exist. Tracking uses polling; token expiry and full status/inventory transaction coverage remain.

## Stage 4 — real-time updates and durable notifications

- Acceptance: authenticated seller channels; public store-scoped product events; events emitted only after persistence; MongoDB notification history; unread/read state; reconnect recovery; multi-instance delivery strategy.
- Current status: public storefront SSE events are emitted after successful product/inventory/order writes; clients refetch authoritative API state on reconnect and retain polling fallback. Delivery uses an in-process emitter only. Shared multi-instance delivery and durable seller/customer notifications remain missing.

## Stage 5 — billing and AI

- Acceptance: verified Razorpay payments/webhooks persisted idempotently; entitlements derived from verified state; AI results tied to real tenant data with provider failure and insufficient-data handling.
- Current status: subscription order and signature/order checks exist; missing credentials, webhook persistence, and entitlement audit remain. AI connection is unverified and disconnected UI shows unavailable values.

## Stage 6 — production verification

- Acceptance: production env validation, HTTPS API/client, replica-set or managed transaction-capable MongoDB, backup/restore process, deployment health checks, security/authorization tests, browser workflows, and rollback steps.
- Current status: environment samples and startup checks updated. No deployment provider is selected; Docker is unavailable here; no live MongoDB/Razorpay or production deployment test was run.

## Immediate next actions

1. Inspect the configured database's Seller record for the canonical slug `green-routes`; confirm `isPublished: true`, `status: active`, and matching user onboarding. Do not expose phone fields while inspecting.
2. Add seller-ownership tests for product/order routes and public-store serialization tests.
3. Add tracking-token expiry/revocation and run customer tracking privacy tests.
4. Replace process-local SSE with shared event delivery before scaling API instances; persist seller notifications.
5. Configure Resend sender/webhook credentials, test status delivery on staging, and add a durable email retry/outbox.
6. Implement Razorpay webhook/idempotent payment persistence, recurring billing and entitlements before relying on plan revenue.
7. Add browser-level workflows and deployment-specific configuration after selecting hosting and MongoDB providers; verify backup restore and the actual seller store record.
