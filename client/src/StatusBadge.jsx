
const statusStyles = {
  Processing: "amber",
  Pending: "amber",
  "At risk": "amber",

  Confirmed: "blue",
  Returning: "blue",

  Shipped: "violet",
  New: "violet",

  Delivered: "emerald",
  Active: "emerald",
  Loyal: "emerald",
  Paid: "emerald",

  Cancelled: "rose",
  "Out of stock": "rose",
};

const palettes = {
  light: {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  dark: {
    amber: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    blue: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    violet: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    rose: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
    neutral: "bg-slate-700/60 text-slate-300 ring-slate-600",
  },
};

export default function StatusBadge({
  status,
  theme = "light",
  className = "",
}) {
  const label =
    typeof status === "string" && status.trim()
      ? status.trim()
      : "Unknown";

  const palette = theme === "dark" ? palettes.dark : palettes.light;
  const color = statusStyles[label] || "neutral";

  return (
    <span
      className={[
        "inline-flex items-center whitespace-nowrap",
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        "ring-1 ring-inset",
        palette[color],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}
