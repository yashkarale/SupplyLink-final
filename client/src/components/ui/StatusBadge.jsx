
const styles = {
  Processing: "bg-amber-50 text-amber-700 ring-amber-200",
  Confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
  Shipped: "bg-violet-50 text-violet-700 ring-violet-200",
  Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Out of stock": "bg-rose-50 text-rose-700 ring-rose-200",
  Loyal: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Returning: "bg-blue-50 text-blue-700 ring-blue-200",
  New: "bg-violet-50 text-violet-700 ring-violet-200",
  "At risk": "bg-amber-50 text-amber-700 ring-amber-200",
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status] || "bg-gray-50 text-gray-600 ring-gray-200"}`}>
      {status}
    </span>
  );
}