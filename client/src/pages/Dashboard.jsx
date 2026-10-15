
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  Ellipsis,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
  ArrowUpRight as ExternalLink,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { fetchDashboardSummary } from "../services/api";

function StatCard({ title, value, change, positive, icon: Icon }) {
  return (
    <div className="group rounded-[26px] border border-[#e9ece7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,246,0.96))] p-5 shadow-[0_18px_35px_rgba(15,38,25,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_45px_rgba(15,38,25,0.08)]">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#edf5ef,#e4efe8)] text-[#286746] shadow-inner">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <button
          type="button"
          aria-label={`More options for ${title}`}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100"
        >
          <Ellipsis size={19} />
        </button>
      </div>

      <p className="mt-5 text-[13px] font-medium text-[#778079]">{title}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-2xl font-bold tracking-tight text-[#1c2921]">{value}</h3>
        <span
          className={`mb-1 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
            positive ? "bg-[#eaf7ee] text-[#247348]" : "bg-[#fff0ed] text-[#b64b3a]"
          }`}
        >
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#9aa19b]">Live store data</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Confirmed: "bg-blue-50 text-blue-700",
    Processing: "bg-amber-50 text-amber-700",
    Delivered: "bg-emerald-50 text-emerald-700",
    Pending: "bg-gray-100 text-gray-600",
    PENDING: "bg-gray-100 text-gray-600",
    SHIPPED: "bg-violet-50 text-violet-700",
    CANCELLED: "bg-rose-50 text-rose-700",
  };

  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function Dashboard() {
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    customerCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    salesSeries: [],
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetchDashboardSummary();
        const analytics = response?.analytics || {};
        setSummary({
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
        setSummary({
          totalSales: 0,
          totalOrders: 0,
          totalProducts: 0,
          customerCount: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          salesSeries: [],
          recentOrders: [],
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const chartData = useMemo(
    () =>
      summary.salesSeries.map((entry) => ({
        day: entry.day,
        sales: toNumber(entry.revenue),
      })),
    [summary.salesSeries],
  );

  const revenueValue = formatMoney(summary.totalSales);
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-xs font-medium text-[#8a948d]">Workspace / Overview</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#1b2920] sm:text-3xl">
            Good evening<span className="text-[#378157]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#7a847d]">Here’s what’s happening with your store right now.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="flex items-center gap-2 rounded-xl border border-[#e3e8e1] bg-white px-3.5 py-2.5 text-xs font-medium text-[#4e5c52] transition hover:bg-gray-50">
            <CalendarDays size={15} />
            Last 7 days
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-[#173d2c] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#24583e]">
            <Download size={15} />
            Export view
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-[28px] bg-[linear-gradient(135deg,#173d2c_0%,#234d3a_28%,#316c4c_100%)] p-5 text-white shadow-[0_25px_60px_rgba(17,43,28,0.12)] sm:p-7">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              YOUR BUSINESS AT A GLANCE
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Every order is an opportunity.</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/65">Bring your products, orders and customer relationships together in one place.</p>
          </div>
          <button type="button" onClick={() => window.open("/products", "_self")} className="flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#173d2c] transition hover:-translate-y-0.5 hover:bg-emerald-50">
            Manage catalog
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total sales" value={revenueValue} change={summary.totalOrders ? "Live" : "No sales"} positive={summary.totalOrders > 0} icon={TrendingUp} />
        <StatCard title="Total orders" value={String(summary.totalOrders)} change={summary.totalOrders ? "Live" : "No orders"} positive={summary.totalOrders > 0} icon={ShoppingBag} />
        <StatCard title="Customers" value={String(summary.customerCount)} change={summary.customerCount ? "Live" : "None yet"} positive={summary.customerCount > 0} icon={Users} />
        <StatCard title="Products listed" value={String(summary.totalProducts)} change={summary.lowStockCount ? `${summary.lowStockCount} low stock` : "Healthy"} positive={summary.lowStockCount === 0} icon={Package} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="min-w-0 rounded-[26px] border border-[#e9ece7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,247,0.96))] p-5 shadow-[0_18px_35px_rgba(15,38,25,0.04)] sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#243329]">Sales overview</h2>
              <p className="mt-1 text-xs text-[#8b958d]">Revenue performance over the last 7 days</p>
            </div>
            <button type="button" aria-label="Sales chart options" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
              <Ellipsis size={19} />
            </button>
          </div>

          <div className="mb-3">
            <span className="text-3xl font-bold tracking-tight text-[#1b2920]">{revenueValue}</span>
            <span className="ml-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2c8553]">
              <ArrowUpRight size={14} />
              {summary.totalOrders ? "Updating" : "Waiting for orders"}
            </span>
          </div>

          <div className="h-[260px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-[#768178]">Loading sales data...</div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[#768178]">No completed orders yet. Your sales chart will appear here once you start receiving orders.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 15, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3a9462" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#3a9462" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#edf0eb" strokeDasharray="4 4" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#909991", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#909991", fontSize: 10 }} tickFormatter={(value) => `₹${value / 1000}k`} />
                  <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Sales"]} contentStyle={{ border: "1px solid #e7ebe5", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="sales" stroke="#328255" strokeWidth={2.5} fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-[#e9ece7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,247,0.96))] p-5 shadow-[0_18px_35px_rgba(15,38,25,0.04)] sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#243329]">Inventory health</h2>
              <p className="mt-1 text-xs text-[#8b958d]">Real stock snapshot</p>
            </div>
            <Package size={18} className="text-[#6d8b76]" />
          </div>

          <div className="space-y-5">
            {[
              { name: "In stock", count: Math.max(0, summary.totalProducts - summary.lowStockCount - summary.outOfStockCount), percent: summary.totalProducts ? Math.max(5, Math.round(((summary.totalProducts - summary.lowStockCount - summary.outOfStockCount) / summary.totalProducts) * 100)) : 0, color: "bg-[#4b9669]" },
              { name: "Low stock", count: summary.lowStockCount, percent: summary.totalProducts ? Math.round((summary.lowStockCount / summary.totalProducts) * 100) : 0, color: "bg-[#e2ac4f]" },
              { name: "Out of stock", count: summary.outOfStockCount, percent: summary.totalProducts ? Math.round((summary.outOfStockCount / summary.totalProducts) * 100) : 0, color: "bg-[#d87867]" },
            ].map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#69756c]">{item.name}</span>
                  <span className="text-xs font-bold text-[#29392e]">{item.count} products</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f0f2ee]">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-xl border border-amber-100 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <Package size={17} />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-900">Stock needs attention</p>
                <p className="mt-1 text-xs leading-5 text-amber-800/80">{summary.lowStockCount || summary.outOfStockCount ? "Review the inventory list and restock the flagged SKUs." : "Your inventory is healthy right now."}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-[#e9ece7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,247,0.96))] shadow-[0_18px_35px_rgba(15,38,25,0.04)]">
        <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-sm font-bold text-[#243329]">Recent orders</h2>
            <p className="mt-1 text-xs text-[#8b958d]">Your latest customer activity</p>
          </div>
          <button type="button" onClick={() => window.location.assign("/orders")} className="flex w-fit items-center gap-2 text-xs font-semibold text-[#28764a] hover:text-[#174d30]">
            View all orders
            <ExternalLink size={13} />
          </button>
        </div>

        {summary.recentOrders.length === 0 ? (
          <div className="p-6 text-sm text-[#69756c]">No orders yet. Once a customer places an order, it will appear here automatically.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left">
              <thead>
                <tr className="border-y border-[#edf0eb] bg-[#fafbf9]">
                  {['ORDER', 'CUSTOMER', 'DATE', 'AMOUNT', 'STATUS'].map((label) => (
                    <th key={label} className="px-6 py-3 text-[10px] font-bold tracking-wider text-[#89928b]">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-[#f0f2ee] last:border-0 transition hover:bg-[#fbfcfa]">
                    <td className="px-6 py-4 text-xs font-semibold text-[#2e5d41]">{order.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf3eb] text-[10px] font-bold text-[#386448]">{order.customer.slice(0, 2).toUpperCase()}</div>
                        <span className="text-xs font-medium text-[#354239]">{order.customer}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#78827a]">{order.date}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-[#29392e]">{formatMoney(order.total)}</td>
                    <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
