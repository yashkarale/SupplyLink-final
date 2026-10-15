# MongoDB capacity and illustrative infrastructure costs

Checked 2026-10-15 against official vendor pages. The repository does not reveal which database provider, Atlas account, region, or tier is actually configured. All record-size figures below are estimates from Mongoose schemas, not measurements of a live database.

## Atlas Free cluster snapshot

MongoDB currently documents the Free cluster (formerly M0) as 512 MB maximum total storage; this counts uncompressed BSON documents across collections **and associated indexes**. It is a hard ceiling. The Free tier also documents 500 concurrent connections, 100 read/write operations per second, 10 GB ingress and 10 GB egress in each rolling seven-day period, 32 MB in-memory sort limit, and no automatic storage growth. Free clusters do not support enabled backups, private endpoints, VPC peering, full monitoring/Performance Advisor, or failover testing; an idle cluster may pause after 30 days without a connection. Feature and region eligibility are account-specific. See [Atlas Free Cluster Limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [storage FAQ](https://www.mongodb.com/docs/atlas/reference/faq/storage/), and [Atlas pricing](https://www.mongodb.com/pricing).

Atlas currently lists Flex at $8–$30 per month and Dedicated starting at $56.94/month on its pricing page. Actual cost depends on provider, region, usage, backups, transfer, and configuration. The pricing page is not a quote for this app.

## Approximate records from this schema

No representative MongoDB records were available to measure. Sizes assume small text fields, no binary images, and include a rough 20–30% allowance for BSON structure and indexes. Images should live in object storage; MongoDB should retain URLs/metadata.

The server now includes `npm run storage:report`, which reads `dbStats` and `collStats` from the configured database and reports logical database bytes and average order document bytes. Run this against the actual staging dataset before choosing product/order limits. It reports only the selected database; Atlas applies the 512 MB cap to the whole cluster. A configurable 350 MiB default guard pauses new database-backed checkout, paid subscription order creation, and product/inventory writes, but it is a safety margin rather than a guarantee or automatic archive policy.

Read-only measurement from the configured database on 2026-10-15: 4,000 document bytes plus 499,712 index bytes (503,712 logical bytes total); the Order collection had 2 documents, 2,210 document bytes, and an average document size of 1,105 bytes. The Orders index allocation reported 147,456 bytes. Two orders are far too small a sample for a reliable per-order forecast, and this measurement excludes any other databases sharing the Atlas cluster. The API's default 350 MiB write stop is therefore a conservative operational guard, not a capacity promise.

| Record | Estimated stored size | Current repository state |
|---|---:|---|
| Seller with store settings | 2.0–3.0 KB | `Seller` document includes identity reference, profile, contact, plan, FAQ, publish state. |
| Product with 1–3 image URLs and variants | 1.5–2.2 KB | `Product` stores URL strings; no image upload service. |
| Order with 2–3 item snapshots and address | 2.8–4.0 KB | `Order` embeds customer and item snapshots plus status history/tracking hash. |
| Customer | Included in each Order | No separate Customer model. One person ordering from multiple stores is represented repeatedly. |
| Notification | N/A today; model 0.5–1.0 KB if introduced | No persistent Notification model. |
| Inventory history | N/A today; model 0.4–0.8 KB/event if introduced | Stock is a product field; no stock ledger/history collection. |
| AI insight | N/A today; model 1–3 KB if introduced | No persisted AI insight model or analytics history. |
| Email webhook event | 0.4–0.7 KB/event | Minimal Resend message ID/type/time only; 90-day TTL. Raw provider payloads and recipient addresses are not stored here. |
| Other analytics/event history | N/A today | Dashboard computes from records; store SSE events are in-memory and transient. |

## Transparent capacity scenarios

Assume 409.6 MB as a planning budget (80% of the 512 MB quota, leaving 20% for growth variation and operational room). Product sizes: 1.8 KB each. Seller: 2.5 KB each. Order sizes include the order document and indexes; monthly storage adds 0.5 KB per email lifecycle event, assuming up to two emails per order and two provider events per email. Email webhook events have a 90-day TTL. No images are stored in MongoDB.

| Scenario | Active sellers | Products/seller | Orders/seller/month | Order size | Initial sellers + catalog | New order storage/month | Approx. time to 409.6 MB* | Monthly buyer-store relationships** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Small pilot | 25 | 20 | 10 | 2.5 KB | 0.96 MB | 0.73 MB (orders + email events) | ~564 months | ~125 |
| Base | 200 | 40 | 40 | 3.0 KB | 14.9 MB | 30 MB (orders + email events) | ~13 months | ~4,000 |
| Growth | 800 | 60 | 150 | 3.5 KB | 87.6 MB | 470 MB (orders + email events) | under 1 month | ~60,000 |

\* Simple linear estimate: `(409.6 MB - initial catalog/sellers) / (monthly order bytes + monthly email-event bytes)`; it ignores TTL timing, other status/customer changes, compaction, backups, actual index shapes, operational headroom, and changes in order size. Values are rounded and are not a capacity guarantee. Growth exceeds the planned free-tier budget almost immediately. \*\* Assumes two orders per buyer-store relationship per month. This is not unique-human count: the same buyer at three stores counts as three relationships.

The existing 15-second storefront polling can use about 4 public-store API requests per active open tab per minute. At 100 open tabs that is about 400 requests/minute (6.7 requests/second) before browsing, SSE reconnections, seller dashboard queries, and product database reads. Bursts and connection limits may be a bottleneck before storage. Avoid opening a new Mongo connection per request; Mongoose's shared pool should be monitored.

## Upgrade and retention guidance

Use a Free cluster for development only. A paid Flex tier may fit an early low-risk pilot but still has shared resources and limited capabilities. Before production orders, choose a tier with suitable backups, restore objectives, monitoring, and replica-set transactions; test restore, not just backup creation. Review indexes/query plans and connection use. Keep order records according to legal/accounting requirements; do not delete legitimate business history merely to remain under quota. Define retention for any future notifications, audit events, and AI outputs. Store images in an object store/CDN and keep URLs plus metadata in MongoDB.

## Cost references

- [MongoDB Atlas pricing](https://www.mongodb.com/pricing) currently lists Flex $8–$30/month and Dedicated starting at $56.94/month; region/options vary.
- [Render pricing](https://render.com/pricing) currently lists a 512 MB web service at $7/month and a 1 CPU/2 GB service at $25/month; Render free compute is limited and not assumed for reliable production.
- [Resend pricing](https://resend.com/pricing) currently lists 3,000 emails/month with a 100/day limit on Free and $20/month for Pro with 50,000/month. Pricing/limits can change.
- [Razorpay pricing](https://razorpay.com/pricing/) currently advertises a 2% transaction charge plus applicable GST for standard payment gateway processing; method, eligibility, offers, and contract terms can differ. The model uses a 2.36% effective rate (2% plus 18% GST on that fee) as an assumption.

Prices checked 2026-10-15. This project has not selected Render, Atlas, or Resend; these are comparable planning references, not configured services or a cost quote.
