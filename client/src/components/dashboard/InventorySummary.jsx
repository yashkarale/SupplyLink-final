import { AlertTriangle, ArrowRight, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchDashboardSummary } from "../../services/api";

export default function InventorySummary({ theme = "light" }) {
  const isDark = theme === "dark";
  const [summary, setSummary] = useState({ lowStockCount: 0, outOfStockCount: 0 });

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetchDashboardSummary();
        const analytics = response?.analytics || {};
        setSummary({
          lowStockCount: Number(analytics.lowStockCount || 0),
          outOfStockCount: Number(analytics.outOfStockCount || 0),
        });
      } catch {
        setSummary({ lowStockCount: 0, outOfStockCount: 0 });
      }
    };

    loadSummary();
  }, []);

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 ${
        isDark
          ? "border-[#29364B] bg-[#151D2E] text-[#F1F5F9]"
          : "border-[#E2E8F0] bg-white text-[#172033]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Inventory health</h2>
          <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#8290A5]">
            Stock requiring attention
          </p>
        </div>
        <div className="rounded-xl bg-[#EEF2FF] dark:bg-[#252B50] p-2 text-[#4F46E5] dark:text-[#818CF8]">
          <Package size={18} />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/40 p-3.5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 dark:bg-amber-900/60 p-1.5 text-amber-700 dark:text-amber-300">
              <AlertTriangle size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Low stock</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">Restock recommended</p>
            </div>
          </div>
          <span className="text-lg font-extrabold text-amber-800 dark:text-amber-300">
            {summary.lowStockCount}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/40 p-3.5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-100 dark:bg-rose-900/60 p-1.5 text-rose-700 dark:text-rose-300">
              <Package size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Out of stock</p>
              <p className="text-[10px] text-rose-700 dark:text-rose-400">Unavailable for buyers</p>
            </div>
          </div>
          <span className="text-lg font-extrabold text-rose-800 dark:text-rose-300">
            {summary.outOfStockCount}
          </span>
        </div>
      </div>
      <Link
        to="/inventory"
        className="mt-5 flex items-center justify-between border-t border-[#E2E8F0] dark:border-[#29364B] pt-4 text-xs font-bold text-[#4F46E5] dark:text-[#818CF8] hover:underline"
      >
        Manage inventory <ArrowRight size={14} />
      </Link>
    </div>
  );
}
