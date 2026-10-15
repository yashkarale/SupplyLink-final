# Illustrative Supply Link business model

Model date: 2026-10-15. This is a scenario model, not market research or a forecast. It uses the current code's plan prices: Launch ₹99/month and Scale ₹299/month. Current implementation verifies a Razorpay one-time order and changes seller plan state; recurring collection, renewal, cancellation, invoicing, webhooks, and complete entitlement enforcement are not implemented. Each scenario assumes those operational billing flows work before the revenue is relied on.

## Assumptions

- Subscription mix gives weighted monthly price: Conservative 80% Launch/20% Scale = ₹139; Base 75%/25% = ₹149; Growth 60%/40% = ₹179.
- Scenario FX assumption: ₹85 per USD solely for comparable planning; it is not a checked spot rate or financial advice.
- Razorpay processing cost modeled at 2.36% of collected subscription revenue (2% plus assumed 18% GST on the fee). Actual merchant terms can differ; see [Razorpay pricing](https://razorpay.com/pricing/).
- Infrastructure reference costs use [Render](https://render.com/pricing), [Atlas](https://www.mongodb.com/pricing), and [Resend](https://resend.com/pricing) published prices checked 2026-10-15. The repository has not selected/configured these vendors.
- Resend cost models two emails/order (seller and buyer, an upper bound). Free tier assumed for under 3,000 monthly emails; Pro $20 assumed for 3,000–50,000. No delivery guarantee is inferred.
- Media, bandwidth and other service allowances are explicit planning placeholders. There is no current image-upload/object-storage integration or live AI provider in this repository.
- Support and operating spend is estimated founder/team labor and basic operations, not a vendor quote. Taxes, refunds, failed payments, churn, discounts, bad debt, legal/accounting, founder salary, and acquisition costs are excluded unless represented by the support line.

## Monthly scenarios

| Metric | Conservative pilot | Base | Growth |
|---|---:|---:|---:|
| Active registered sellers | 50 | 250 | 1,250 |
| Paying sellers | 5 (10%) | 100 (40%) | 500 (40%) |
| Free active sellers | 45 | 150 | 750 |
| Weighted monthly price | ₹139 | ₹149 | ₹179 |
| Subscription MRR | ₹695 | ₹14,900 | ₹89,500 |
| Annualized run rate (MRR × 12) | ₹8,340 | ₹178,800 | ₹1,074,000 |
| Orders per paying seller / month | 10 | 30 | 50 |
| Modeled emails / month (max 2 per order) | 100 | 6,000 | 50,000 |
| API hosting | $7 / ₹595 | $25 / ₹2,125 | $25 / ₹2,125 |
| Database | Flex $8 / ₹680 | Flex $30 / ₹2,550 | Dedicated from $56.94 / ₹4,840 |
| Email | $0 / ₹0 | Pro $20 / ₹1,700 | Pro $20 / ₹1,700 |
| Image storage/CDN allowance | ₹0 (not implemented) | ₹2,000 assumption | ₹5,000 assumption |
| Razorpay fees at 2.36% | ₹16 | ₹352 | ₹2,112 |
| Direct delivery costs modeled | ₹1,291 | ₹8,727 | ₹15,777 |
| Gross profit (revenue − direct delivery) | −₹596 | ₹6,173 | ₹73,723 |
| Gross margin | −85.8% | 41.4% | 82.4% |
| Support/operations allowance | ₹5,000 | ₹25,000 | ₹60,000 |
| Operating profit/(loss) estimate | **−₹5,596** | **−₹18,827** | **₹13,723** |

Formulae: `MRR = paying sellers × weighted monthly plan price`; `ARR run rate = MRR × 12`; `payment fee = MRR × 2.36%`; `gross profit = MRR − (hosting + database + email + media allowance + payment fees)`; `operating profit = gross profit − support/operations`. Figures are rounded. The base case shows that a real early startup can lose money even with positive MRR. Growth appears profitable only under assumptions of plan conversion, stable pricing, controlled support, paid infrastructure adequacy, and functioning renewals.

## Costs and interpretation

- Hosting/database numbers are not a complete production quote. Domain/DNS, monitoring, backups/restore, distributed SSE broker, fraud tooling, tax/compliance, support systems, AI compute/API, file scanning/CDN egress, and redundant instances could materially raise costs.
- AI revenue/cost is ₹0 here because no live AI data pipeline, feature gating, usage metering, or add-on pricing is implemented. Do not sell a paid AI add-on as operational today.
- Payment costs are on Supply Link's seller-plan transactions only. Seller merchandise GMV is separate; ₹5 lakh of seller product sales is not ₹5 lakh of platform revenue unless a defined commission agreement and payment flow exist.
- Free sellers still create hosting, data, abuse, support, and moderation costs. Growth assumes 750 free active sellers and does not allocate a separate fraud/support surcharge.
- ARR is a current monthly run rate multiplied by twelve; it is not guaranteed revenue. Churn, failed renewals, refunds, seasonality and discounts reduce realized annual revenue.
- The exact Atlas/Render/Resend tier, deployment region, and billing terms are unknown. Recalculate from selected regions and observed usage before spending or launch.

## Profitability drivers

The key levers are conversion from free to paid, seller retention, plan mix, successful renewal rates, support hours per seller, fraud/refund load, number of API calls per storefront visit, image bandwidth, database tier, and whether WhatsApp/email/AI features have provider costs. Measure those in a pilot rather than assuming signup count equals revenue.
