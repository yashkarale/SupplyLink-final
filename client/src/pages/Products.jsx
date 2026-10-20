import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Package, Boxes, IndianRupee, Minus, Plus, Upload, Check, Image as ImageIcon } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import SkeletonLoader from "../components/ui/SkeletonLoader";
import Modal from "../components/ui/Modal";
import { createProduct, fetchProducts, updateInventory, updateProduct, uploadProductImage } from "../services/api";

const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const normalizeProduct = (product) => {
  const name = product?.name || "Untitled product";
  return { id: product?._id || product?.id || "", name, category: product?.category || "Other", price: Number(product?.price ?? 0), stock: Number(product?.stock ?? 0), sold: Number(product?.sold ?? 0), status: product?.status || (product?.isPublished ? "published" : "draft"), images: Array.isArray(product?.images) ? product.images : [] };
};
const fieldClass = "w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]";

export default function Products() {
  const { theme = "light" } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Apparel", price: "", stock: "" });
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [productCapacity, setProductCapacity] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const previewUrlRef = useRef("");

  useEffect(() => {
    let active = true;
    fetchProducts().then((response) => {
      if (!active) return;
      setProducts((Array.isArray(response?.products) ? response.products : []).map(normalizeProduct));
      setProductCapacity({ limit: response?.productLimit ?? null, count: Number(response?.activeProductCount || 0) });
    }).catch((err) => { if (active) setError(err?.response?.data?.message || err?.message || "Unable to load products."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const selectImage = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = file ? URL.createObjectURL(file) : "";
    setImagePreview(previewUrlRef.current);
    setImageFile(file);
  };

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const filtered = useMemo(() => products.filter((p) => `${p.name} ${p.id} ${p.category}`.toLowerCase().includes(search.toLowerCase()) && (category === "All categories" || p.category === category)), [products, search, category]);
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const closeForm = () => { if (submitting) return; setShowForm(false); setEditingId(null); selectImage(null); setError(""); };

  const startCreate = () => { setEditingId(null); setForm({ name: "", category: categories[0] || "Apparel", price: "", stock: "" }); selectImage(null); setError(""); setShowForm(true); };
  const startEdit = (product) => { setEditingId(product.id); setForm({ name: product.name, category: product.category, price: String(product.price), stock: String(product.stock) }); selectImage(null); setError(""); setShowForm(true); };

  const saveProduct = async (event) => {
    event.preventDefault();
    const price = Number(form.price); const stock = Number(form.stock);
    if (!form.name.trim() || form.name.trim().length > 160 || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0 || stock > 10000000) {
      setError("Enter a product name, a price above zero, and a whole-number stock quantity from 0 to 10,000,000."); return;
    }
    setSubmitting(true); setError(""); setSuccessNotice("");
    try {
      const payload = { name: form.name.trim(), category: form.category.trim() || "Other", price, stock, lowStockThreshold: 5, ...(editingId ? {} : { description: "", sku: `SKU-${Date.now()}` }) };
      const result = editingId ? await updateProduct(editingId, payload) : await createProduct(payload);
      if (!result?.product) throw new Error("The server did not return the saved product.");
      let saved = result.product;
      const normalized = normalizeProduct(saved);
      setProducts((prev) => editingId ? prev.map((item) => item.id === editingId ? normalized : item) : [normalized, ...prev]);
      if (imageFile) {
        try {
          const uploaded = await uploadProductImage(normalized.id, imageFile);
          saved = uploaded.product;
          const withImage = normalizeProduct(saved);
          setProducts((prev) => prev.map((item) => item.id === withImage.id ? withImage : item));
        } catch (uploadError) {
          setEditingId(normalized.id);
          setError(`Product details were saved, but image upload failed: ${uploadError?.response?.data?.message || uploadError.message || "check storage"}`);
          return;
        }
      }
      if (!editingId && productCapacity?.limit !== null && productCapacity) setProductCapacity((current) => ({ ...current, count: current.count + 1 }));
      setSuccessNotice(editingId ? "Product updated successfully." : "Product created successfully.");
      setForm({ name: "", category: categories[0] || "Apparel", price: "", stock: "" }); setEditingId(null); selectImage(null); setShowForm(false);
    } catch (err) { setError(err?.response?.data?.message || err?.message || "Unable to save product."); }
    finally { setSubmitting(false); }
  };

  const updateStock = async (productId, delta) => {
    try {
      setError("");
      const response = await updateInventory(productId, { delta });
      if (!response?.product) return;
      const updated = normalizeProduct(response.product);
      setProducts((current) => current.map((p) => p.id === productId ? updated : p));
    } catch (err) { setError(err?.response?.data?.message || err?.message || "Unable to update inventory."); }
  };

  return <main className="min-w-0 space-y-5 text-[var(--ink)] sm:space-y-6">
    <PageHeader title="Products" description="Your catalog, pricing, and availability in one place." action="Add product" onAction={startCreate} theme={theme} />
    {productCapacity?.limit != null && <p className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">Free plan: <strong className="text-[var(--ink)]">{productCapacity.count} of {productCapacity.limit}</strong> active products used. Upgrade under Billing for unlimited listings.</p>}
    {error && !showForm && <div role="alert" className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">{error}</div>}
    {successNotice && <div role="status" className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm text-[var(--success)]"><Check size={16}/>{successNotice}</div>}
    <section aria-label="Catalog summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[{ label: "Products", value: products.length, Icon: Package }, { label: "Units in stock", value: products.reduce((n,p) => n+p.stock,0).toLocaleString("en-IN"), Icon: Boxes }, { label: "Stock value", value: formatCurrency(totalValue), Icon: IndianRupee }].map(({label,value,Icon}) => <div key={label} className="flex min-w-0 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"><span className="flex size-10 shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--paper)] text-[var(--accent)]"><Icon size={18}/></span><div className="min-w-0"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 break-words text-lg font-semibold">{value}</p></div></div>)}
    </section>
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="font-semibold">Product catalog</h2><p className="mt-1 text-xs text-[var(--muted)]">{filtered.length} product{filtered.length === 1 ? "" : "s"}</p></div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex">
          <label className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3"><Search size={15} className="shrink-0 text-[var(--muted)]"/><span className="sr-only">Search products</span><input aria-label="Search products" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, category, ID" className="h-10 min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--muted)] focus-visible:ring-0 sm:w-56"/></label>
          <label className="sr-only" htmlFor="product-category-filter">Filter by category</label><select id="product-category-filter" value={category} onChange={(e)=>setCategory(e.target.value)} className={`${fieldClass} sm:w-auto`}><option>All categories</option>{categories.map((c)=><option key={c}>{c}</option>)}</select>
        </div>
      </div>
      {loading ? <div className="space-y-4 p-5"><SkeletonLoader height={24} width="25%" theme={theme}/><SkeletonLoader height={92} width="100%" theme={theme}/><SkeletonLoader height={92} width="100%" theme={theme}/></div>
        : filtered.length === 0 ? <EmptyState title={products.length ? "No matching products" : "Your catalog is empty"} description={products.length ? "Try a different name, category, or product ID." : "Add a product to begin building your catalog."} actionLabel={products.length ? undefined : "Add product"} onAction={products.length ? undefined : startCreate}/>
        : <>
          <div className="hidden md:block"><table className="w-full table-fixed text-left"><thead className="bg-[var(--paper)] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr>{["Product","Category","Price","Stock","Sold","Status",""].map((h,i)=><th key={`${h}-${i}`} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{filtered.map((p)=><tr key={p.id} className="transition-colors hover:bg-[var(--paper)]"><td className="px-4 py-3"><ProductIdentity product={p}/></td><td className="truncate px-4 py-3 text-sm text-[var(--muted)]">{p.category}</td><td className="px-4 py-3 text-sm font-medium">{formatCurrency(p.price)}</td><td className="px-4 py-3"><StockStepper product={p} onChange={updateStock}/></td><td className="px-4 py-3 text-sm text-[var(--muted)]">{p.sold}</td><td className="px-4 py-3"><ProductState product={p}/></td><td className="px-4 py-3 text-right"><button type="button" onClick={()=>startEdit(p)} className="min-h-10 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">Edit</button></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-[var(--line)] md:hidden">{filtered.map((p)=><article key={p.id} className="min-w-0 space-y-3 p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><ProductIdentity product={p}/><p className="mt-1 truncate text-xs text-[var(--muted)]">{p.category} · {p.id}</p></div><button type="button" onClick={()=>startEdit(p)} className="min-h-10 shrink-0 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm font-semibold hover:bg-[var(--paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]">Edit</button></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"><div><p className="text-xs text-[var(--muted)]">Price</p><p className="font-semibold">{formatCurrency(p.price)}</p></div><div><p className="text-xs text-[var(--muted)]">Units sold</p><p className="font-medium">{p.sold}</p></div><StockStepper product={p} onChange={updateStock}/><ProductState product={p}/></div></article>)}</div>
        </>}
    </section>
    <Modal isOpen={showForm} onClose={closeForm} title={editingId ? "Edit product" : "Add product"} maxWidth="max-w-2xl">
      <form onSubmit={saveProduct} className="space-y-5">
        <p className="text-sm text-[var(--muted)]">Update catalog details and inventory. Fields marked * are required.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Product name *<input required maxLength={160} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="e.g. Classic Linen Shirt" className={fieldClass}/></label>
          <label className="space-y-1.5 text-sm font-medium">Category<input maxLength={80} value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} placeholder="e.g. Apparel" className={fieldClass}/></label>
          <label className="space-y-1.5 text-sm font-medium">Price (₹) *<input required type="number" min="0.01" step="0.01" value={form.price} onChange={(e)=>setForm({...form,price:e.target.value})} placeholder="999" className={fieldClass}/></label>
          <label className="space-y-1.5 text-sm font-medium">Stock quantity *<input required type="number" min="0" max="10000000" step="1" value={form.stock} onChange={(e)=>setForm({...form,stock:e.target.value})} placeholder="25" className={fieldClass}/></label>
          <div className="space-y-1.5 text-sm font-medium">Product image<span className="block text-xs font-normal text-[var(--muted)]">PNG or JPEG, up to 4 MB</span><label className="mt-2 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm hover:bg-[var(--paper)] focus-within:ring-2 focus-within:ring-[var(--focus-color)]"><Upload size={15}/>Choose image<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e)=>{const file=e.target.files?.[0]||null;if(file&&(!["image/png","image/jpeg"].includes(file.type)||file.size>4*1024*1024)){setError("Choose a PNG or JPEG image under 4 MB.");e.target.value="";selectImage(null);return;}setError("");selectImage(file);}}/></label></div>
        </div>
        {(imagePreview || (editingId && products.find((p)=>p.id===editingId)?.images[0])) && <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] p-3"><img src={imagePreview || products.find((p)=>p.id===editingId)?.images[0]} alt={imageFile ? "Selected product preview" : "Current product"} className="size-16 rounded-[var(--radius-control)] border border-[var(--line)] object-cover"/><span className="min-w-0 truncate text-sm text-[var(--muted)]">{imageFile?.name || "Current product image"}</span></div>}
        {!imagePreview && !(editingId && products.find((p)=>p.id===editingId)?.images[0]) && <p className="flex items-center gap-2 text-xs text-[var(--muted)]"><ImageIcon size={15}/>No product image selected.</p>}
        {error && <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button><Button type="submit" loading={submitting}>{editingId ? "Save changes" : "Create product"}</Button></div>
      </form>
    </Modal>
  </main>;
}

function ProductIdentity({product}) { return <div className="flex min-w-0 items-center gap-3">{product.images[0] ? <img src={product.images[0]} alt="" className="size-11 shrink-0 rounded-[var(--radius-control)] border border-[var(--line)] object-cover"/> : <span className="flex size-11 shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--paper)] text-xs font-semibold text-[var(--muted)]">{product.name.slice(0,2).toUpperCase()}</span>}<div className="min-w-0"><p className="truncate text-sm font-semibold" title={product.name}>{product.name}</p><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{product.id}</p></div></div>; }
function ProductState({product}) { const state = product.stock === 0 ? "Out of stock" : product.status === "draft" ? "Draft" : product.status === "archived" ? "Archived" : "Published"; return <StatusBadge status={state}/>; }
function StockStepper({product,onChange}) { return <div className="flex shrink-0 items-center gap-2"><button type="button" disabled={product.stock <= 0} onClick={()=>onChange(product.id,-1)} className="flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]" aria-label={`Decrease stock for ${product.name}`}><Minus size={14}/></button><span className="min-w-8 text-center text-sm font-semibold" aria-label={`${product.stock} in stock`}>{product.stock}</span><button type="button" onClick={()=>onChange(product.id,1)} className="flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]" aria-label={`Increase stock for ${product.name}`}><Plus size={14}/></button></div>; }
