import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Crown, LoaderCircle, Sparkles } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import {
  createSubscriptionOrder,
  getBillingStatus,
  verifySubscriptionPayment,
} from "../services/api";

const plans = [
  {
    name: "Free",
    value: "free",
    price: "₹0",
    period: "forever",
    description: "For sellers starting online",
    features: [
      "Basic mini-store",
      "Up to 2 non-archived products",
      "Order management",
      "Basic analytics",
    ],
  },
  {
    name: "Launch",
    value: "launch",
    price: "₹99",
    period: "per month",
    description: "Best for new and growing sellers",
    features: [
      "Everything in Free",
      "Unlimited products",
      "Inventory tools",
      "Customer CRM",
      "Weekly reports",
    ],
  },
  {
    name: "Scale",
    value: "scale",
    price: "₹299",
    period: "per month",
    description: "Premium operations and AI growth",
    features: [
      "Everything in Launch",
      "Demand forecasting",
      "AI insights",
      "Priority support",
      "Advanced automation",
    ],
  },
];

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      try {
        const response = await getBillingStatus();
        const currentPlan = response?.subscription?.plan || "free";
        setSelectedPlan(currentPlan);
      } catch {
        setStatusMessage("Unable to load current subscription status.");
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentPlan();
  }, []);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.value === selectedPlan) || plans[1],
    [selectedPlan],
  );

  const handlePlanSelection = async (planValue) => {
    setIsProcessing(true);
    setStatusMessage("");

    try {
      const response = await createSubscriptionOrder({ plan: planValue });

      if (!response?.success) {
        throw new Error(response?.message || "Unable to start subscription.");
      }

      if (planValue === "free") {
        setSelectedPlan(planValue);
        setStatusMessage(response.message || "Free plan activated.");
        return;
      }

      const razorpayScriptUrl = "https://checkout.razorpay.com/v1/checkout.js";
      const script = document.createElement("script");
      script.src = razorpayScriptUrl;

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      const razorpay = new window.Razorpay({
        key: response.keyId,
        amount: response.order.amount,
        currency: response.order.currency,
        name: "Supply Link",
        description: `${planValue} subscription`,
        order_id: response.order.id,
        handler: async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
          try {
            const verifyResponse = await verifySubscriptionPayment({
              plan: planValue,
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
            });

            if (verifyResponse?.success) {
              setSelectedPlan(planValue);
              setStatusMessage("Subscription activated successfully with Razorpay.");
            } else {
              setStatusMessage(verifyResponse?.message || "Payment verification failed.");
            }
          } catch (verificationError) {
            setStatusMessage(verificationError?.response?.data?.message || verificationError.message || "Unable to verify payment.");
          }
        },
        modal: { ondismiss: () => setStatusMessage("Checkout was closed before payment verification.") },
        theme: {
          color: "#1f5d39",
        },
      });

      razorpay.open();
    } catch (error) {
      setStatusMessage(error?.message || "Unable to start subscription checkout.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Billing & plan"
        description="Manage your subscription and understand your plan options."
      />
      <div className="mb-6 rounded-2xl border border-[#dcebdd] bg-[#edf6ec] p-5 sm:p-6 premium-panel">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white p-3 text-[#347048]">
              <CreditCard size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2c5937]">
                Current plan: {loading ? "Loading..." : activePlan.name}
              </p>
              <p className="mt-1 text-xs text-[#6f8973]">
                Premium billing experience · {loading ? "-" : `${activePlan.price} / month`}
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#39764a]">
            {loading ? "Checking" : activePlan.name === "Free" ? "No payment due" : "Payment active"}
          </span>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-[#dfe8df] bg-[#f8faf8] p-4 text-xs leading-6 text-[#446553]">
        Subscription billing is handled through Razorpay. Product orders on
        seller storefronts stay on WhatsApp and do not carry marketplace
        commission fees.
      </div>

      {statusMessage && (
        <div className="mb-5 rounded-xl border border-[#dbeae0] bg-[#eef7ef] px-3 py-2 text-xs text-[#2d5639]">
          {statusMessage}
        </div>
      )}

      <div className="mb-5">
        <h2 className="text-base font-bold text-[#26372b]">Choose a plan</h2>
        <p className="mt-1 text-xs text-[#909b91]">
          Premium SaaS pricing designed for scaling sellers.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`premium-card relative flex flex-col rounded-2xl border bg-white p-6 ${plan.value === selectedPlan ? "border-[#5a9669] shadow-lg shadow-[#1b3921]/5" : "border-[#e9ede7]"}`}
          >
            {plan.name === "Launch" && (
              <span className="absolute right-4 top-4 rounded-full bg-[#eaf4eb] px-2.5 py-1 text-[9px] font-bold text-[#327348]">
                POPULAR
              </span>
            )}
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf4ed] text-[#347048]">
              {plan.name === "Scale" ? (
                <Crown size={21} />
              ) : plan.name === "Launch" ? (
                <Sparkles size={21} />
              ) : (
                <CreditCard size={21} />
              )}
            </div>
            <h3 className="text-lg font-bold text-[#26372b]">{plan.name}</h3>
            <p className="mt-1 text-xs text-[#909b91]">{plan.description}</p>
            <div className="mb-5 mt-5">
              <span className="text-3xl font-bold tracking-tight text-[#25372a]">
                {plan.price}
              </span>
              <span className="ml-1 text-xs text-[#909b91]">{plan.period}</span>
            </div>
            <div className="mb-6 h-px bg-[#eef0ec]" />
            <ul className="flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-xs text-[#647166]"
                >
                  <Check size={15} className="mt-0.5 shrink-0 text-[#438457]" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePlanSelection(plan.value)}
              disabled={isProcessing}
              className={`mt-7 w-full rounded-xl px-4 py-3 text-xs font-black transition ${plan.value === selectedPlan ? "bg-[#1f5d39] text-white shadow-[0_10px_24px_rgba(29,87,56,0.18)]" : "border border-[#dfe8de] bg-[#f5f8f3] text-[#2d533d] hover:bg-[#edf6ee]"} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {isProcessing ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LoaderCircle size={14} className="animate-spin" /> Processing
                </span>
              ) : plan.value === selectedPlan ? (
                "Selected plan"
              ) : "Choose plan"}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-[#e9ede7] bg-white p-5 premium-card">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#3d5140]">
          Subscription flow
        </p>
        <p className="mt-2 text-xs leading-5 text-[#89948a]">
          Razorpay will be used only for the platform subscription model, while
          storefront product orders remain seller-led through WhatsApp for a
          lower-commission, trust-first flow.
        </p>
      </div>
    </div>
  );
}
