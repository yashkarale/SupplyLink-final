
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import { fetchOrders, updateOrderStatus } from "../services/api";

const backendOrderStatusMap = {
  Pending: "PENDING",
  Confirmed: "CONFIRMED",
  Processing: "PROCESSING",
  Shipped: "SHIPPED",
  Delivered: "DELIVERED",
  Cancelled: "CANCELLED",
};

const normalizeOrderStatus = (status) => {
  const map = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  return map[status] || status || "Pending";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalizeOrder = (order) => ({
  id: order?._id || order?.id || `SL-${Date.now()}`,
  reference: order?.orderReference || order?.id || `SL-${Date.now()}`,
  customer: order?.customer?.name || "Guest customer",
  email: order?.customer?.email || "",
  date: order?.createdAt
    ? new Date(order.createdAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Recently",
  items: Array.isArray(order?.items)
    ? order.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
    : 0,
  total: Number(order?.totalAmount ?? order?.total ?? 0),
  status: normalizeOrderStatus(order?.orderStatus),
  method: order?.paymentMethod || "UPI",
});

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await fetchOrders();
        const list = Array.isArray(response) ? response : Array.isArray(response?.orders) ? response.orders : [];
        setOrders(list.map(normalizeOrder));
      } catch {
        setOrders([]);
      }
    };

    loadOrders();
  }, []);

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          `${o.reference} ${o.customer} ${o.email}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (status === "All statuses" || o.status === status),
      ),
    [orders, search, status],
  );

  const updateStatus = async (id, nextStatus) => {
    const backendStatus = backendOrderStatusMap[nextStatus];

    if (backendStatus && !String(id).startsWith("SL-")) {
      try {
        const response = await updateOrderStatus(id, backendStatus);
        if (!response?.success) throw new Error(response?.message || "Unable to update order status.");
      } catch (error) {
        setError(error?.response?.data?.message || error.message || "Unable to update order status.");
        return;
      }
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === id ? { ...order, status: nextStatus } : order,
      ),
    );
  };

  return (
    <div>
      <PageHeader title="Orders" description="Track purchases and manage order fulfillment." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ["All orders", orders.length],
          ["Processing", orders.filter((o) => o.status === "Processing").length],
          ["Shipped", orders.filter((o) => o.status === "Shipped").length],
          ["Delivered", orders.filter((o) => o.status === "Delivered").length],
        ].map(([label, value]) => (<div key={label} className="rounded-2xl border border-[#e9ede7] bg-white p-5"><p className="text-xs text-[#879187]">{label}</p><p className="mt-2 text-2xl font-bold text-[#25372a]">{value}</p></div>))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9ede7] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#eef0ec] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="text-sm font-bold text-[#26372b]">Order management</h2><p className="mt-1 text-xs text-[#909b91]">Search and update order status</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-[#e8ede6] px-3 py-2.5"><Search size={15} className="text-[#99a39a]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" className="w-full text-xs outline-none sm:w-36" /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-[#e8ede6] bg-white px-3 py-2.5 text-xs outline-none">{["All statuses", "Pending", "Processing", "Confirmed", "Shipped", "Delivered", "Cancelled"].map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No matching orders" /> : (
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-[#fafbf9] text-[10px] uppercase tracking-wider text-[#98a198]"><tr>{["Order ID", "Customer", "Date", "Items", "Payment", "Total", "Status"].map((h) => <th key={h} className="px-5 py-3.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#f0f2ee]">
                {filtered.map((o) => (<tr key={o.id} className="hover:bg-[#fafbf9]">
                  <td className="px-5 py-4 text-xs font-semibold text-[#375240]">{o.reference}</td>
                  <td className="px-5 py-4"><p className="text-xs font-semibold text-[#354238]">{o.customer}</p><p className="mt-1 text-[10px] text-[#9aa49b]">{o.email || "No email provided"}</p></td>
                  <td className="px-5 py-4 text-xs text-[#758176]">{o.date}</td>
                  <td className="px-5 py-4 text-xs text-[#758176]">{o.items}</td>
                  <td className="px-5 py-4 text-xs text-[#758176]">{o.method}</td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#354238]">{formatCurrency(o.total)}</td>
                  <td className="px-5 py-4"><select aria-label={`Update ${o.reference} status`} value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="max-w-[135px] rounded-lg border border-[#e8ede6] bg-white px-2 py-2 text-xs outline-none">{["Pending", "Processing", "Confirmed", "Shipped", "Delivered", "Cancelled"].map((s) => <option key={s}>{s}</option>)}</select><div className="mt-2"><StatusBadge status={o.status} /></div></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
