import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, ArrowUpRight, Mail, Phone, Search, Users } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SkeletonLoader from "../components/ui/SkeletonLoader";
import Modal from "../components/ui/Modal";
import { fetchSellerCustomers } from "../services/api";

const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";
const orderState = (value) => ({ PENDING:"Pending", CONFIRMED:"Confirmed", PROCESSING:"Processing", SHIPPED:"Shipped", DELIVERED:"Delivered", CANCELLED:"Cancelled", RETURNED:"Returned" }[String(value || "").toUpperCase()] || value || "Unknown");
const phoneDigits = (value) => String(value || "").replace(/\D/g, "");
const isValidTelephone = (value) => phoneDigits(value).length >= 7 && phoneDigits(value).length <= 15;
const telephoneHref = (value) => `${String(value || "").trim().startsWith("+") ? "+" : ""}${phoneDigits(value)}`;
const whatsappDigits = (value) => /^\+[1-9]\d{7,14}$/.test(String(value || "").replace(/[\s()-]/g, "")) ? phoneDigits(value) : "";

export default function Customers() {
  const { theme = "light" } = useOutletContext() || {};
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const loadCustomers = useCallback(async () => {
    setError("");
    try {
      const response = await fetchSellerCustomers();
      setCustomers(Array.isArray(response?.customers) ? response.customers : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to load customer records.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone} ${customer.city}`.toLowerCase().includes(search.trim().toLowerCase())), [customers, search]);
  const repeatCustomers = customers.filter((customer) => customer.orderCount > 1).length;
  const recognizedSpend = customers.reduce((sum, customer) => sum + Number(customer.recognizedSpend || 0), 0);

  return <main className="min-w-0 space-y-5 text-ink sm:space-y-6">
    <PageHeader title="Customers" description="A seller-scoped contact directory built from customer details on your store orders." theme={theme}><span className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-line bg-surface px-3 text-sm text-muted"><Users size={15}/><strong className="text-ink">{loading ? "—" : customers.length}</strong><span>customers</span></span></PageHeader>
    {error && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertCircle size={16}/><span className="min-w-0 flex-1">{error}</span>{!loading && <button type="button" onClick={()=>{setLoading(true);loadCustomers();}} className="min-h-10 shrink-0 underline underline-offset-2">Retry</button>}</div>}
    <section aria-label="Customer summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{label:"Customers",value:loading?"—":customers.length},{label:"Repeat orderers",value:loading?"—":repeatCustomers},{label:"Recognized spend",value:loading?"—":formatCurrency(recognizedSpend)}].map(({label,value})=><div key={label} className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p></div>)}</section>
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="font-semibold">Customer directory</h2><p className="mt-1 text-xs text-muted">{loading?"Loading customer records…":`${filteredCustomers.length} of ${customers.length} customers`}</p></div><label className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-paper px-3"><Search size={15} className="shrink-0 text-muted"/><span className="sr-only">Search customers</span><input aria-label="Search customers" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Name, phone, email, city" className="h-10 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted sm:w-64"/></label></div>
      {loading ? <div className="space-y-4 p-5"><SkeletonLoader height={24} width="25%" theme={theme}/><SkeletonLoader height={100} width="100%" theme={theme}/><SkeletonLoader height={100} width="100%" theme={theme}/></div>
        : filteredCustomers.length===0 ? <EmptyState title={error&&!customers.length?"Customer records unavailable":customers.length?"No matching customers":"No customer records yet"} description={error&&!customers.length?"Retry loading seller customer records to check customers.":customers.length?"Try a different name, phone number, email, or city.":"Customer details from storefront orders will appear here."} icon={Users}/>
        : <div className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0 md:gap-3 md:p-3 xl:grid-cols-3">{filteredCustomers.map((customer)=><CustomerCard key={customer.key} customer={customer} onSelect={()=>setSelectedCustomer(customer)}/>)}</div>}
    </section>
    <p className="text-xs leading-relaxed text-muted">Orders are grouped per seller by matching normalized email and phone together, or by the one available contact. Names never identify customers; orders with no usable contact stay separate. Order counts include all statuses. Recognized spend includes verified payments and delivered COD, excluding cancelled and returned orders. Buyer refunds are not recorded in the order data, so this is not net of refunds.</p>
    <Modal isOpen={Boolean(selectedCustomer)} onClose={()=>setSelectedCustomer(null)} title={selectedCustomer?.name || "Customer details"} maxWidth="max-w-2xl">{selectedCustomer && <CustomerDetails customer={selectedCustomer}/>}</Modal>
  </main>;
}

function CustomerCard({ customer, onSelect }) {
  const whatsapp = whatsappDigits(customer.phone);
  return <article className="flex min-w-0 flex-col gap-3 p-4 md:rounded-[var(--radius-control)] md:border md:border-line md:bg-surface"><div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center border border-line bg-paper text-sm font-semibold text-muted">{customer.initials}</span><div className="min-w-0 flex-1"><button type="button" onClick={onSelect} className="max-w-full break-words text-left text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">{customer.name}</button><p className="mt-1 break-all text-xs text-muted">{customer.email || "No email on record"}</p><p className="mt-1 break-all text-xs text-muted">{customer.phone || "No phone on record"}</p></div></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs"><span><strong>{customer.orderCount}</strong> order{customer.orderCount===1?"":"s"}</span><span className="text-muted">{formatCurrency(customer.recognizedSpend)} recognized spend</span></div><div className="flex flex-wrap items-center gap-2">{isValidTelephone(customer.phone) && <a href={`tel:${telephoneHref(customer.phone)}`} aria-label={`Call ${customer.name}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3 text-xs font-semibold hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]"><Phone size={14}/>Call</a>}{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label={`Message ${customer.name} on WhatsApp`} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3 text-xs font-semibold hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">WhatsApp<ArrowUpRight size={13}/></a>}<button type="button" onClick={onSelect} className="min-h-10 rounded-[var(--radius-control)] px-2 text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">Details</button></div></div></article>;
}

function CustomerDetails({ customer }) {
  const whatsapp = whatsappDigits(customer.phone);
  return <div className="space-y-5"><section className="grid gap-4 rounded-[var(--radius-control)] border border-line bg-paper p-4 sm:grid-cols-2"><CustomerDetail label="Phone" value={customer.phone}/><CustomerDetail label="Email" value={customer.email}/><CustomerDetail label="City" value={customer.city}/><CustomerDetail label="Postal code" value={customer.postalCode}/><CustomerDetail label="Delivery address on latest order" value={customer.address}/><CustomerDetail label="Recorded orders" value={customer.orderCount}/><CustomerDetail label="Recognized spend" value={formatCurrency(customer.recognizedSpend)}/><CustomerDetail label="Latest order" value={formatDate(customer.lastOrderAt)}/></section><div className="flex flex-wrap gap-2">{isValidTelephone(customer.phone)&&<a href={`tel:${telephoneHref(customer.phone)}`} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]"><Phone size={15}/>Call</a>}{customer.email&&<a href={`mailto:${customer.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]"><Mail size={15}/>Email</a>}{whatsapp&&<a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">WhatsApp<ArrowUpRight size={14}/></a>}</div><section><h3 className="font-semibold">Order history</h3>{customer.orders.length ? <ol className="mt-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">{customer.orders.map((order,index)=><li key={`${order.reference}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{order.reference}</p><p className="mt-1 text-xs text-muted">{formatDate(order.createdAt)} · {order.paymentMethod} · payment {order.paymentStatus.toLowerCase()}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-semibold tabular-nums">{formatCurrency(order.total)}</span><span className="text-xs text-muted">{orderState(order.status)}</span></div></li>)}</ol>:<p className="mt-2 text-sm text-muted">No order records.</p>}</section><p className="text-xs leading-relaxed text-muted">Recognized spend includes verified payments and delivered COD, excluding cancelled and returned orders. The order schema has no buyer refund amounts, so spend cannot be netted against refunds.</p></div>;
}

function CustomerDetail({ label, value }) { return <div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="mt-1 break-words text-sm font-medium">{value || "Not provided"}</p></div>; }
