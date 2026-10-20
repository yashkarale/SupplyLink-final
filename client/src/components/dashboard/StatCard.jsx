import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export default function StatCard({
  title,
  value,
  change,
  note,
  icon: Icon,
  positive = true,
  theme = "light",
}) {
  const isDark = theme === "dark";

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        isDark
          ? "border-[#29364B] bg-[#151D2E] text-[#F1F5F9] hover:border-[#3B4A62]"
          : "border-[#E2E8F0] bg-white text-[#172033] hover:border-[#CBD5E1]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isDark
              ? "bg-[#252B50] text-[#818CF8]"
              : "bg-[#EEF2FF] text-[#4F46E5]"
          }`}
        >
          <Icon size={19} strokeWidth={2} />
        </div>
        <span
          className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            positive
              ? isDark
                ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : isDark
                ? "bg-slate-800 text-slate-400 ring-1 ring-slate-700"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium text-[#64748B] dark:text-[#8290A5]">{title}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-[11px] text-[#94A3B8] dark:text-[#8290A5]">{note}</p>}
    </div>
  );
}