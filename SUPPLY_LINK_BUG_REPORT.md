# Supply Link second bug review

Review date: 2026-10-15. This is a targeted source and test review, not proof that every possible bug has been found. No live production database or browser automation was available.

| Severity | Bug / root cause | Fix | Verification / remaining limit |
|---|---|---|---|
| High | Storefront Settings previously built a hardcoded `/store/my-store` link and reported unsaved local changes. | Load saved seller profile and update the existing Seller record with an authenticated endpoint; check unique slug and preserve publication state. | Client build and server tests pass. No authenticated MongoDB end-to-end run. |
| Medium | Header account control was a button with no action, so it did not open the store/account settings. | Link the account control directly to Settings, which displays the persisted canonical storefront link. | Client build passes; no browser click-through test. |
| High | WhatsApp redirect fell back from WhatsApp to any phone and stripped arbitrary characters without validating country code. | Require a valid E.164 WhatsApp value; normalize it; remove phone fallback; show contact-unavailable state. | Added normalization and link tests. Cannot verify number is registered with WhatsApp without provider/account validation. |
| High | Development storefront resolved `/api/.../contact` against the frontend origin, not the configured API host. | Build contact URL from API base configuration. | Build passes; no browser click-through test. |
| High | Login accepted GET/query credentials, where URLs may be retained in browser history, proxies, and logs. | Login is POST-only; login reads credentials only from request body; access logs redact sensitive query values. | Auth route tests confirm GET/query requests cannot log in; test output shows sensitive values redacted. |
| Medium | WhatsApp cart message could not be tied to server-catalog prices and could be mistaken for a persisted order. | Resolve selected product IDs against the seller's published catalog on the server; message states inquiry only, includes server-loaded listed amounts, and does not reserve stock. | Helper tests verify encoding/no-order wording. DB-backed Store A/B isolation remains unverified. |
| Medium | Storefront FAQ helper was branded as AI and made unsupported generic product claims; price questions could fail on empty catalogs. | Renamed it Store Guide, grounded responses in published product/category/FAQ data, and handled an empty catalog. | Client build passes; no browser test. |
| Medium | Storefront FAQ price answer threw on an empty catalog; fallback text asserted product qualities not present in data. | Handle empty catalogs and use only available catalog categories/prices. | Client build passes; no browser test. |
| Medium | Order email sending was absent, so the app had no real email status. | Optional Resend API integration records `not_configured`, `accepted`, `failed`, or `skipped`; signed, timestamp-checked, deduplicated webhooks can update lifecycle state. | Unit tests cover validation/unconfigured state and signature verification; no credential/live-provider test or durable email queue. |
| Medium | Notifications and some dashboard modules were transient or sample-driven. | Earlier edits removed fake public products/AI measurements/activity; in-browser alerts remain transient. | Source review only; persistent notifications remain missing. |
| Medium | SSE uses process-local EventEmitter and will miss events across multiple API instances. | No architectural change in this review. | Documented limitation; staging needs one process or a shared broker plus reconnect reconciliation. |
| Medium | Razorpay activation has no webhook/idempotent payment-event persistence or renewal enforcement. | No live payment changes. | Signature/order verification exists and unit tests pass; webhooks and recurring subscriptions remain unverified. |
| Medium | Checkout/status flows lack full integration and concurrent-order tests against MongoDB. | Server-side validation/transaction exists. | Replica-set DB not available here; integration remains unverified. |
| Low | Public store 404 message was opaque and generated from different slugs in Settings. | Canonical slug shared and Settings now uses persisted seller slug. | Live store `green-routes` was still 404 in the earlier API probe; seller record state is unknown. |

## Checks performed

- `npm.cmd run build` (`client`): passed.
- `npm.cmd run lint` (`client`): exited 0 with existing warnings (unused catches, impure render-time Date, unused variable/import).
- `npm.cmd test` (`server`): passing tests are recorded in the final report for the current change set.
- `git diff --check`: passed with existing LF/CRLF notices.
- Browser viewports and end-to-end workflows were not run. Docker was unavailable in the earlier compose check.

No claim is made that all bugs have been eliminated. Highest-risk unresolved areas are tenant isolation under integration tests, payment/webhook lifecycle, Mongo transaction behavior under concurrency, durable notifications, multi-instance realtime, and provider delivery.
