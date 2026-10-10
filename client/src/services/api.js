import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("supplylink_token");

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("supplylink_token", token);
    return;
  }

  localStorage.removeItem("supplylink_token");
};

export const loginUser = async (payload) => {
  const response = await api.post("/auth/login", payload);
  return response.data;
};

export const registerUser = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data;
};

export const getSellerProfile = async () => {
  const response = await api.get("/sellers/me");
  return response.data;
};

export const fetchDashboardSummary = async () => {
  const response = await api.get("/sellers/dashboard");
  return response.data;
};

export const onboardSeller = async (payload) => {
  const response = await api.post("/sellers/onboarding", payload);
  return response.data;
};

export const fetchProducts = async () => {
  const response = await api.get("/products");
  return response.data;
};

export const createProduct = async (payload) => {
  const response = await api.post("/products", payload);
  return response.data;
};

export const updateInventory = async (productId, payload) => {
  const response = await api.patch(`/products/${productId}/stock`, payload);
  return response.data;
};

export const fetchOrders = async () => {
  const response = await api.get("/orders");
  return response.data;
};

export const updateOrderStatus = async (orderId, orderStatus) => {
  const response = await api.patch(`/orders/${orderId}/status`, { orderStatus });
  return response.data;
};

export const createPublicOrder = async ({ slug, items, customer, paymentMethod = "COD" }) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/store/${encodeURIComponent(slug)}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items,
      customer,
      paymentMethod,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Unable to place order");
  }

  return payload;
};

export const fetchAiInsights = async () => {
  const mlBaseUrl = import.meta.env.VITE_ML_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${mlBaseUrl}/insights`);
    if (!response.ok) {
      throw new Error("ML service unavailable");
    }

    return await response.json();
  } catch (error) {
    return {
      summary: {
        forecast: "Demand trending up 18%",
        inventoryHealth: "93% healthy",
        customerPulse: "Repeat buyers strong",
      },
      modules: [
        { title: "Demand forecasting", score: 92, insight: "Best-selling items are likely to rise in the next 7 days.", trend: "+18%" },
        { title: "Inventory optimization", score: 88, insight: "Reorder 3 SKUs before Friday to avoid stockouts.", trend: "+12%" },
        { title: "Customer segmentation", score: 90, insight: "Returning buyers are contributing 62% of spend.", trend: "+9%" },
      ],
      connected: false,
    };
  }
};
