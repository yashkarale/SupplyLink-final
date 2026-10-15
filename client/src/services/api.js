import axios from "axios";
import { slugify } from "../utils/slugify";

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.data?.code === "EMAIL_VERIFICATION_REQUIRED") {
      localStorage.removeItem("supplylink_token");
      if (!["/login", "/register", "/verify-email"].includes(window.location.pathname)) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

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

export const verifyEmail = async (token) => {
  const response = await api.post("/auth/verify-email", { token });
  return response.data;
};

export const resendVerificationEmail = async (email) => {
  const response = await api.post("/auth/resend-verification", { email });
  return response.data;
};

export const getSellerProfile = async () => {
  const response = await api.get("/sellers/me");
  return response.data;
};

export const updateSellerStoreSettings = async (payload) => {
  const response = await api.put("/sellers/store-settings", payload);
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

export const updateProduct = async (productId, payload) => {
  const response = await api.put(`/products/${productId}`, payload);
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

export const fetchPublicOrderStatus = async (token) => {
  const response = await api.get(`/orders/track/${encodeURIComponent(token)}`);
  return response.data;
};

export const updateOrderStatus = async (orderId, orderStatus) => {
  const response = await api.patch(`/orders/${orderId}/status`, { orderStatus });
  return response.data;
};

export const createPublicOrder = async ({ slug, items, customer, paymentMethod = "COD" }) => {
  const canonicalSlug = slugify(slug);
  const response = await fetch(`${baseURL}/store/${encodeURIComponent(canonicalSlug)}/orders`, {
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

export const fetchPublicStore = async (slug) => {
  const canonicalSlug = slugify(slug || "mystore");
  const response = await fetch(`${baseURL}/store/${encodeURIComponent(canonicalSlug)}`);

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || "Store unavailable");
  }

  return payload;
};

export const subscribeToPublicStore = (slug) => {
  const canonicalSlug = slugify(slug || "mystore");
  return new EventSource(`${baseURL}/store/${encodeURIComponent(canonicalSlug)}/events`);
};

export const buildStoreContactUrl = (contactPath, items = [], product = "") => {
  if (!contactPath) return "";
  const apiRoot = new URL(baseURL, window.location.origin);
  const target = new URL(contactPath, apiRoot);
  if (product) target.searchParams.set("product", product);
  else if (items.length) {
    target.searchParams.set("items", JSON.stringify(items.map((item) => ({ productId: item.productId || item.id, quantity: item.quantity }))));
  }
  return target.toString();
};

export const getBillingStatus = async () => {
  const response = await api.get("/billing/status");
  return response.data;
};

export const createSubscriptionOrder = async (payload) => {
  const response = await api.post("/billing/create-order", payload);
  return response.data;
};

export const verifySubscriptionPayment = async (payload) => {
  const response = await api.post("/billing/verify", payload);
  return response.data;
};

export const fetchAiInsights = async () => {
  const mlBaseUrl = import.meta.env.VITE_ML_URL;
  if (!mlBaseUrl) {
    return {
      summary: { forecast: "Unavailable", inventoryHealth: "Unavailable", customerPulse: "Unavailable" },
      modules: [],
      connected: false,
    };
  }

  try {
    const response = await fetch(`${mlBaseUrl}/insights`);
    if (!response.ok) {
      throw new Error("ML service unavailable");
    }

    return await response.json();
  } catch {
    return {
      summary: {
        forecast: "Unavailable",
        inventoryHealth: "Unavailable",
        customerPulse: "Unavailable",
      },
      modules: [],
      connected: false,
    };
  }
};
