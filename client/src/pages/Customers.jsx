import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import { fetchOrders } from "../services/api";

const getCustomerSegment = (ordersCount, totalSpent) => {
  if (ordersCount >= 5 || totalSpent >= 10000) return "Loyal";
  if (ordersCount >= 2 || totalSpent >= 3000) return "Returning";
  if (ordersCount === 1 && totalSpent > 0) return "New";
  return "At risk";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalizeCustomer = (order, index) => {
  const name = order?.customer?.name || "Guest customer";
  const email = order?.customer?.email || "";

  return {
    id: order?._id || order?.id || `CUS-${index + 1}`,
    name,
    email,
    orders: 1,
    spent: Number(order?.totalAmount ?? order?.total ?? 0),
    lastOrder: order?.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })
      : "Recently",
    segment: "New",
    initials: name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
  };
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("All segments");

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetchOrders();
        const list = Array.isArray(response) ? response : Array.isArray(response?.orders) ? response.orders : [];

        if (!list.length) {
          setCustomers([]);
          return;
        }

        const customerMap = new Map();

        list.forEach((order, index) => {
          const normalized = normalizeCustomer(order, index);
          const customerKey = normalized.email || normalized.name;
          const previous = customerMap.get(customerKey);

          if (!previous) {
            const nextCustomer = { ...normalized, segment: getCustomerSegment(1, normalized.spent) };
            customerMap.set(customerKey, nextCustomer);
            return;
          }

          const nextCustomer = {
            ...previous,
            orders: previous.orders + 1,
            spent: previous.spent + normalized.spent,
            lastOrder: normalized.lastOrder,
            segment: getCustomerSegment(previous.orders + 1, previous.spent + normalized.spent),
          };

          customerMap.set(customerKey, nextCustomer);
        });

        setCustomers(Array.from(customerMap.values()));
      } catch {
        setCustomers([]);
      }
    };

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          `${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase()) &&
          (segment === "All segments" || c.segment === segment),
      ),
    [customers, search, segment],
  );

  return (
    <div>
      <PageHeader title="Customers" description="Understand your customer base and identify repeat buyers." />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Total customers", customers.length],
          ["Repeat customers", customers.filter((c) => c.orders > 1).length],
          ["Lifetime revenue", formatCurrency(customers.reduce((sum, c) => sum + c.spent, 0))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#e9ede7] bg-white p-5">
            <p className="text-xs text-[#879187]">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#25372a]">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9ede7] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#eef0ec] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-bold text-[#26372b]">Customer directory</h2>
            <p className="mt-1 text-xs text-[#909b91]">Customers shown: {filteredCustomers.length}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-[#e8ede6] px-3 py-2.5">
              <Search size={15} className="text-[#99a39a]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" className="w-full text-xs outline-none sm:w-36" />
            </div>
            <select value={segment} onChange={(e) => setSegment(e.target.value)} className="rounded-xl border border-[#e8ede6] bg-white px-3 py-2.5 text-xs outline-none">
              {["All segments", "Loyal", "Returning", "New", "At risk"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {filteredCustomers.length === 0 ? (
          <EmptyState title="No customers found" />
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-[#fafbf9] text-[10px] uppercase tracking-wider text-[#98a198]">
                <tr>{["Customer", "Segment", "Orders", "Total spent", "Last order"].map((h) => <th key={h} className="px-5 py-3.5 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2ee]">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#fafbf9]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0e7] text-xs font-bold text-[#396447]">{c.initials}</div>
                        <div>
                          <p className="text-xs font-semibold text-[#354238]">{c.name}</p>
                          <p className="mt-1 text-[10px] text-[#9aa49b]">{c.email || "No email provided"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={c.segment} /></td>
                    <td className="px-5 py-4 text-xs text-[#758176]">{c.orders}</td>
                    <td className="px-5 py-4 text-xs font-semibold text-[#354238]">{formatCurrency(c.spent)}</td>
                    <td className="px-5 py-4 text-xs text-[#758176]">{c.lastOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-4 text-[10px] text-[#9aa49b]">Customer segments are generated from real recent order activity and spending patterns, making the directory useful as soon as sales start coming in.</p>
    </div>
  );
}
