import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, Check, CreditCard, RefreshCw } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { createSubscriptionOrder, getBillingStatus, verifySubscriptionPayment } from "../services/api";

// Values and product limits mirror server/src/config/subscriptionPlans.js.
const plans = [
  { value: "free", name: "Free", amount: 0, currency: "INR", interval: "month", productLimit: 2, description: "For sellers starting online" },
  { value: "launch", name: "Launch", amount: 9900, currency: "INR", interval: "month", productLimit: null, description: "Best for new and growing sellers" },
  { value: "scale", name: "Scale", amount: 29900, currency: "INR", interval: "month", productLimit: null, description: "Premium operations and AI growth" },
];
const paper = "border-[#e2dccf] bg-[#fffdf9] text-[#1c1a17]";
const muted = "text-[#6f685d]";
const formatAmount = (amount, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount || 0) / 100);
const formatDate = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "Not available";
const errorText = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

export default function Billing() {
  const { theme = "light" } = useOutletContext() || {};
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processingPlan, setProcessingPlan] = useState("");

  const loadStatus = useCallback(async (initial = false) => {
    if (!initial) setLoading(true);
    setLoadError("");
    try {
      const response = await getBillingStatus();
      if (!response?.subscription) throw new Error(response?.message || "Subscription status was not included in the response.");
      setSubscription(response.subscription);
    } catch (error) {
      setLoadError(errorText(error, "Unable to fetch current subscription status."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { Promise.resolve().then(() => loadStatus(true)); }, [loadStatus]);

  const refreshAfterActivation = async (message) => {
    setStatusMessage(message);
    await loadStatus(false);
  };

  const handlePlanSelection = async (planValue) => {
    setProcessingPlan(planValue); setStatusMessage(""); setErrorMessage("");
    try {
      const response = await createSubscriptionOrder({ plan: planValue });
      if (!response?.success) throw new Error(response?.message || "Unable to start subscription.");

      if (planValue === "free") {
        await refreshAfterActivation(response.message || "Free plan activated.");
        return;
      }

      const scriptUrl = "https://checkout.razorpay.com/v1/checkout.js";
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = scriptUrl;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Razorpay checkout could not be loaded. No payment was taken."));
          document.body.appendChild(script);
        });
      }

      const razorpay = new window.Razorpay({
        key: response.keyId,
        amount: response.order.amount,
        currency: response.order.currency,
        name: "Supply Link",
        description: `${planValue.toUpperCase()} Subscription Plan`,
        order_id: response.order.id,
        handler: async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
          try {
            const verified = await verifySubscriptionPayment({ plan: planValue, razorpay_order_id, razorpay_payment_id, razorpay_signature });
            if (verified?.success) await refreshAfterActivation(verified.message || "Payment verified and subscription activated.");
            else setErrorMessage(verified?.message || "Payment verification failed. The plan was not confirmed.");
          } catch (error) {
            setErrorMessage(errorText(error, "Unable to complete payment verification."));
          }
        },
        modal: { ondismiss: () => setStatusMessage("Checkout closed before payment verification. Your plan has not been changed.") },
        theme: { color: "#d98a1f" },
      });
      razorpay.open();
    } catch (error) {
      setErrorMessage(errorText(error, "Unable to launch subscription checkout."));
    } finally { setProcessingPlan(""); }
  };

  const planKey = subscription?.plan;
  const currentPlan = plans.find((plan) => plan.value === planKey);
  const status = subscription?.status;
  const statusLabel = status === "active" ? "Active" : status === "expired" ? "Expired" : status === "inactive" ? "Inactive" : status || "Unknown";
  const expiryDate = subscription?.expiresAt && formatDate(subscription.expiresAt);

  return <div className="space-y-6">
    <PageHeader title="Billing" description="Review your current plan and manage a one-time plan checkout." theme={theme} />

    {loadError && <div className={`flex flex-wrap items-center justify-between gap-3 border p-4 ${paper}`} role="alert"><div className="flex min-w-0 items-start gap-2 text-sm text-[#8b332d]"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{loadError}</span></div><button type="button" onClick={() => loadStatus(false)} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f]"><RefreshCw size={14} aria-hidden="true" />Retry</button></div>}

    <section className={`border p-4 sm:p-5 ${paper}`} aria-labelledby="current-plan-heading">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="grid size-10 shrink-0 place-items-center border border-[#e2dccf] bg-[#f7f4ee] text-[#a86a16]"><CreditCard size={18} aria-hidden="true" /></div><div className="min-w-0"><h2 id="current-plan-heading" className="font-[Fraunces] text-xl">Current subscription</h2><p className={`mt-1 text-sm ${muted}`}>{loading ? "Checking billing status…" : loadError ? "Current plan could not be confirmed." : currentPlan ? `${subscription.displayName || currentPlan.name} · ${subscription.amount === 0 ? "No charge" : `${formatAmount(subscription.amount, subscription.currency)} / ${subscription.interval || "month"}`}` : "Plan details unavailable."}</p></div></div>
        {!loading && !loadError && subscription && <span className={`border px-2.5 py-1 text-xs font-semibold ${status === "active" ? "border-[#b8c9a9] bg-[#f0f5eb] text-[#3d5d2b]" : "border-[#e2dccf] bg-[#f7f4ee] text-[#6f685d]"}`}>{statusLabel}</span>}
      </div>
      {!loading && !loadError && subscription && <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-[#e2dccf] pt-4 sm:grid-cols-2">
        <div><dt className={`text-xs ${muted}`}>Plan</dt><dd className="mt-1 break-words text-sm font-semibold">{subscription.displayName || currentPlan?.name || "Unavailable"}</dd></div>
        <div><dt className={`text-xs ${muted}`}>Product limit</dt><dd className="mt-1 text-sm font-semibold">{subscription.productLimit == null ? "No plan limit" : `${subscription.productLimit} products`}</dd></div>
        <div><dt className={`text-xs ${muted}`}>Last updated</dt><dd className="mt-1 text-sm">{formatDate(subscription.updatedAt)}</dd></div>
        <div><dt className={`text-xs ${muted}`}>Expires</dt><dd className="mt-1 text-sm">{expiryDate || (currentPlan?.amount === 0 ? "No expiry date" : "Not provided")}</dd></div>
      </dl>}
    </section>

    {statusMessage && <div role="status" className={`flex items-start gap-2 border border-[#b8c9a9] bg-[#f0f5eb] p-4 text-sm text-[#3d5d2b]`}><Check size={17} aria-hidden="true" className="mt-0.5 shrink-0" />{statusMessage}</div>}
    {errorMessage && <div role="alert" className="flex items-start gap-2 border border-[#d8b3a8] bg-[#fff6f3] p-4 text-sm text-[#8b332d]"><AlertCircle size={17} aria-hidden="true" className="mt-0.5 shrink-0" />{errorMessage}</div>}

    <section aria-labelledby="plans-heading"><div className="mb-3"><h2 id="plans-heading" className="font-[Fraunces] text-xl">Available plans</h2><p className={`mt-1 text-sm ${muted}`}>Plan pricing and product limits match the current subscription configuration.</p></div>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">{plans.map((plan) => {
        const isCurrent = plan.value === planKey;
        const active = isCurrent && status === "active";
        return <article key={plan.value} className={`flex min-w-0 flex-col border p-4 sm:p-5 ${paper} ${isCurrent ? "border-[#d98a1f]" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-[Fraunces] text-xl">{plan.name}</h3>{isCurrent && <span className="border border-[#e2dccf] bg-[#f7f4ee] px-2 py-1 text-[11px] font-semibold">Current</span>}</div>
          <p className={`mt-1 min-h-10 text-sm leading-relaxed ${muted}`}>{plan.description}</p>
          <p className="mt-4 break-words font-[Fraunces] text-2xl">{plan.amount === 0 ? "Free" : formatAmount(plan.amount, plan.currency)}<span className={`ml-1 font-sans text-xs font-normal ${muted}`}>{plan.amount ? `/ ${plan.interval}` : "plan"}</span></p>
          <p className={`mt-2 border-t border-[#e2dccf] pt-3 text-sm ${muted}`}>Product limit: <span className="font-semibold text-[#1c1a17]">{plan.productLimit == null ? "No plan limit" : plan.productLimit}</span></p>
          <div className="mt-auto pt-5"><Button type="button" variant={active ? "secondary" : "primary"} disabled={loading || Boolean(loadError) || Boolean(processingPlan) || active} loading={processingPlan === plan.value} onClick={() => handlePlanSelection(plan.value)} className="w-full">{active ? "Current active plan" : isCurrent && status === "expired" ? "Renew this plan" : plan.amount === 0 ? "Switch to Free" : `Choose ${plan.name}`}</Button></div>
        </article>;
      })}</div>
    </section>

    <p className={`border-t border-[#e2dccf] pt-4 text-xs leading-relaxed ${muted}`}>Paid plans use a one-time Razorpay checkout for a fixed entitlement period. The current status and expiry above come from your account record. There is no cancellation or payment-history action available in this interface.</p>
  </div>;
}
