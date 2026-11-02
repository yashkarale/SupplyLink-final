
import "./App.css";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const Products = lazy(() => import("./pages/Products"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Pos = lazy(() => import("./pages/POS"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));
const Customers = lazy(() => import("./pages/Customers"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const MarketplaceProduct = lazy(() => import("./pages/MarketplaceProduct"));
const ShopDiscovery = lazy(() => import("./pages/ShopDiscovery"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const Storefront = lazy(() => import("./pages/Storefront"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Admin = lazy(() => import("./pages/Admin"));

function PageLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#F5F3ED] dark:bg-[#0E1118] px-5 transition-colors"
      role="status"
      aria-label="Loading Supply Link"
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#171B24] text-lg font-black text-[#C8F169] shadow-lg">
          S
        </div>
        <p className="mt-4 text-sm font-bold text-[#171B24] dark:text-[#F3F5F7]">
          Loading Supply Link
        </p>
        <div className="mt-5 space-y-2" aria-hidden="true">
          <div className="mx-auto h-1.5 w-3/4 rounded-full bg-[#E6E2D8] dark:bg-[#2A313B] animate-pulse" />
          <div className="mx-auto h-1.5 w-1/2 rounded-full bg-[#E6E2D8] dark:bg-[#2A313B] animate-pulse" />
        </div>
      </div>
    </main>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("supplylink_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = pathname === "/" || pathname === "/marketplace"
      ? "Supply Link | Local Marketplace"
      : pathname === "/shops"
        ? "Shop Discovery | Supply Link"
        : pathname.startsWith("/marketplace/product")
          ? "Product Details | Supply Link"
          : pathname.startsWith("/store/")
            ? "Local Storefront | Supply Link"
            : pathname.startsWith("/track/")
              ? "Order Tracking | Supply Link"
              : pathname === "/admin"
                ? "Platform Administration | Supply Link"
                : pathname === "/sell" || pathname === "/login" || pathname === "/register" || pathname === "/onboarding"
                  ? "Seller Workspace | Supply Link"
                  : "Supply Link | Seller Workspace";
    document.title = title;
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RouteTitle />
      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/sell" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/shops" element={<ShopDiscovery />} />
        <Route path="/marketplace/product/:sellerSlug/:productSlug" element={<MarketplaceProduct />} />
        <Route path="/marketplace/product/:slug" element={<MarketplaceProduct />} />
        <Route path="/marketplace/products/:sellerSlug/:productSlug" element={<MarketplaceProduct />} />
        <Route path="/marketplace/products/:slug" element={<MarketplaceProduct />} />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        <Route path="/store/:slug" element={<Storefront />} />
        <Route path="/track/:token" element={<TrackOrder />} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/sales-history" element={<SalesHistory />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/ai-insights" element={<AIInsights />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
