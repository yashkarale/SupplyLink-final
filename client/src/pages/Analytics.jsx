import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Boxes, IndianRupee, ShoppingBag, Users } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { fetchDashboardSummary } from "../services/api";

const paper = "border-[#e2dccf] bg-[#fffdf9] text-[#1c1a17]";
const muted = "text-[#6f685d]";
const currency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function Analytics() {
  const { theme = "light" } = useOutletContext() || {};
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = true) => {
    if (refresh) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetchDashboardSummary();
      if (!response?.analytics) throw new Error("Analytics data was not included in the response.");
      setAnalytics(response.analytics);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(() => load(false)); }, [load]);

  const series = useMemo(() => (Array.isArray(analytics?.salesSeries) ? analytics.salesSeries : []).map((item) => ({
    day: item.day,
    revenue: number(item.revenue),
  })), [analytics]);

  const metrics = [
    { label: "Recognized sales value", value: currency(analytics?.totalSales), detail: "Verified payments and delivered COD · excludes cancelled and returned orders", Icon: IndianRupee },
    { label: "Gross order value", value: currency(analytics?.orderValues?.grossOrderValue), detail: "All recorded orders, including unpaid and cancelled orders", Icon: IndianRupee },
    { label: "Pending payment value", value: currency(analytics?.orderValues?.pendingPaymentValue), detail: "Pending payments excluding cancelled, returned, and delivered COD orders", Icon: IndianRupee },
    { label: "Failed payment value", value: currency(analytics?.orderValues?.failedPaymentValue), detail: "Recorded order value with a failed payment state", Icon: IndianRupee },
    { label: "Cancelled order value", value: currency(analytics?.orderValues?.cancelledOrderValue), detail: "Recorded value of cancelled orders; excluded from recognized sales", Icon: IndianRupee },
    { label: "Refunds", value: analytics?.orderValues?.refundTrackingSupported ? "Tracked" : "Unavailable", detail: "Buyer order refunds and partial refunds are not stored", Icon: IndianRupee },
    { label: "Orders", value: number(analytics?.totalOrders).toLocaleString("en-IN"), detail: "All recorded order statuses", Icon: ShoppingBag },
    { label: "Average recognized order", value: currency(analytics?.averageOrderValue), detail: "Recognized sales divided by recognized orders", Icon: Activity },
    { label: "Recorded customers", value: number(analytics?.customerCount).toLocaleString("en-IN"), detail: "Seller-scoped contact groups from orders", Icon: Users },
    { label: "Products", value: number(analytics?.totalProducts).toLocaleString("en-IN"), detail: "Products in your catalog", Icon: Boxes },
  ];

  return <div className="space-y-6">
    <PageHeader title="Analytics" description="Recognized sales use verified payments and delivered COD, excluding cancelled and returned orders. Gross order value includes all recorded order states. Values use total order amounts, including shipping and discounts; seller fees and buyer refunds are not recorded here." theme={theme} />

    {error && <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 border p-4 text-sm ${paper}`}>
      <span className={muted}>{error}</span><button type="button" onClick={() => load()} className="font-semibold text-[#8f550b] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f]">Retry</button>
    </div>}

    <section aria-label="Store metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ label, value, detail, Icon }) => <article key={label} className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
        <div className="flex items-center justify-between gap-3"><h2 className={`text-xs font-semibold ${muted}`}>{label}</h2><Icon size={17} aria-hidden="true" className="shrink-0 text-[#a86a16]" /></div>
        <p className="mt-3 break-words font-[Fraunces] text-2xl tracking-tight">{loading ? "—" : error ? "Unavailable" : value}</p>
        <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{detail}</p>
      </article>)}
    </section>

    <section className={`min-w-0 border p-4 sm:p-6 ${paper}`} aria-labelledby="sales-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="sales-heading" className="font-[Fraunces] text-xl">Daily recognized revenue</h2><p className={`mt-1 text-sm ${muted}`}>Last 7 calendar days · verified payments and delivered COD orders</p></div>
        <span className={`border border-[#e2dccf] px-2.5 py-1 text-xs ${muted}`}>INR</span>
      </div>
      {loading ? <div className={`grid h-64 place-items-center text-sm ${muted}`} role="status">Loading sales data…</div>
        : error ? <div className={`grid h-64 place-items-center text-sm ${muted}`}>Chart unavailable until data loads.</div>
          : !series.length ? <div className={`grid min-h-64 place-items-center px-4 text-center text-sm ${muted}`}>No daily sales data is available yet.</div>
            : <div className="h-64 min-w-0 sm:h-72" role="img" aria-label="Bar chart of daily recognized revenue for the last seven calendar days">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e2dccf" strokeDasharray="2 4" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#6f685d", fontSize: 11 }} />
                <YAxis width={58} axisLine={false} tickLine={false} tick={{ fill: "#6f685d", fontSize: 10 }} tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                <Tooltip formatter={(value) => [currency(value), "Recognized revenue"]} contentStyle={{ background: "#fffdf9", borderColor: "#e2dccf", borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="revenue" name="Recognized revenue" fill="#d98a1f" maxBarSize={42} radius={[3, 3, 0, 0]} />
              </BarChart></ResponsiveContainer>
            </div>}
    </section>
    <p className={`text-xs leading-relaxed ${muted}`}>This view uses the seller dashboard summary. It does not provide date filters or comparison periods.</p>
  </div>;
}
