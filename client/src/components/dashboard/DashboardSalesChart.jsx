import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardSalesChart({ data }) {
  const strokeColor = "var(--accent)";
  const gridColor = "var(--line)";
  const textColor = "var(--muted)";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 15, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="2 4" />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: textColor, fontSize: 11, fontWeight: 500 }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: textColor, fontSize: 10 }}
          tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
        />
        <Tooltip
          formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
          contentStyle={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--line)",
            borderRadius: 5,
            fontSize: 12,
            boxShadow: "0 4px 12px rgb(28 26 23 / 10%)",
            color: "var(--ink)",
          }}
          labelStyle={{ color: textColor, fontWeight: 600, marginBottom: 4 }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke={strokeColor}
          strokeWidth={2.5}
          fill={strokeColor}
          fillOpacity={0.12}
          activeDot={{ r: 4, fill: strokeColor, stroke: "var(--surface)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
