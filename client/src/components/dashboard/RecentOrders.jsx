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

export default function RecentOrders({ theme = "light" }) {
  const isDark = theme === "dark";
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await fetchDashboardSummary();
        setOrders(
          Array.isArray(response?.analytics?.recentOrders)
            ? response.analytics.recentOrders
            : []
        );
      } catch {
        setOrders([]);
      }
    };

    loadOrders();
  }, []);

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${
        isDark
          ? "border-[#29364B] bg-[#151D2E]"
          : "border-[#E2E8F0] bg-white shadow-xs"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6 ${
          isDark ? "border-[#29364B]" : "border-[#E2E8F0]"
        }`}
      >
        <div>
          <h2 className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9]">
            Recent orders
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#8290A5]">
            Keep track of your latest sales
          </p>
        </div>
        <Link
          to="/orders"
          className="flex items-center gap-1 text-xs font-bold text-[#4F46E5] dark:text-[#818CF8] hover:underline"
        >
          View all <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <thead
            className={`border-b text-[10px] font-bold uppercase tracking-wider ${
              isDark
                ? "border-[#29364B] bg-[#1C2639] text-[#8290A5]"
                : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"
            }`}
          >
            <tr>
              <th className="px-6 py-3 font-semibold">Order</th>
              <th className="px-6 py-3 font-semibold">Customer</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? "divide-[#29364B]" : "divide-[#E2E8F0]"}`}>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-xs text-[#64748B] dark:text-[#8290A5]">
                  No recent orders yet.
                </td>
              </tr>
            ) : (
              orders.slice(0, 5).map((order) => (
                <tr
                  key={order.id}
                  className={`transition-colors ${
                    isDark ? "hover:bg-[#1C2639]" : "hover:bg-[#F8FAFC]"
                  }`}
                >
                  <td className="px-6 py-3.5 text-xs font-bold text-[#4F46E5] dark:text-[#818CF8]">
                    {order.id}
                  </td>
                  <td className="px-6 py-3.5">
                    <p className="text-xs font-medium text-[#172033] dark:text-[#F1F5F9]">
                      {order.customer}
                    </p>
                    <p className="text-[10px] text-[#64748B] dark:text-[#8290A5]">
                      {order.date}
                    </p>
                  </td>
                  <td className="px-6 py-3.5 text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
