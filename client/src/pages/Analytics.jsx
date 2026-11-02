import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Boxes, IndianRupee, ShoppingBag, Users } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { fetchDashboardSummary } from "../services/api";

const paper = "border-[#e2dccf] bg-[#fffdf9] text-[#1c1a17]";
const muted = "text-[#6f685d]";
const currency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const normalizeDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return {
    from: normalizeDateInput(from),
    to: normalizeDateInput(to),
  };
};

export default function Analytics() {
  const { theme = "light" } = useOutletContext() || {};
  const [range, setRange] = useState(defaultRange());
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextRange = range) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchDashboardSummary({
        fromDate: nextRange?.from || undefined,
        toDate: nextRange?.to || undefined,
      });
      if (!response?.analytics) throw new Error("Analytics data was not included in the response.");
      setAnalytics(response.analytics);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { Promise.resolve().then(() => load(range)); }, [load]);

  const overview = analytics?.salesOverview || {};
  const trendSeries = useMemo(() => (Array.isArray(analytics?.trends?.daily) ? analytics.trends.daily : Array.isArray(analytics?.salesSeries) ? analytics.salesSeries.map((item) => ({ date: item.day, revenue: item.revenue, salesCount: item.orders || 0 })) : []).map((item) => ({
    label: item.date || item.day || "—",
    revenue: number(item.revenue),
    salesCount: number(item.salesCount || item.orders || 0),
    onlineRevenue: number(item.onlineRevenue || 0),
    offlineRevenue: number(item.offlineRevenue || 0),
  })), [analytics]);

  const comparisonSeries = useMemo(() => (Array.isArray(analytics?.trends?.onlineVsOffline) ? analytics.trends.onlineVsOffline : []).map((item) => ({
    label: item.date || item.day || "—",
    onlineRevenue: number(item.onlineRevenue),
    offlineRevenue: number(item.offlineRevenue),
  })), [analytics]);

  const productRows = Array.isArray(analytics?.productPerformance?.topProducts) ? analytics.productPerformance.topProducts : [];
  const paymentRows = Array.isArray(analytics?.paymentBreakdown) ? analytics.paymentBreakdown : [];
  const customerRows = Array.isArray(analytics?.customerInsights?.topCustomers) ? analytics.customerInsights.topCustomers : [];
  const noRecentSales = Array.isArray(analytics?.productPerformance?.noRecentSales) ? analytics.productPerformance.noRecentSales : [];

  const metrics = [
    { label: "Total revenue", value: currency(overview.totalRevenue ?? analytics?.totalRevenue ?? analytics?.totalSales), detail: "Completed sales only · excludes cancelled, failed, and unpaid transactions", Icon: IndianRupee },
    { label: "Total sales", value: number(overview.totalSalesCount ?? analytics?.totalSalesCount ?? analytics?.totalOrders).toLocaleString("en-IN"), detail: "Completed online and offline sales counted separately", Icon: ShoppingBag },
    { label: "Online revenue", value: currency(overview.onlineRevenue ?? 0), detail: "Completed online order revenue", Icon: IndianRupee },
    { label: "Offline revenue", value: currency(overview.offlineRevenue ?? 0), detail: "Completed offline POS walk-in sales", Icon: IndianRupee },
    { label: "Average sale value", value: currency(overview.averageTransactionValue ?? overview.averageOrderValue ?? analytics?.averageOrderValue), detail: "Total completed revenue divided by completed sales", Icon: Activity },
    { label: "Unique customers", value: number(analytics?.customerInsights?.totalUniqueCustomers ?? analytics?.customerCount ?? 0).toLocaleString("en-IN"), detail: "Customer records with available contact details", Icon: Users },
    { label: "Products sold", value: productRows.reduce((sum, product) => sum + number(product.quantitySold), 0).toLocaleString("en-IN"), detail: "Units sold across completed sales", Icon: Boxes },
    { label: "Payment methods", value: paymentRows.length ? paymentRows.length.toString() : "0", detail: "Active payment methods in the selected range", Icon: IndianRupee },
  ];

  return <div className="space-y-6">
    <PageHeader title="Unified analytics" description="Online storefront orders and offline POS sales are combined into a single seller business view. Revenue is counted only for completed transactions and excludes cancelled, failed, or unpaid sales." theme={theme} />

    {error && <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 border p-4 text-sm ${paper}`}>
      <span className={muted}>{error}</span><button type="button" onClick={() => load()} className="font-semibold text-[#8f550b] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f]">Retry</button>
    </div>}

    <section className={`border p-4 ${paper}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-[Fraunces] text-xl">Business overview</h2>
          <p className={`mt-1 text-sm ${muted}`}>Selected range: {range.from || "—"} to {range.to || "—"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="text-sm">
            <span className={muted}>From</span>
            <input type="date" value={range.from} onChange={(event) => setRange((previous) => ({ ...previous, from: event.target.value }))} className="mt-1 block w-full border border-[#e2dccf] bg-[#fffdf9] px-3 py-2 text-sm text-[#1c1a17] outline-none" />
          </label>
          <label className="text-sm">
            <span className={muted}>To</span>
            <input type="date" value={range.to} onChange={(event) => setRange((previous) => ({ ...previous, to: event.target.value }))} className="mt-1 block w-full border border-[#e2dccf] bg-[#fffdf9] px-3 py-2 text-sm text-[#1c1a17] outline-none" />
          </label>
          <button type="button" onClick={() => load(range)} className="self-end rounded-md border border-[#d98a1f] bg-[#d98a1f] px-3 py-2 text-sm font-semibold text-white">Apply</button>
        </div>
      </div>
    </section>

    <section aria-label="Store metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, detail, Icon }) => <article key={label} className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
        <div className="flex items-center justify-between gap-3"><h2 className={`text-xs font-semibold ${muted}`}>{label}</h2><Icon size={17} aria-hidden="true" className="shrink-0 text-[#a86a16]" /></div>
        <p className="mt-3 break-words font-[Fraunces] text-2xl tracking-tight">{loading ? "—" : error ? "Unavailable" : value}</p>
        <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{detail}</p>
      </article>)}
    </section>

    <section className={`min-w-0 border p-4 sm:p-6 ${paper}`} aria-labelledby="sales-trend-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="sales-trend-heading" className="font-[Fraunces] text-xl">Revenue trend</h2><p className={`mt-1 text-sm ${muted}`}>Completed revenue across online and offline sales</p></div>
        <span className={`border border-[#e2dccf] px-2.5 py-1 text-xs ${muted}`}>Selected range</span>
      </div>
      {loading ? <div className="grid h-64 place-items-center text-sm text-[#6f685d]">Loading sales data…</div>
        : error ? <div className="grid h-64 place-items-center text-sm text-[#6f685d]">Chart unavailable until data loads.</div>
          : !trendSeries.length ? <div className="grid min-h-64 place-items-center px-4 text-center text-sm text-[#6f685d]">No completed sales are available for the selected period.</div>
            : <div className="h-72" role="img" aria-label="Revenue trend chart for completed sales">
              <ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendSeries} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e2dccf" strokeDasharray="2 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6f685d", fontSize: 11 }} />
                <YAxis width={58} axisLine={false} tickLine={false} tick={{ fill: "#6f685d", fontSize: 10 }} tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                <Tooltip formatter={(value, name) => [currency(value), name === "revenue" ? "Revenue" : "Sales count"]} contentStyle={{ background: "#fffdf9", borderColor: "#e2dccf", borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="revenue" name="revenue" fill="#d98a1f" maxBarSize={42} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="salesCount" name="salesCount" stroke="#5f7f6b" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart></ResponsiveContainer>
            </div>}
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
        <h2 className="font-[Fraunces] text-xl">Online vs offline</h2>
        <p className={`mt-1 text-sm ${muted}`}>Completed revenue split by channel</p>
        {loading ? <div className="mt-4 grid h-48 place-items-center text-sm text-[#6f685d]">Loading channels…</div>
          : !comparisonSeries.length ? <div className="mt-4 grid min-h-48 place-items-center px-4 text-center text-sm text-[#6f685d]">No channel comparison is available yet.</div>
            : <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={comparisonSeries} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e2dccf" strokeDasharray="2 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6f685d", fontSize: 10 }} />
                <YAxis width={58} axisLine={false} tickLine={false} tick={{ fill: "#6f685d", fontSize: 10 }} tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                <Tooltip formatter={(value) => [currency(value), "Revenue"]} contentStyle={{ background: "#fffdf9", borderColor: "#e2dccf", borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="onlineRevenue" fill="#d98a1f" radius={[3, 3, 0, 0]} />
                <Bar dataKey="offlineRevenue" fill="#5f7f6b" radius={[3, 3, 0, 0]} />
              </BarChart></ResponsiveContainer>
            </div>}
      </section>

      <section className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
        <h2 className="font-[Fraunces] text-xl">Top products</h2>
        <p className={`mt-1 text-sm ${muted}`}>Best-selling items based on completed sales</p>
        {loading ? <div className="mt-4 grid h-48 place-items-center text-sm text-[#6f685d]">Loading product performance…</div>
          : !productRows.length ? <div className="mt-4 grid min-h-48 place-items-center px-4 text-center text-sm text-[#6f685d]">No product sales have been recorded for the selected range.</div>
            : <div className="mt-4 space-y-3">
              {productRows.slice(0, 6).map((product) => <div key={product._id || product.name} className="rounded border border-[#e2dccf] bg-[#fffaf3] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1c1a17]">{product.name}</p>
                    <p className="text-xs text-[#6f685d]">{number(product.quantitySold).toLocaleString("en-IN")} units sold</p>
                  </div>
                  <span className="text-sm font-semibold text-[#1c1a17]">{currency(product.revenue)}</span>
                </div>
              </div>)}
            </div>}
      </section>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
        <h2 className="font-[Fraunces] text-xl">Payment mix</h2>
        <p className={`mt-1 text-sm ${muted}`}>Completed revenue by payment method</p>
        {loading ? <div className="mt-4 grid h-40 place-items-center text-sm text-[#6f685d]">Loading payment data…</div>
          : !paymentRows.length ? <div className="mt-4 grid min-h-40 place-items-center px-4 text-center text-sm text-[#6f685d]">No payment_method data is available yet.</div>
            : <div className="mt-4 space-y-3">
              {paymentRows.map((entry) => <div key={entry.method} className="space-y-1">
                <div className="flex justify-between text-sm"><span className="font-medium text-[#1c1a17]">{entry.method}</span><span className="text-[#6f685d]">{currency(entry.revenue)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#efe7d8]"><div className="h-full rounded-full bg-[#d98a1f]" style={{ width: `${Math.min(100, (number(entry.revenue) / Math.max(number(paymentRows[0]?.revenue), 1)) * 100)}%` }} /></div>
              </div>)}
            </div>}
      </section>

      <section className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
        <h2 className="font-[Fraunces] text-xl">Customer insights</h2>
        <p className={`mt-1 text-sm ${muted}`}>Top customers by completed spend</p>
        {loading ? <div className="mt-4 grid h-40 place-items-center text-sm text-[#6f685d]">Loading customer data…</div>
          : !customerRows.length ? <div className="mt-4 grid min-h-40 place-items-center px-4 text-center text-sm text-[#6f685d]">No customer data is available from completed sales.</div>
            : <div className="mt-4 space-y-3">
              {customerRows.slice(0, 5).map((customer) => <div key={`${customer.email || customer.phone || customer.name}-${customer.totalValue}`} className="rounded border border-[#e2dccf] bg-[#fffaf3] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1c1a17]">{customer.name}</p>
                    <p className="text-xs text-[#6f685d]">{customer.orderCount} purchases</p>
                  </div>
                  <span className="text-sm font-semibold text-[#1c1a17]">{currency(customer.totalValue)}</span>
                </div>
              </div>)}
            </div>}
      </section>
    </div>

    {noRecentSales.length > 0 && <section className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
      <h2 className="font-[Fraunces] text-xl">Products without recent sales</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {noRecentSales.slice(0, 10).map((product) => <span key={product._id} className="rounded-full border border-[#e2dccf] bg-[#fffaf3] px-3 py-1 text-xs text-[#6f685d]">{product.name}</span>)}
      </div>
    </section>}
  </div>;
}
