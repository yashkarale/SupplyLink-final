
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export default function StatCard({ title, value, change, note, icon: Icon, positive = true }) {
  return (
    <div className="rounded-2xl border border-[#e9ede7] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#1b3921]/5 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4ed] text-[#347048]">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <span className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${positive ? "bg-[#edf7ef] text-[#32814a]" : "bg-[#fff1ed] text-[#c36b50]"}`}>
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change}
        </span>
      </div>
      <p className="mt-5 text-xs font-medium text-[#879187]">{title}</p>
      <p className="mt-1.5 text-[26px] font-bold tracking-tight text-[#203226]">{value}</p>
      <p className="mt-2 text-[11px] text-[#9aa49b]">{note}</p>
    </div>
  );
}