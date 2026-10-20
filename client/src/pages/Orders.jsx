import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, Search, ShoppingBag } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import SkeletonLoader from "../components/ui/SkeletonLoader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { confirmSellerManualPayment, fetchOrders, getSellerPaymentProof, updateOrderStatus } from "../services/api";

const statuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];
const backendOrderStatusMap = Object.fromEntries(statuses.map((status) => [status, status.toUpperCase()]));
const orderStatusMap = Object.fromEntries(statuses.map((status) => [status.toUpperCase(), status]));
const transitions = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED", "CANCELLED"], DELIVERED: ["RETURNED"], CANCELLED: [], RETURNED: [] };
const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const formatDate = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
const normalizeOrder = (order) => ({
  raw: order,
  id: order?._id || order?.id || "",
  reference: order?.orderReference || order?._id || order?.id || "Order reference unavailable",
  customer: order?.customer?.name || "Guest customer",
  phone: order?.customer?.phone || "",
  address: order?.customer?.address || "",
  city: order?.customer?.city || "",
  postalCode: order?.customer?.postalCode || "",
  email: order?.customer?.email || "",
  notes: order?.customer?.notes || "",
  createdAt: order?.createdAt || "",
  date: formatDate(order?.createdAt),
  items: Array.isArray(order?.items) ? order.items.reduce((total, item) => total + Number(item.quantity || 0), 0) : 0,
  total: Number(order?.totalAmount ?? order?.total ?? 0),
  status: orderStatusMap[String(order?.orderStatus || "PENDING").toUpperCase()] || String(order?.orderStatus || "Unknown"),
  method: order?.paymentMethod || "Unknown",
  paymentStatus: String(order?.paymentStatus || "PENDING").toUpperCase(),
  paymentVerifiedAt: order?.paymentVerifiedAt || null,
  paymentVerificationMethod: order?.paymentVerificationMethod || "",
  hasPaymentProof: Boolean(order?.paymentProofUploadedAt && !order?.paymentProofDeletedAt),
  statusHistory: Array.isArray(order?.statusHistory) ? order.statusHistory : [],
  lines: Array.isArray(order?.items) ? order.items : [],
});
const fieldClass = "h-10 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]";

export default function Orders() {
  const { theme = "light" } = useOutletContext() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");

  const loadOrders = useCallback(async () => {
    setError("");
    try {
      const response = await fetchOrders();
      const list = Array.isArray(response) ? response : Array.isArray(response?.orders) ? response.orders : [];
      setOrders(list.map(normalizeOrder));
    } catch (err) { setError(err?.response?.data?.message || err?.message || "Unable to load orders."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    fetchOrders()
      .then((response) => {
        if (active) setOrders((Array.isArray(response) ? response : Array.isArray(response?.orders) ? response.orders : []).map(normalizeOrder));
      })
      .catch((err) => { if (active) setError(err?.response?.data?.message || err?.message || "Unable to load orders."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => orders.filter((order) => `${order.reference} ${order.customer} ${order.email} ${order.phone}`.toLowerCase().includes(search.trim().toLowerCase()) && (status === "All statuses" || order.status === status)), [orders, search, status]);

  const updateStatus = async (order, nextStatus) => {
    const backendStatus = backendOrderStatusMap[nextStatus];
    if (!backendStatus || !order.id) return;
    setUpdatingStatusId(order.id); setError(""); setSuccessNotice("");
    try {
      const response = await updateOrderStatus(order.id, backendStatus);
      if (!response?.success) throw new Error(response?.message || "Unable to update order status.");
      const updated = response.order ? normalizeOrder(response.order) : { ...order, status: nextStatus, paymentStatus: nextStatus === "Cancelled" && order.paymentStatus === "PENDING" ? "FAILED" : order.paymentStatus };
      setOrders((prev) => prev.map((item) => item.id === order.id ? updated : item));
      setSelectedOrder((current) => current?.id === order.id ? updated : current);
      setSuccessNotice(`Order ${order.reference} updated to ${updated.status}.`);
    } catch (err) { setError(err?.response?.data?.message || err?.message || "Unable to update order status."); }
    finally { setUpdatingStatusId(""); }
  };

  const viewPaymentProof = async (id) => {
    const proofWindow = window.open("about:blank", "_blank");
    if (proofWindow) proofWindow.opener = null;
    setError("");
    try {
      const response = await getSellerPaymentProof(id);
      if (proofWindow) proofWindow.location.href = response.url;
      else window.location.assign(response.url);
    } catch (err) { proofWindow?.close(); setError(err?.response?.data?.message || err?.message || "Unable to retrieve payment screenshot."); }
  };

  const confirmPayment = async (order) => {
    if (!window.confirm("Only confirm after verifying your UPI or bank statement for the exact order amount. Continue?")) return;
    setConfirmingPaymentId(order.id); setError(""); setSuccessNotice("");
    try {
      const response = await confirmSellerManualPayment(order.id);
      if (!response?.success) throw new Error(response?.message || "Unable to confirm this payment.");
      const updated = response.order ? normalizeOrder(response.order) : { ...order, paymentStatus: "VERIFIED", status: "Confirmed" };
      setOrders((current) => current.map((item) => item.id === order.id ? updated : item));
      setSelectedOrder((current) => current?.id === order.id ? updated : current);
      setSuccessNotice("Payment verification recorded and order marked Confirmed.");
    } catch (err) { setError(err?.response?.data?.message || err?.message || "Unable to confirm this payment."); }
    finally { setConfirmingPaymentId(""); }
  };

  return <main className="min-w-0 space-y-5 text-ink sm:space-y-6">
    <PageHeader title="Orders" description="Review customer orders, verify eligible payment proofs, and manage fulfillment." theme={theme}><span className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-line bg-surface px-3 text-sm text-muted"><ShoppingBag size={15}/><strong className="text-ink">{loading ? "—" : orders.length}</strong><span>orders</span></span></PageHeader>
    {error && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertCircle size={16}/><span className="min-w-0 flex-1">{error}</span>{!loading && <button type="button" onClick={()=>{setLoading(true);loadOrders();}} className="min-h-10 shrink-0 underline underline-offset-2">Retry</button>}</div>}
    {successNotice && <div role="status" className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-3 text-sm text-success"><CheckCircle2 size={16}/>{successNotice}</div>}
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="font-semibold">Order management</h2><p className="mt-1 text-xs text-muted">{loading ? "Loading orders…" : `${filtered.length} of ${orders.length} orders`}</p></div><div className="grid min-w-0 gap-2 sm:flex"><label className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-paper px-3"><Search size={15} className="shrink-0 text-muted"/><span className="sr-only">Search orders</span><input aria-label="Search orders" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Order, customer, email, phone" className="h-10 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted sm:w-64"/></label><label htmlFor="order-status-filter" className="sr-only">Filter by order status</label><select id="order-status-filter" value={status} onChange={(e)=>setStatus(e.target.value)} className={fieldClass}><option>All statuses</option>{statuses.map((value)=><option key={value}>{value}</option>)}</select></div></div>
      {loading ? <div className="space-y-4 p-5"><SkeletonLoader height={24} width="25%" theme={theme}/><SkeletonLoader height={112} width="100%" theme={theme}/><SkeletonLoader height={112} width="100%" theme={theme}/></div>
        : filtered.length === 0 ? <EmptyState title={error && !orders.length ? "Orders unavailable" : orders.length ? "No matching orders" : "No orders yet"} description={error && !orders.length ? "Retry loading to check for recent orders." : orders.length ? "Try a different search or status." : "New orders placed through your storefront will appear here."} icon={ShoppingBag}/>
        : <div className="divide-y divide-line">{filtered.map((order)=><OrderCard key={order.id || order.reference} order={order} onView={setSelectedOrder} onStatusChange={updateStatus} onProof={viewPaymentProof} onConfirm={confirmPayment} updatingStatusId={updatingStatusId} confirmingPaymentId={confirmingPaymentId}/>)}</div>}
    </section>
    <Modal isOpen={Boolean(selectedOrder)} onClose={()=>setSelectedOrder(null)} title={selectedOrder ? `Order ${selectedOrder.reference}` : "Order details"} maxWidth="max-w-2xl">
      {selectedOrder && <OrderDetails order={selectedOrder} onStatusChange={updateStatus} onProof={viewPaymentProof} onConfirm={confirmPayment} updating={updatingStatusId===selectedOrder.id} confirming={confirmingPaymentId===selectedOrder.id}/>}
    </Modal>
  </main>;
}

function allowedStatuses(order) {
  const next = transitions[String(order.raw?.orderStatus || "PENDING").toUpperCase()] || [];
  if (order.method === "WHATSAPP" && order.paymentStatus !== "VERIFIED") return next.filter((status) => status === "CANCELLED");
  return next;
}
function StatusControl({order,onChange,disabled=false}) {
  const options = allowedStatuses(order);
  return <label className="flex w-full min-w-0 flex-col gap-1 text-xs text-muted sm:w-auto">Update status<select aria-label={`Update ${order.reference} status`} disabled={disabled || options.length===0} value={order.status} onChange={(e)=>onChange(order,e.target.value)} className={`${fieldClass} w-full max-w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-65`}><option value={order.status}>{order.status}</option>{options.map((value)=><option key={value} value={orderStatusMap[value]}>{orderStatusMap[value]}</option>)}</select></label>;
}
function PaymentState({order}) {
  const label = order.paymentStatus === "VERIFIED" ? "Verified" : order.paymentStatus === "FAILED" ? "Failed" : "Pending";
  return <div className="flex flex-wrap items-center gap-2"><StatusBadge status={label}/><span className="text-xs text-muted">{order.method}</span></div>;
}
function OrderCard({order,onView,onStatusChange,onProof,onConfirm,updatingStatusId,confirmingPaymentId}) {
  const canConfirm = order.method === "WHATSAPP" && order.hasPaymentProof && order.paymentStatus === "PENDING" && order.status === "Pending";
  return <article className="grid min-w-0 gap-4 p-4 transition-colors hover:bg-paper sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
    <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><button type="button" onClick={()=>onView(order)} className="max-w-full truncate text-left text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">{order.reference}</button><StatusBadge status={order.status}/></div><p className="mt-2 break-words text-sm font-medium">{order.customer}</p><p className="mt-1 break-all text-xs text-muted">{[order.phone,order.email].filter(Boolean).join(" · ") || "No contact details"}</p><p className="mt-2 text-xs text-muted">{order.date} <span aria-hidden="true">·</span> {order.items} item{order.items===1?"":"s"}</p></div>
    <div className="grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_auto] lg:min-w-[400px] lg:grid-cols-[minmax(110px,1fr)_minmax(120px,1fr)_auto]"><div><p className="text-xs text-muted">Order total</p><p className="mt-1 text-base font-semibold tabular-nums">{formatCurrency(order.total)}</p></div><div className="col-span-2 sm:col-span-1"><p className="mb-1 text-xs text-muted">Payment</p><PaymentState order={order}/>{order.method === "WHATSAPP" && order.paymentStatus === "PENDING" && <p className="mt-1 text-xs text-warning">{order.hasPaymentProof ? "Proof uploaded · awaiting your verification" : "Awaiting payment proof"}</p>}</div><div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-1 sm:justify-end"><button type="button" onClick={()=>onView(order)} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3 text-xs font-semibold hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]"><Eye size={14}/>Details</button><StatusControl order={order} onChange={onStatusChange} disabled={updatingStatusId===order.id}/></div></div>
    <div className="flex flex-wrap gap-2 lg:col-span-2">{order.hasPaymentProof && <button type="button" onClick={()=>onProof(order.id)} className="min-h-10 text-xs font-semibold text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">View payment proof</button>}{canConfirm && <Button size="sm" loading={confirmingPaymentId===order.id} onClick={()=>onConfirm(order)}>Confirm payment</Button>}</div>
  </article>;
}
function OrderDetails({order,onStatusChange,onProof,onConfirm,updating,confirming}) {
  const canConfirm = order.method === "WHATSAPP" && order.hasPaymentProof && order.paymentStatus === "PENDING" && order.status === "Pending";
  return <div className="space-y-5 text-sm"><section className="grid gap-4 rounded-[var(--radius-control)] border border-line bg-paper p-4 sm:grid-cols-2"><Detail label="Customer" value={order.customer}/><Detail label="Placed" value={order.date}/><Detail label="Phone" value={order.phone}/><Detail label="Email" value={order.email}/><Detail label="Payment method" value={order.method}/><div><p className="text-xs text-muted">Payment</p><div className="mt-1"><PaymentState order={order}/></div>{order.paymentVerifiedAt && <p className="mt-1 text-xs text-muted">Verified {formatDate(order.paymentVerifiedAt)}{order.paymentVerificationMethod ? ` · ${order.paymentVerificationMethod === "SELLER_MANUAL" ? "Seller verification" : order.paymentVerificationMethod}` : ""}</p>}</div><Detail label="Delivery address" value={[order.address,order.city,order.postalCode].filter(Boolean).join(", ")}/>{order.notes && <Detail label="Customer note" value={order.notes}/>}<div className="space-y-1"><p className="text-xs text-muted">Subtotal</p><p className="font-medium tabular-nums">{formatCurrency(order.raw?.subtotal)}</p>{Number(order.raw?.shippingAmount)>0&&<p className="text-xs text-muted">Shipping {formatCurrency(order.raw.shippingAmount)}</p>}{Number(order.raw?.discountAmount)>0&&<p className="text-xs text-muted">Discount −{formatCurrency(order.raw.discountAmount)}</p>}<p className="border-t border-line pt-1 font-semibold tabular-nums">Total {formatCurrency(order.total)}</p></div></section>
    <section><h3 className="font-semibold">Items ({order.items})</h3>{order.lines.length ? <div className="mt-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">{order.lines.map((item,index)=><div key={item._id || `${item.productId}-${index}`} className="flex min-w-0 items-start justify-between gap-3 p-3"><div className="min-w-0"><p className="break-words font-medium">{item.name || "Product"}</p>{item.variant && <p className="mt-1 text-xs text-muted">{item.variant}</p>}<p className="mt-1 text-xs text-muted">Qty {item.quantity} · {formatCurrency(item.unitPrice)} each</p></div><p className="shrink-0 font-semibold tabular-nums">{formatCurrency(item.lineTotal ?? item.unitPrice*item.quantity)}</p></div>)}</div> : <p className="mt-2 text-xs text-muted">No item details available.</p>}</section>
    {order.statusHistory.length>0 && <section><h3 className="font-semibold">Status history</h3><ol className="mt-2 space-y-2">{[...order.statusHistory].reverse().map((entry,index)=><li key={`${entry.to}-${entry.changedAt}-${index}`} className="flex flex-wrap justify-between gap-2 text-xs"><span>{orderStatusMap[String(entry.to).toUpperCase()] || entry.to}</span><time className="text-muted">{formatDate(entry.changedAt)}</time></li>)}</ol></section>}
    <section className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4"><StatusControl order={order} onChange={onStatusChange} disabled={updating}/><div className="flex flex-wrap gap-2">{order.hasPaymentProof && <Button variant="secondary" onClick={()=>onProof(order.id)}><Eye size={15}/>View proof</Button>}{canConfirm && <Button loading={confirming} onClick={()=>onConfirm(order)}>Confirm payment</Button>}</div></section>
  </div>;
}
function Detail({label,value}) { return <div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="mt-1 break-words font-medium">{value || "Not provided"}</p></div>; }
