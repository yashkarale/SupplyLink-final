
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchDashboardSummary } from "../../services/api";
import StatusBadge from "../ui/StatusBadge";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function RecentOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await fetchDashboardSummary();
        setOrders(Array.isArray(response?.analytics?.recentOrders) ? response.analytics.recentOrders : []);
      } catch (error) {
        setOrders([]);
      }
    };

    loadOrders();
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e9ede7] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#eef0ec] px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-sm font-bold text-[#26372b]">Recent orders</h2>
          <p className="mt-1 text-xs text-[#909b91]">Keep track of your latest sales</p>
        </div>
        <Link to="/orders" className="flex items-center gap-1 text-xs font-semibold text-[#327348] hover:text-[#174a29]">View all <ArrowUpRight size={14} /></Link>
      </div>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <thead className="bg-[#fafbf9] text-[10px] uppercase tracking-wider text-[#98a198]">
            <tr>
              <th className="px-6 py-3 font-semibold">Order</th>
              <th className="px-6 py-3 font-semibold">Customer</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f2ee]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-5 text-xs text-[#758176]">No recent orders yet.</td>
              </tr>
            ) : orders.slice(0, 4).map((order) => (
              <tr key={order.id} className="transition hover:bg-[#fafbf9]">
                <td className="px-6 py-4 text-xs font-semibold text-[#375240]">{order.id}</td>
                <td className="px-6 py-4">
                  <p className="text-xs font-semibold text-[#354238]">{order.customer}</p>
                  <p className="mt-1 text-[10px] text-[#9aa49b]">{order.date}</p>
                </td>
                <td className="px-6 py-4 text-xs font-semibold text-[#354238]">{formatCurrency(order.total)}</td>
                <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}