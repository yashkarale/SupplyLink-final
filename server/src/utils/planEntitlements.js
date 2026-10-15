export const normalizeSellerPlan = (plan) => ({ starter: "launch", pro: "scale" }[plan] || plan || "free");

export const getProductLimitForSeller = (seller, now = new Date()) => {
  const plan = normalizeSellerPlan(seller?.plan);
  const paidPlanActive = ["launch", "scale"].includes(plan)
    && seller?.subscriptionStatus === "active"
    && seller?.planExpiresAt
    && new Date(seller.planExpiresAt).getTime() > now.getTime();

  return paidPlanActive ? null : 2;
};
