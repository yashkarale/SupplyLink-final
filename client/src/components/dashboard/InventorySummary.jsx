
import { AlertTriangle, ArrowRight, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchDashboardSummary } from "../../services/api";

export default function InventorySummary() {
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
    <div className="rounded-2xl border border-[#e9ede7] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#26372b]">Inventory health</h2>
          <p className="mt-1 text-xs text-[#909b91]">Stock that needs attention</p>
        </div>
        <div className="rounded-xl bg-[#edf4ed] p-2.5 text-[#3e7c4d]"><Package size={19} /></div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-[#fff8e9] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2 text-[#c38b2b]"><AlertTriangle size={17} /></div>
            <div><p className="text-xs font-semibold text-[#6c5222]">Low stock</p><p className="mt-1 text-[10px] text-[#aa8b54]">Restock soon</p></div>
          </div>
          <span className="text-xl font-bold text-[#9c7022]">{summary.lowStockCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[#fff0ed] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2 text-[#c66753]"><Package size={17} /></div>
            <div><p className="text-xs font-semibold text-[#804338]">Out of stock</p><p className="mt-1 text-[10px] text-[#b17d73]">Unavailable products</p></div>
          </div>
          <span className="text-xl font-bold text-[#b75a45]">{summary.outOfStockCount}</span>
        </div>
      </div>
      <Link to="/inventory" className="mt-5 flex items-center justify-between border-t border-[#eef0ec] pt-4 text-xs font-semibold text-[#39784a]">
        Manage inventory <ArrowRight size={15} />
      </Link>
    </div>
  );
}
