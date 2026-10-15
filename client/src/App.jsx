
import "./App.css";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const Products = lazy(() => import("./pages/Products"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Customers = lazy(() => import("./pages/Customers"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const Storefront = lazy(() => import("./pages/Storefront"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("supplylink_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f6f3ee] text-[#385744]">Loading Supply Link…</main>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/store/:slug" element={<Storefront />} />
      <Route path="/track/:token" element={<TrackOrder />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
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
