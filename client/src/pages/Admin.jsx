import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Building2, RefreshCw, Shield, Store, Users } from "lucide-react";
import { getAdminAuditLogs, getAdminDashboard, getAdminSellers, getAdminSubscriptions, getCurrentUser, updateAdminSellerStatus } from "../services/api";

const money = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0) / (currency === "INR" ? 100 : 1));
const date = (value) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "—";
const paper = "border border-[#e2dccf] bg-[#fffdf9]";

export default function Admin() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [checkoutAttempts, setCheckoutAttempts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busySellerId, setBusySellerId] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    getCurrentUser().then(({ user }) => {
      if (!active) return;
      if (user?.role !== "admin") {
        navigate("/dashboard", { replace: true });
        return;
      }
      setAuthorized(true);
    }).catch((requestError) => {
      if (active) setError(requestError?.response?.data?.message || "Administrator access could not be verified.");
    }).finally(() => { if (active) setAuthChecking(false); });
    return () => { active = false; };
  }, [navigate]);

  const load = useCallback(async () => {
    if (!authorized) return;
    setError("");
    try {
      const [dashboard, sellerList, subscriptionList, audit] = await Promise.all([
        getAdminDashboard(),
        getAdminSellers({ page, limit: 12, search, status }),
        getAdminSubscriptions({ page: 1, limit: 8 }),
        getAdminAuditLogs({ page: 1, limit: 8 }),
      ]);
      setMetrics(dashboard.metrics);
      setSellers(sellerList.sellers || []);
      setPagination(sellerList.pagination || { page: 1, totalPages: 1, total: 0 });
      setSubscriptions(subscriptionList.payments || []);
      setCheckoutAttempts(subscriptionList.checkouts || []);
      setAuditLogs(audit.logs || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load the platform workspace.");
    }
  }, [authorized, page, search, status, refresh]);

  useEffect(() => { load(); }, [load]);

  const moderateSeller = async (seller) => {
    const nextStatus = seller.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`${nextStatus === "suspended" ? "Suspend" : "Reactivate"} ${seller.businessName}?`)) return;
    setBusySellerId(seller.id);
    setError("");
    try {
      await updateAdminSellerStatus(seller.id, nextStatus);
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update seller status.");
    } finally { setBusySellerId(""); }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (authChecking) return <main className="grid min-h-screen place-items-center bg-[#f7f4ee] text-sm text-[#6f685d]" role="status">Checking administrator access…</main>;
  if (!authorized) return <main className="mx-auto max-w-xl p-6"><div role="alert" className={`${paper} p-5 text-sm`}>{error || "Administrator access is required."}<Link className="ml-2 font-semibold underline" to="/login">Sign in</Link></div></main>;

  const metricCards = [
    ["Registered sellers", metrics?.registeredSellers, Users],
    ["Active sellers", metrics?.activeSellers, Store],
    ["Suspended sellers", metrics?.suspendedSellers, Shield],
    ["Free subscribers", metrics?.freeSubscribers, Building2],
    ["Paid subscribers", metrics?.activePaidSubscribers, Building2],
    ["Published products", metrics?.publishedProductListings, Store],
    ["Orders", metrics?.orders, Users],
    ["Orders, last 30 days", metrics?.ordersLast30Days, Users],
  ];

  return <main className="min-h-screen bg-[#f7f4ee] px-4 py-6 text-[#1c1a17] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e2dccf] pb-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f550b]">Supply Link · Platform operations</p><h1 className="mt-2 font-[Fraunces] text-3xl sm:text-4xl">Administration</h1><p className="mt-2 text-sm text-[#6f685d]">Seller moderation, subscription records, and platform activity.</p></div>
        <div className="flex gap-2"><Link to="/marketplace" className="inline-flex min-h-10 items-center gap-2 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm font-semibold"><ArrowLeft size={15}/>Marketplace</Link><button type="button" onClick={() => setRefresh((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm font-semibold"><RefreshCw size={15}/>Refresh</button></div>
      </header>
      {error && <div role="alert" className="flex items-center gap-2 border border-[#d8b3a8] bg-[#fff6f3] p-3 text-sm text-[#8b332d]"><AlertCircle size={17}/>{error}</div>}
      <section aria-label="Platform metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metricCards.map(([label, value, Icon]) => <article key={label} className={`${paper} p-4`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-[#6f685d]">{label}</p><Icon size={17} className="text-[#8f550b]"/></div><p className="mt-3 text-2xl font-semibold tabular-nums">{value ?? "—"}</p></article>)}</section>
      <section className={`${paper} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-[Fraunces] text-2xl">Seller management</h2><p className="mt-1 text-sm text-[#6f685d]">{pagination.total} registered seller accounts. Status changes are recorded in the audit log.</p></div><form onSubmit={submitSearch} className="flex flex-wrap gap-2"><input aria-label="Search sellers" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Business, email, location" className="min-h-10 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm"/><select aria-label="Filter seller status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-h-10 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select><button className="min-h-10 border border-[#1c1a17] bg-[#1c1a17] px-4 text-sm font-semibold text-white">Search</button></form></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{sellers.map((seller) => <article key={seller.id} className="min-w-0 border border-[#e2dccf] bg-[#fffdf9] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{seller.businessName}</h3><p className="mt-1 break-all text-xs text-[#6f685d]">{seller.email} · /store/{seller.storeSlug}</p><p className="mt-1 text-xs text-[#6f685d]">{[seller.locality, seller.city, seller.state, seller.country].filter(Boolean).join(", ") || "No business location"}</p></div><span className="border border-[#e2dccf] px-2 py-1 text-xs font-semibold">{seller.status}</span></div><p className="mt-3 text-sm text-[#514b43]">{seller.category} · {seller.isPublished ? "Published" : "Draft"} · {seller.plan} plan ({seller.subscriptionStatus})</p><p className="mt-1 text-xs text-[#6f685d]">Plan expiry: {date(seller.planExpiresAt)} · Joined {date(seller.createdAt)}</p>{seller.status !== "pending" && <button type="button" disabled={busySellerId === seller.id} onClick={() => moderateSeller(seller)} className="mt-3 min-h-10 border border-[#e2dccf] px-3 text-sm font-semibold hover:bg-[#f2ede5] disabled:opacity-50">{busySellerId === seller.id ? "Saving…" : seller.status === "suspended" ? "Reactivate seller" : "Suspend seller"}</button>}</article>)}</div>
        {sellers.length === 0 && <p className="mt-4 border border-dashed border-[#d4cbbb] p-6 text-center text-sm text-[#6f685d]">No sellers match this search.</p>}
        {pagination.totalPages > 1 && <div className="mt-4 flex items-center justify-between"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-10 border border-[#e2dccf] px-3 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-[#6f685d]">Page {page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="min-h-10 border border-[#e2dccf] px-3 text-sm disabled:opacity-40">Next</button></div>}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${paper} p-4 sm:p-5`}><h2 className="font-[Fraunces] text-2xl">Subscription payments</h2><p className="mt-1 text-sm text-[#6f685d]">Read-only records of verified payments, entitlements, and refunds.</p><ul className="mt-4 divide-y divide-[#e2dccf]">{subscriptions.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{payment.seller?.businessName || "Seller account"} · {payment.plan}</span><span className="text-right">{money(payment.amount, payment.currency)} · {payment.status}<span className="block text-xs text-[#6f685d]">{date(payment.paidAt)}</span></span></li>)}</ul><p className="mt-2 text-xs text-[#6f685d]">Net subscription revenue: {money(metrics?.subscriptionRevenue)}</p></section>
        <section className={`${paper} p-4 sm:p-5`}><h2 className="font-[Fraunces] text-2xl">Pending and failed checkouts</h2><p className="mt-1 text-sm text-[#6f685d]">Read-only payment attempts that have not become verified subscription payments.</p><ul className="mt-4 divide-y divide-[#e2dccf]">{checkoutAttempts.map((checkout) => <li key={checkout.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{checkout.seller?.businessName || "Seller account"} · {checkout.plan}</span><span className="text-right">{money(checkout.amount, checkout.currency)} · {checkout.status}<span className="block text-xs text-[#6f685d]">Updated {date(checkout.updatedAt)}</span></span></li>)}</ul>{checkoutAttempts.length === 0 && <p className="mt-4 text-sm text-[#6f685d]">No pending or failed checkout attempts.</p>}</section><section className="border border-[#e2dccf] bg-[#fffdf9] p-4 sm:p-5"><h2 className="font-[Fraunces] text-2xl">Moderation audit</h2><p className="mt-1 text-sm text-[#6f685d]">Recent seller status changes.</p><ul className="mt-4 divide-y divide-[#e2dccf]">{auditLogs.map((log) => <li key={log._id} className="py-3 text-sm"><p className="font-medium">{log.action === "seller.suspend" ? "Seller suspended" : "Seller reactivated"}</p><p className="mt-1 text-xs text-[#6f685d]">{log.previousStatus} → {log.nextStatus} · {date(log.createdAt)}</p></li>)}</ul>{auditLogs.length === 0 && <p className="mt-4 text-sm text-[#6f685d]">No moderation actions recorded.</p>}</section>
      </div>
      <p className="text-xs leading-relaxed text-[#6f685d]">Seller verification controls, category administration, and supported-location configuration are unavailable because the current data model has no verification evidence or managed configuration records.</p>
    </div>
  </main>;
}
