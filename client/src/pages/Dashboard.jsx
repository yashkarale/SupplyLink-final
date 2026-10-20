import {
  ArrowRight,
  AlertTriangle,
  Boxes,
  ChartNoAxesCombined,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardSummary } from "../services/api";
import StatusBadge from "../components/ui/StatusBadge";
import "./DashboardPremium.css";

const DashboardSalesChart = lazy(() => import("../components/dashboard/DashboardSalesChart"));

const EMPTY_SUMMARY = {
  businessName: "",
  totalSales: 0,
  totalOrders: 0,
  totalProducts: 0,
  customerCount: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  salesSeries: [],
  recentOrders: [],
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const surface = "border border-line bg-surface";

function MetricCard({ title, value, detail, icon: Icon, href, loading }) {
  const content = (
    <div className={`${surface} dashboard-metric flex min-h-36 min-w-0 flex-col justify-between p-4 transition-colors hover:border-line-strong sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted">{title}</span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[5px] border border-line bg-paper text-ink">
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <div className="mt-4 h-8 w-28 animate-pulse bg-paper" aria-hidden="true" />
      ) : (
        <>
          <div className="mt-4 break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{value}</div>
          <p className="mt-1 text-[11px] text-muted">{detail}</p>
        </>
      )}
    </div>
  );

  return href ? (
    <Link to={href} className="block rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {content}
    </Link>
  ) : content;
}

function LoadingPanel() {
  return (
    <div className={`${surface} grid min-h-52 place-items-center p-6`} role="status" aria-live="polite">
      <span className="text-sm text-muted">Loading your store overview…</span>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const response = await fetchDashboardSummary();
        const analytics = response?.analytics;
        if (!analytics) throw new Error("Dashboard data is unavailable.");
        if (!active) return;
        setSummary({
          businessName: analytics.businessName || "",
          totalSales: toNumber(analytics.totalSales),
          totalOrders: toNumber(analytics.totalOrders),
          totalProducts: toNumber(analytics.totalProducts),
          customerCount: toNumber(analytics.customerCount),
          lowStockCount: toNumber(analytics.lowStockCount),
          outOfStockCount: toNumber(analytics.outOfStockCount),
          salesSeries: Array.isArray(analytics.salesSeries) ? analytics.salesSeries : [],
          recentOrders: Array.isArray(analytics.recentOrders) ? analytics.recentOrders : [],
        });
      } catch {
        if (active) setLoadError("We couldn't load your store overview. Check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDashboard();
    return () => { active = false; };
  }, [refreshToken]);

  const chartData = useMemo(
    () => summary.salesSeries.map((entry) => ({ day: entry.day, sales: toNumber(entry.revenue) })),
    [summary.salesSeries]
  );
  const hasSalesHistory = chartData.some((entry) => entry.sales > 0);
  const sevenDaySales = chartData.reduce((total, entry) => total + entry.sales, 0);
  const retryDashboard = () => {
    setLoading(true);
    setLoadError("");
    setRefreshToken((current) => current + 1);
  };

  return (
    <div className="dashboard-page mx-auto w-full max-w-[1440px] min-w-0 space-y-7 sm:space-y-9">
      <header className="dashboard-cover flex min-w-0 flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Seller workspace · Overview</p>
          <h1 className="mt-2 break-words font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            {summary.businessName || "Store overview"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Your business, in focus. Review sales, stay ahead of stock, and keep orders moving.</p>
        </div>
        <div className="dashboard-cover-actions flex flex-wrap gap-2">
          <Link to="/products" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-line-strong bg-surface px-3.5 text-xs font-semibold text-ink transition hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Package size={15} /> Manage products
          </Link>
          <Link to="/orders" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] bg-ink px-3.5 text-xs font-semibold text-paper transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <ShoppingBag size={15} /> View orders <ArrowRight size={14} />
          </Link>
        </div>
        <aside className="dashboard-sales-highlight" aria-label="Sales summary">
          <p className="dashboard-sales-label">Recognized sales · all time</p>
          {loading ? <div className="mt-2 h-9 w-36 animate-pulse bg-white/10" aria-hidden="true" /> : <p className="dashboard-sales-total">{formatMoney(summary.totalSales)}</p>}
          <div className="dashboard-sales-period">
            <span>Last seven days</span>
            {loading ? <span className="h-4 w-20 animate-pulse bg-white/10" aria-hidden="true" /> : <strong>{formatMoney(sevenDaySales)}</strong>}
          </div>
        </aside>
      </header>

      {loadError ? (
        <section className={`${surface} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`} role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={18} />
            <div>
              <h2 className="text-sm font-semibold text-ink">Overview unavailable</h2>
              <p className="mt-1 text-sm text-muted">{loadError}</p>
            </div>
          </div>
          <button type="button" onClick={retryDashboard} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-[5px] border border-line-strong px-3 text-xs font-semibold text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:self-auto">
            <RefreshCw size={14} /> Try again
          </button>
        </section>
      ) : (
        <>
          <section aria-label="Store metrics" className="dashboard-metrics grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Gross sales" value={formatMoney(summary.totalSales)} detail="Recognized order revenue · all time" icon={TrendingUp} loading={loading} />
            <MetricCard title="Orders" value={summary.totalOrders.toLocaleString("en-IN")} detail="All storefront orders" icon={ShoppingBag} href="/orders" loading={loading} />
            <MetricCard title="Customers" value={summary.customerCount.toLocaleString("en-IN")} detail="Customers with an order email" icon={Users} href="/customers" loading={loading} />
            <MetricCard title="Products" value={summary.totalProducts.toLocaleString("en-IN")} detail={`${summary.lowStockCount} low · ${summary.outOfStockCount} out of stock`} icon={Package} href="/products" loading={loading} />
          </section>

          {loading ? <LoadingPanel /> : (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
              <section className={`${surface} min-w-0 p-4 sm:p-5`} aria-labelledby="sales-title">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <h2 id="sales-title" className="font-serif text-xl font-semibold text-ink">Sales, last seven days</h2>
                    <p className="mt-1 text-xs text-muted">Daily recognized revenue from your orders</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink">{formatMoney(sevenDaySales)}</span>
                </div>
                {hasSalesHistory ? (
                  <div className="mt-4 h-[260px] w-full min-w-0">
                    <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted" role="status">Loading sales chart…</div>}>
                      <DashboardSalesChart data={chartData} />
                    </Suspense>
                  </div>
                ) : (
                  <div className="grid min-h-56 place-items-center px-4 py-8 text-center">
                    <div>
                      <ChartNoAxesCombined size={25} className="mx-auto text-muted" aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-ink">No sales in the last seven days</p>
                      <p className="mt-1 max-w-sm text-xs leading-5 text-muted">When recognized orders are recorded, the daily revenue trend will appear here.</p>
                    </div>
                  </div>
                )}
              </section>

              <section className={`${surface} p-4 sm:p-5`} aria-labelledby="stock-title">
                <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <h2 id="stock-title" className="font-serif text-xl font-semibold text-ink">Inventory check</h2>
                    <p className="mt-1 text-xs text-muted">Items that may need attention</p>
                  </div>
                  <Boxes size={18} className="text-muted" aria-hidden="true" />
                </div>
                {summary.totalProducts === 0 ? (
                  <div className="py-7">
                    <p className="text-sm font-semibold text-ink">Your catalog is empty</p>
                    <p className="mt-1 text-xs leading-5 text-muted">Add your first product to start tracking its stock here.</p>
                    <Link to="/products" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline underline-offset-4">Add a product <ArrowRight size={13} /></Link>
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    <Link to="/inventory" className="flex min-h-14 items-center justify-between gap-3 py-3 text-sm hover:text-accent">
                      <span className="text-muted">Low stock</span><span className="font-semibold tabular-nums text-ink">{summary.lowStockCount}</span>
                    </Link>
                    <Link to="/inventory" className="flex min-h-14 items-center justify-between gap-3 py-3 text-sm hover:text-accent">
                      <span className="text-muted">Out of stock</span><span className="font-semibold tabular-nums text-ink">{summary.outOfStockCount}</span>
                    </Link>
                  </div>
                )}
                {summary.lowStockCount + summary.outOfStockCount > 0 && (
                  <div className="mt-3 flex items-start gap-2 border-l-2 border-accent bg-paper p-3 text-xs leading-5 text-muted">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                    Review flagged stock before taking more orders.
                  </div>
                )}
              </section>
            </div>
          )}

          <section className={`${surface} min-w-0 overflow-hidden`} aria-labelledby="orders-title">
            <div className="flex flex-col justify-between gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:px-5">
              <div>
                <h2 id="orders-title" className="font-serif text-xl font-semibold text-ink">Recent orders</h2>
                <p className="mt-1 text-xs text-muted">The five latest orders from your store</p>
              </div>
              <Link to="/orders" className="inline-flex min-h-10 w-fit items-center gap-1.5 text-xs font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                All orders <ArrowRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div className="p-5" role="status"> <div className="h-10 animate-pulse bg-paper" /> </div>
            ) : summary.recentOrders.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-sm font-semibold text-ink">No orders yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted">New customer orders will appear here.</p>
                </div>
                <Link to="/products" className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-line-strong px-3 text-xs font-semibold text-ink hover:bg-paper">Review products <ArrowRight size={14} /></Link>
              </div>
            ) : (
              <>
                <div className="divide-y divide-line md:hidden">
                  {summary.recentOrders.map((order) => (
                    <Link key={order.id} to="/orders" className="block p-4 transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-accent">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{order.customer}</p>
                          <p className="mt-1 truncate text-[11px] text-muted">{order.id} · {order.date}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatMoney(order.total)}</span>
                      </div>
                      <div className="mt-3"><StatusBadge status={order.status} /></div>
                    </Link>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="bg-paper text-[10px] font-semibold uppercase tracking-wider text-muted">
                      <tr>{["Order", "Customer", "Date", "Amount", "Status"].map((label) => <th key={label} className="px-4 py-3 font-semibold sm:px-5">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {summary.recentOrders.map((order) => (
                        <tr key={order.id} className="transition-colors hover:bg-paper">
                          <td className="px-4 py-4 text-xs font-semibold text-ink sm:px-5"><Link to="/orders" className="underline-offset-4 hover:underline">{order.id}</Link></td>
                          <td className="max-w-52 truncate px-4 py-4 text-xs text-ink sm:px-5">{order.customer}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs text-muted sm:px-5">{order.date}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold tabular-nums text-ink sm:px-5">{formatMoney(order.total)}</td>
                          <td className="px-4 py-4 sm:px-5"><StatusBadge status={order.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
