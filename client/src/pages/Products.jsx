
import { useEffect, useMemo, useState } from "react";
import { Search, Package, Boxes, IndianRupee, X, Minus, Plus } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import { createProduct, fetchProducts, updateInventory, updateProduct } from "../services/api";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalizeProduct = (product) => {
  const safeName = product?.name || "Untitled product";
  const price = Number(product?.price ?? 0);
  const stock = Number(product?.stock ?? 0);

  return {
    id: product?._id || product?.id || `PRD-${Date.now()}`,
    name: safeName,
    category: product?.category || "Other",
    price,
    stock,
    sold: Number(product?.sold ?? 0),
    status: stock === 0 ? "Out of stock" : product?.status === "draft" ? "Draft" : "Active",
    color: "#dce8df",
    initials: safeName.slice(0, 2).toUpperCase(),
  };
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", category: "Apparel", price: "", stock: "" });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [productCapacity, setProductCapacity] = useState(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetchProducts();
        const list = Array.isArray(response?.products) ? response.products : [];
        setProducts(list.map(normalizeProduct));
        setProductCapacity({
          limit: response?.productLimit ?? null,
          count: Number(response?.activeProductCount || 0),
        });
      } catch (requestError) {
        setProducts([]);
        setError(requestError?.response?.data?.message || requestError?.message || "Unable to load products.");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const filtered = useMemo(() => products.filter((p) =>
    `${p.name} ${p.id}`.toLowerCase().includes(search.toLowerCase()) &&
    (category === "All categories" || p.category === category)
  ), [products, search, category]);

  const addProduct = async (e) => {
    e.preventDefault();
    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!form.name.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      setError("Enter a valid product name, price, and stock count.");
      return;
    }

    try {
      setError("");
      const productPayload = {
        name: form.name.trim(),
        category: form.category,
        price,
        stock,
        lowStockThreshold: 5,
        ...(editingId ? {} : { description: "", sku: `SKU-${Date.now()}` }),
      };
      const result = editingId
        ? await updateProduct(editingId, productPayload)
        : await createProduct(productPayload);

      if (!result?.product) throw new Error("The server did not return the saved product.");
      const nextProduct = normalizeProduct(result.product);

      setProducts((prev) => editingId
        ? prev.map((product) => product.id === editingId ? nextProduct : product)
        : [nextProduct, ...prev]);
      if (!editingId && productCapacity && productCapacity.limit !== null) {
        setProductCapacity((current) => ({ ...current, count: current.count + 1 }));
      }
      setForm({ name: "", category: "Apparel", price: "", stock: "" });
      setEditingId(null);
      setShowForm(false);
    } catch (requestError) {
      const message = requestError?.response?.data?.message || "Unable to create product.";
      setError(message);
    }
  };

  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  const updateStock = async (productId, delta) => {
    try {
      setError("");
      const response = await updateInventory(productId, { delta });
      const updatedProduct = response?.product;

      if (!updatedProduct) {
        return;
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === productId ? normalizeProduct(updatedProduct) : product,
        ),
      );
    } catch (requestError) {
      const message = requestError?.response?.data?.message || "Unable to update inventory.";
      setError(message);
    }
  };

  return (
    <div>
      <PageHeader title="Products" description="Manage your catalog, prices, and product availability." action="Add product" onAction={() => setShowForm(true)} />
      {productCapacity && productCapacity.limit !== null && (
        <div className="mb-4 rounded-xl border border-[#dfe8df] bg-[#f5f8f3] px-4 py-3 text-sm text-[#446553]">
          Free plan: {productCapacity.count} of {productCapacity.limit} non-archived products. Archive a product or upgrade to add more.
        </div>
      )}
      {error && !showForm && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total products", value: products.length, icon: Package },
          { label: "Units in stock", value: products.reduce((s, p) => s + p.stock, 0), icon: Boxes },
          { label: "Stock value", value: formatCurrency(totalValue), icon: IndianRupee },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-[#e9ede7] bg-white p-5">
            <div className="rounded-xl bg-[#edf4ed] p-3 text-[#347048]"><Icon size={20} /></div>
            <div><p className="text-xs text-[#879187]">{label}</p><p className="mt-1 text-xl font-bold text-[#25372a]">{value}</p></div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-[#dce8dc] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold text-[#26372b]">{editingId ? "Edit product" : "Create a product"}</h2>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[#849087] hover:bg-gray-100"><X size={18} /></button>
          </div>
          <form onSubmit={addProduct} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" className="rounded-xl border border-[#e1e8df] px-3 py-3 text-sm outline-none focus:border-[#659873]" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl border border-[#e1e8df] bg-white px-3 py-3 text-sm outline-none focus:border-[#659873]">
              {["Apparel", "Accessories", "Bags", "Home", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input required type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price (₹)" className="rounded-xl border border-[#e1e8df] px-3 py-3 text-sm outline-none focus:border-[#659873]" />
            <input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Initial stock" className="rounded-xl border border-[#e1e8df] px-3 py-3 text-sm outline-none focus:border-[#659873]" />
            <div className="sm:col-span-2 lg:col-span-4">
              {error && <p className="mb-3 text-sm text-[#9a2f35]">{error}</p>}
              <button type="submit" className="rounded-xl bg-[#215c39] px-5 py-3 text-sm font-semibold text-white hover:bg-[#18482b]">{editingId ? "Save changes" : "Save product"}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#e9ede7] bg-white p-6 text-sm text-[#667266]">Loading products...</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e9ede7] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#eef0ec] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><h2 className="text-sm font-bold text-[#26372b]">Product catalog</h2><p className="mt-1 text-xs text-[#909b91]">{filtered.length} products found</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex items-center gap-2 rounded-xl border border-[#e8ede6] px-3 py-2.5"><Search size={15} className="text-[#99a39a]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="w-full text-xs outline-none sm:w-36" /></div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-[#e8ede6] bg-white px-3 py-2.5 text-xs outline-none">{["All categories", "Apparel", "Accessories", "Bags", "Home", "Other"].map((c) => <option key={c}>{c}</option>)}</select>
            </div>
          </div>
          {filtered.length === 0 ? <EmptyState title="No products found" /> : (
            <div className="custom-scrollbar overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-[#fafbf9] text-[10px] uppercase tracking-wider text-[#98a198]"><tr>{["Product", "Category", "Price", "Stock", "Units sold", "Status", ""].map((h) => <th key={h} className="px-5 py-3.5 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#f0f2ee]">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-[#fafbf9]">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div style={{ backgroundColor: p.color }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-[#4e6a55]">{p.initials}</div><div><p className="text-xs font-semibold text-[#354238]">{p.name}</p><p className="mt-1 text-[10px] text-[#9aa49b]">{p.id}</p></div></div></td>
                      <td className="px-5 py-4 text-xs text-[#758176]">{p.category}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-[#354238]">{formatCurrency(p.price)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateStock(p.id, -1)}
                            className="rounded-lg border border-[#e8ede6] bg-white p-1.5 text-[#284d37] transition hover:bg-[#edf6ef]"
                            aria-label={`Decrease stock for ${p.name}`}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="min-w-[22px] text-center text-xs font-semibold text-[#354238]">{p.stock}</span>
                          <button
                            type="button"
                            onClick={() => updateStock(p.id, 1)}
                            className="rounded-lg border border-[#e8ede6] bg-white p-1.5 text-[#284d37] transition hover:bg-[#edf6ef]"
                            aria-label={`Increase stock for ${p.name}`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#758176]">{p.sold}</td>
                      <td className="px-5 py-4"><StatusBadge status={p.stock === 0 ? "Out of stock" : p.status} /></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => { setEditingId(p.id); setForm({ name: p.name, category: p.category, price: String(p.price), stock: String(p.stock) }); setShowForm(true); setError(""); }} className="text-xs font-semibold text-[#215c39] hover:underline">Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
