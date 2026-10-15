
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { fetchDashboardSummary } from "../../services/api";

const money = (value) => `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;

export default function SalesChart() {
  const [series, setSeries] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetchDashboardSummary();
        const analytics = response?.analytics || {};
        setSeries(Array.isArray(analytics.salesSeries) ? analytics.salesSeries : []);
        setTotalRevenue(Number(analytics.totalSales || 0));
      } catch {
        setSeries([]);
        setTotalRevenue(0);
      }
    };

    loadSummary();
  }, []);

  const chartData = useMemo(
    () => series.map((entry) => ({ day: entry.day, revenue: Number(entry.revenue || 0) })),
    [series],
  );

  return (
    <div className="rounded-2xl border border-[#e9ede7] bg-white p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#26372b]">Sales overview</h2>
          <p className="mt-1 text-xs text-[#909b91]">Revenue performance over the last 7 days</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e8ede6] px-3 py-2 text-xs font-medium text-[#68766b]">This week <span>⌄</span></div>
      </div>
      <div className="mb-5 flex items-end gap-3">
        <p className="text-3xl font-bold tracking-tight text-[#213629]">₹{Number(totalRevenue).toLocaleString("en-IN")}</p>
        <span className="mb-1 rounded-md bg-[#edf7ef] px-2 py-1 text-[10px] font-semibold text-[#39804b]">Live</span>
      </div>
      <div className="h-[260px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[#768178]">No sales data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 3, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#62a777" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#62a777" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#edf0eb" strokeDasharray="4 5" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9ba59c", fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={money} tick={{ fill: "#9ba59c", fontSize: 10 }} />
              <Tooltip
                cursor={{ stroke: "#b9cdbd", strokeDasharray: "4 4" }}
                formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                contentStyle={{ border: "1px solid #e5ebe3", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px #183b2110" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#388453" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 5, fill: "#388453", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
