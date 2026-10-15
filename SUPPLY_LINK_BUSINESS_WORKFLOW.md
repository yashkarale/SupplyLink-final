# Supply Link business workflow

## Platform owner

The current repository has seller plan definitions and seller-level billing status, but no platform-owner admin console, abuse-report queue, platform analytics, support tooling, invoice system, or verified renewal workflow. A platform operator must configure secrets, monitor API/database/provider health, respond to account abuse, and reconcile Razorpay payments from provider records until those tools exist. Aggregate platform analytics should avoid exposing seller-private customer data.

## Seller onboarding and daily use

1. Seller registers with email/password. Email verification is not implemented.
2. Seller submits business/store details and contact numbers. Phone and WhatsApp require international-format validation; WhatsApp registration itself cannot be verified without WhatsApp Business integration.
3. The API upserts the single Seller document for that account and checks store slug uniqueness.
4. Seller adds products and updates stock through authenticated seller-scoped routes.
5. Store publication is currently performed during onboarding; preview/custom branding controls are incomplete.
6. Seller shares the canonical `/store/:slug` URL.
7. Catalog mutations persist before process-local SSE events; browser polling/reconnect refetches persisted state.
8. Seller receives orders in the workspace; durable in-app notifications are not implemented. If Resend is configured, order email attempts are recorded and a signed webhook can update provider lifecycle state; live provider configuration is still required.
9. Seller updates order status through an authorized route. Cancellation/restocking and full state-transition coverage need further testing.

## Buyer

1. Buyer follows the seller's store URL and sees published products.
2. Buyer can send a WhatsApp inquiry. Product IDs and quantities are resolved against that store's public catalog; messages are not persisted orders and do not reserve stock.
3. Separately, buyer can submit checkout. Server recalculates totals, validates ownership/publication/stock, decrements stock and creates a pending order in a transaction.
4. Buyer gets an order reference and one-time tracking token; only a token hash is stored. Tracking reveals permitted status and item data, not buyer contact/address.
5. Seller must confirm/process the request. A WhatsApp conversation alone does not change the Supply Link order state.

## Revenue and monetization

Current plan configuration lists Free (two non-archived products), Launch (₹99/month), and Scale (₹299/month). The app takes payment for a seller plan; seller merchandise GMV belongs to sellers and is not Supply Link revenue. Paid entitlements expire after one month and need manual renewal; automated recurring collection, cancellation, invoicing, failed-renewal recovery, and Razorpay webhooks are not implemented. Product limits are checked on the server; AI add-on billing and marketplace commission are not implemented. New checkout and paid subscription-order creation pause when the configured database-size guard is reached.

## Practical operating sequence

1. Verify registration, seller setup, published store, product save, WhatsApp destination, checkout, stock update, and token tracking against a local replica-set database.
2. Prove seller A cannot read/write seller B data with integration tests.
3. Configure a staging HTTPS API/client, managed MongoDB, backups, logging, and monitoring.
4. Verify sender domain and Resend API key; test accepted/failure behavior and provider webhooks if delivery confirmation is required.
5. Complete WhatsApp destination validation with test sellers; acquire WhatsApp Business Platform access only if relayed/private messaging is a product requirement.
6. Implement Razorpay webhooks, idempotent payment event storage, renewals/cancellations, and plan gates before relying on recurring revenue.
7. Replace in-process event fanout before horizontally scaling the API; add durable notifications.
8. Run two-seller and concurrent-stock staging workflows, backups/restores, and browser viewport/accessibility reviews.
9. Pilot with a small seller cohort and monitor errors, database storage/index growth, request rate, delivery failures, support load, and actual payment conversion.
10. Upgrade only from measured reliability and capacity needs; do not treat free tiers or projected seller counts as production guarantees.
