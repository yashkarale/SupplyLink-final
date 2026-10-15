
import { Activity, ArrowUpRight, IndianRupee, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { fetchDashboardSummary } from "../services/api";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export default function Analytics() {
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalOrders: 0,
    customerCount: 0,
    salesSeries: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetchDashboardSummary();
        const analytics = response?.analytics || {};
        setSummary({
          totalSales: toNumber(analytics.totalSales),
          totalOrders: toNumber(analytics.totalOrders),
          customerCount: toNumber(analytics.customerCount),
          salesSeries: Array.isArray(analytics.salesSeries) ? analytics.salesSeries : [],
        });
      } catch {
        setSummary({ totalSales: 0, totalOrders: 0, customerCount: 0, salesSeries: [] });
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  const salesData = useMemo(
    () => summary.salesSeries.map((entry) => ({ day: entry.day, revenue: toNumber(entry.revenue) })),
    [summary.salesSeries],
  );

  const totalRevenue = summary.totalSales;
  const totalOrders = summary.totalOrders;
  const averageOrder = totalOrders ? totalRevenue / totalOrders : 0;

  const metrics = [
    { title: "Gross sales", value: formatCurrency(totalRevenue), detail: "Live revenue in the last 7 days", icon: IndianRupee },
    { title: "Total orders", value: totalOrders, detail: "Orders captured by your live store", icon: ShoppingCart },
    { title: "Average order value", value: formatCurrency(averageOrder), detail: "Revenue divided by orders", icon: TrendingUp },
    { title: "Customers", value: summary.customerCount, detail: "Unique buyers in recent orders", icon: Activity },
  ];

  return (
    <div>
      <PageHeader title="Analytics" description="Measure sales performance and understand store activity." />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, value, detail, icon: Icon }) => (
          <div key={title} className="rounded-2xl border border-[#e9ede7] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-[#879187]">{title}</span>
              <Icon size={18} className="text-[#438457]" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-[#25372a]">{value}</p>
            <p className="mt-2 text-[11px] text-[#9aa49b]">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-[#e9ede7] bg-white p-5 sm:p-6">
        <div className="mb-6">
          <h2 className="text-sm font-bold text-[#26372b]">Daily sales</h2>
          <p className="mt-1 text-xs text-[#909b91]">Revenue breakdown by day</p>
        </div>

        {loading ? (
          <div className="flex h-[320px] items-center justify-center text-xs text-[#768178]">Loading sales analytics...</div>
        ) : salesData.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-xs text-[#768178]">No sales data yet. The chart will populate as orders come in.</div>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0eb" strokeDasharray="4 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9ba59c", fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fill: "#9ba59c", fontSize: 10 }} />
                <Tooltip formatter={(v) => [formatCurrency(v), "Revenue"]} contentStyle={{ border: "1px solid #e5ebe3", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#4d9662" radius={[7, 7, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e9ede7] bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[#edf4ed] p-2.5 text-[#347048]"><Users size={19} /></div>
            <h2 className="text-sm font-bold text-[#26372b]">Customer growth</h2>
          </div>
          <p className="text-sm leading-6 text-[#7d897f]">Your customer records are generated from actual recent orders and buyer activity.</p>
          <div className="mt-5 rounded-xl bg-[#f6f8f5] p-4">
            <p className="text-xs font-semibold text-[#49634e]">Live data</p>
            <p className="mt-1 text-xs text-[#8b978c]">Unique customers: {summary.customerCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[#e9ede7] bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[#edf4ed] p-2.5 text-[#347048]"><ArrowUpRight size={19} /></div>
            <h2 className="text-sm font-bold text-[#26372b]">Sales opportunities</h2>
          </div>
          <p className="text-sm leading-6 text-[#7d897f]">Monitor stock health, repeat customers and recurring revenue using your live business data.</p>
          <div className="mt-5 rounded-xl bg-[#f6f8f5] p-4">
            <p className="text-xs font-semibold text-[#49634e]">Live signal</p>
            <p className="mt-1 text-xs text-[#8b978c]">Average order value: {formatCurrency(averageOrder)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
