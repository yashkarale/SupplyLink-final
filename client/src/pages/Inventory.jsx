import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, Boxes, CheckCircle2, PackageCheck, AlertCircle, Search } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import SkeletonLoader from "../components/ui/SkeletonLoader";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { fetchProducts, updateInventory } from "../services/api";

const normalizeProduct = (product) => ({ id: product?._id || product?.id || "", name: product?.name || "Untitled product", category: product?.category || "Other", price: Number(product?.price ?? 0), stock: Number(product?.stock ?? 0), threshold: Number(product?.lowStockThreshold ?? 5), sku: product?.sku || "" });
const getAlertThreshold = (product, override) => override === "" ? product.threshold : Number(override);
const inputClass = "w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]";

export default function Inventory() {
  const { theme = "light" } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustValue, setAdjustValue] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const loadProducts = async () => {
    try { const response = await fetchProducts(); setProducts((Array.isArray(response?.products) ? response.products : []).map(normalizeProduct)); }
    catch (err) { setErrorMessage(err?.response?.data?.message || err?.message || "Unable to load inventory data."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((response) => {
        if (active) setProducts((Array.isArray(response?.products) ? response.products : []).map(normalizeProduct));
      })
      .catch((err) => {
        if (active) setErrorMessage(err?.response?.data?.message || err?.message || "Unable to load inventory data.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const low = products.filter((p) => p.stock > 0 && p.stock <= getAlertThreshold(p, threshold));
  const empty = products.filter((p) => p.stock === 0);
  const filtered = useMemo(() => products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matches = !q || `${p.name} ${p.category} ${p.id} ${p.sku}`.toLowerCase().includes(q);
    const matchesFilter = filter === "All" || (filter === "In stock" && p.stock > getAlertThreshold(p, threshold)) || (filter === "Low stock" && p.stock > 0 && p.stock <= getAlertThreshold(p, threshold)) || (filter === "Out of stock" && p.stock === 0);
    return matches && matchesFilter;
  }).sort((a,b) => sortBy === "stock-asc" ? a.stock-b.stock : sortBy === "stock-desc" ? b.stock-a.stock : sortBy === "price-desc" ? b.price-a.price : sortBy === "price-asc" ? a.price-b.price : a.name.localeCompare(b.name)), [products, search, filter, threshold, sortBy]);

  const openAdjust = (product) => { setAdjustingProduct(product); setAdjustValue(String(product.stock)); setErrorMessage(""); setMessage(""); };
  const closeAdjust = () => { if (submittingAdjust) return; setAdjustingProduct(null); setAdjustValue(""); };
  const submitAdjust = async (event) => {
    event.preventDefault(); if (!adjustingProduct) return;
    const next = Number(adjustValue);
    if (!Number.isInteger(next) || next < 0 || next > 10000000) { setErrorMessage("Enter a whole-number stock quantity from 0 to 10,000,000."); return; }
    setSubmittingAdjust(true); setErrorMessage(""); setMessage("");
    const product = adjustingProduct;
    try {
      const result = await updateInventory(product.id, { stock: next });
      const saved = result?.product;
      setProducts((prev) => prev.map((item) => item.id === product.id ? normalizeProduct(saved || { ...item, stock: next }) : item));
      setMessage(`Stock for “${product.name}” updated to ${Number(saved?.stock ?? next)}.`);
      setAdjustingProduct(null); setAdjustValue("");
    } catch (err) { setErrorMessage(err?.response?.data?.message || err?.message || "Unable to update stock on the server."); }
    finally { setSubmittingAdjust(false); }
  };

  return <main className="min-w-0 space-y-5 text-[var(--ink)] sm:space-y-6">
    <PageHeader title="Inventory" description="Keep an accurate count of the stock available in your catalog." theme={theme}/>
    <section aria-label="Inventory summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{title:"Tracked products",value:products.length,Icon:Boxes},{title:"Low stock",value:low.length,Icon:AlertTriangle},{title:"Out of stock",value:empty.length,Icon:PackageCheck}].map(({title,value,Icon})=><div key={title} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"><span className="flex size-10 shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--paper)] text-[var(--accent)]"><Icon size={18}/></span><div><p className="text-xs text-[var(--muted)]">{title}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>)}</section>
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Low-stock alert</h2><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Uses each product’s saved threshold. Enter a temporary override to filter by one shared quantity.</p></div><div className="flex flex-wrap items-center gap-2"><label htmlFor="threshold" className="shrink-0 text-sm font-medium text-[var(--muted)]">Alert at</label><input id="threshold" type="number" min="0" max="10000000" value={threshold} placeholder="Default" onChange={(e)=>setThreshold(e.target.value === "" ? "" : Math.max(0,Number(e.target.value)||0))} style={{backgroundColor:"#ffffff",color:"#171b24",colorScheme:"light"}} className="h-10 w-28 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]"/><span className="text-sm text-[var(--muted)]">units</span>{threshold !== "" && <button type="button" onClick={()=>setThreshold("")} className="min-h-10 px-2 text-xs font-medium text-[var(--muted)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">Use product default</button>}</div></section>
    {message && <div role="status" className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm text-[var(--success)]"><CheckCircle2 size={16}/>{message}</div>}
    {errorMessage && <div role="alert" className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]"><AlertCircle size={16}/><span>{errorMessage}</span>{!loading && products.length===0 && <button type="button" onClick={()=>{setLoading(true);setErrorMessage("");loadProducts();}} className="ml-auto min-h-10 shrink-0 underline underline-offset-2">Retry</button>}</div>}
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-sm font-semibold">Stock levels</h2><p className="mt-1 text-xs text-[var(--muted)]">{filtered.length} product{filtered.length===1?"":"s"} shown</p></div><div className="grid min-w-0 gap-2 sm:flex"><label className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3"><Search size={15} className="shrink-0 text-[var(--muted)]"/><span className="sr-only">Search products or SKU</span><input aria-label="Search products or SKU" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search products or SKU" className="h-10 min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--muted)] sm:w-48"/></label><label className="sr-only" htmlFor="inventory-filter">Filter by stock state</label><select id="inventory-filter" value={filter} onChange={(e)=>setFilter(e.target.value)} className={`${inputClass} sm:w-auto`}><option value="All">All states</option><option value="In stock">In stock</option><option value="Low stock">Low stock</option><option value="Out of stock">Out of stock</option></select><label className="sr-only" htmlFor="inventory-sort">Sort products</label><select id="inventory-sort" value={sortBy} onChange={(e)=>setSortBy(e.target.value)} className={`${inputClass} sm:w-auto`}><option value="name">Name A–Z</option><option value="stock-asc">Stock low → high</option><option value="stock-desc">Stock high → low</option><option value="price-asc">Price low → high</option><option value="price-desc">Price high → low</option></select></div></div>
      {loading ? <div className="space-y-4 p-5"><SkeletonLoader height={24} width="25%" theme={theme}/><SkeletonLoader height={90} width="100%" theme={theme}/><SkeletonLoader height={90} width="100%" theme={theme}/></div>
        : filtered.length===0 ? <EmptyState title={products.length ? "No matching stock" : "No inventory yet"} description={products.length ? "Try a different search or stock filter." : "Products you add will appear here for stock tracking."}/>
        : <div className="grid gap-0 divide-y divide-[var(--line)] md:grid-cols-2 md:divide-y-0 md:gap-3 md:p-3 xl:grid-cols-3">{filtered.map((p)=><article key={p.id} className="flex min-w-0 items-center justify-between gap-3 p-4 md:rounded-[var(--radius-control)] md:border md:border-[var(--line)]"><div className="min-w-0"><p className="break-words text-sm font-semibold">{p.name}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{p.sku ? `SKU ${p.sku} · ` : ""}{p.id}</p><div className="mt-2"><StockHealth product={p} threshold={getAlertThreshold(p, threshold)}/></div></div><div className="shrink-0 text-right"><p className="text-xl font-semibold tabular-nums">{p.stock}</p><p className="text-xs text-[var(--muted)]">units</p><button type="button" onClick={()=>openAdjust(p)} className="mt-2 min-h-10 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm font-medium hover:bg-[var(--paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">Adjust stock</button></div></article>)}</div>}
    </section>
    <Modal isOpen={Boolean(adjustingProduct)} onClose={closeAdjust} title="Adjust stock" maxWidth="max-w-md" closeOnEscape={!submittingAdjust} closeOnBackdrop={!submittingAdjust}>
      {adjustingProduct && <form onSubmit={submitAdjust} className="space-y-5"><div><p className="break-words font-medium">{adjustingProduct.name}</p><p className="mt-1 text-sm text-[var(--muted)]">Current quantity: {adjustingProduct.stock}</p></div><label htmlFor="inventory-adjust-value" className="block text-sm font-medium">New quantity</label><input id="inventory-adjust-value" autoFocus required type="number" min="0" max="10000000" step="1" value={adjustValue} onChange={(e)=>setAdjustValue(e.target.value)} className={inputClass}/><p className="-mt-3 text-xs text-[var(--muted)]">Enter the counted stock. The server rejects negative or out-of-range quantities.</p>{errorMessage && <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">{errorMessage}</p>}<div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={submittingAdjust} onClick={closeAdjust}>Cancel</Button><Button type="submit" loading={submittingAdjust}>Save quantity</Button></div></form>}
    </Modal>
  </main>;
}

function StockHealth({product,threshold}) { const label = product.stock===0 ? "Out of stock" : product.stock<=threshold ? "Low stock" : "In stock"; const color = product.stock===0 ? "text-[var(--danger)] bg-[var(--danger)]/5" : product.stock<=threshold ? "text-[var(--warning)] bg-[var(--warning-soft)]" : "text-[var(--success)] bg-[var(--success)]/5"; return <span className={`inline-flex rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium ${color}`}>{label}</span>; }
