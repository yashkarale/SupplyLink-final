export const PLAN_ORDER = ["free", "launch", "scale"];

export const SUBSCRIPTION_PLANS = {
  free: {
    name: "free",
    displayName: "Free",
    amount: 0,
    currency: "INR",
    interval: "month",
    productLimit: 2,
    description: "For sellers starting online",
  },
  launch: {
    name: "launch",
    displayName: "Launch",
    amount: 9900,
    currency: "INR",
    interval: "month",
    productLimit: null,
    description: "Best for new and growing sellers",
  },
  scale: {
    name: "scale",
    displayName: "Scale",
    amount: 29900,
    currency: "INR",
    interval: "month",
    productLimit: null,
    description: "Premium operations and AI growth",
  },
};

export const getPlanConfig = (planName) => {
  const normalizedName = String(planName || "free").trim().toLowerCase();

  if (!SUBSCRIPTION_PLANS[normalizedName]) {
    throw new Error("Unsupported subscription plan");
  }

  return { ...SUBSCRIPTION_PLANS[normalizedName] };
};
