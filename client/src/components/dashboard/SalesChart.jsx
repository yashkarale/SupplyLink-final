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
import { fetchDashboardSummary } from "../../services/api";

const money = (value) => `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;

export default function SalesChart({ theme = "light" }) {
  const isDark = theme === "dark";
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
    [series]
  );

  const strokeColor = isDark ? "#818CF8" : "#4F46E5";
  const gridColor = isDark ? "#29364B" : "#E2E8F0";
  const textColor = isDark ? "#8290A5" : "#64748B";

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 ${
        isDark
          ? "border-[#29364B] bg-[#151D2E] text-[#F1F5F9]"
          : "border-[#E2E8F0] bg-white text-[#172033]"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Sales overview</h2>
          <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#8290A5]">
            Revenue performance over the last 7 days
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] dark:border-[#29364B] px-2.5 py-1 text-xs font-semibold text-[#64748B] dark:text-[#8290A5]">
          Last 7 days
        </div>
      </div>
      <div className="mb-5 flex items-baseline gap-3">
        <p className="text-3xl font-extrabold tracking-tight">
          ₹{Number(totalRevenue).toLocaleString("en-IN")}
        </p>
        <span className="rounded-full bg-emerald-50 dark:bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-400/20">
          Live
        </span>
      </div>
      <div className="h-[260px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[#64748B] dark:text-[#8290A5]">
            No sales data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 3, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFillStandalone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: textColor, fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={money} tick={{ fill: textColor, fontSize: 10 }} />
              <Tooltip
                cursor={{ stroke: textColor, strokeDasharray: "3 3" }}
                formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                contentStyle={{
                  backgroundColor: isDark ? "#151D2E" : "#FFFFFF",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 12,
                  fontSize: 12,
                  color: isDark ? "#F1F5F9" : "#172033",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={strokeColor}
                strokeWidth={2.5}
                fill="url(#salesFillStandalone)"
                activeDot={{ r: 5, fill: strokeColor, stroke: isDark ? "#151D2E" : "#FFFFFF", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
