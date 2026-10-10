
import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, PackageCheck } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { fetchProducts, updateInventory } from "../services/api";

const normalizeProduct = (product) => ({
  id: product?._id || product?.id || `PRD-${Date.now()}`,
  name: product?.name || "Untitled product",
  category: product?.category || "Other",
  price: Number(product?.price ?? 0),
  stock: Number(product?.stock ?? 0),
  sold: Number(product?.sold ?? 0),
  status: Number(product?.stock ?? 0) > 0 ? "Active" : "Out of stock",
  color: "#dce8df",
  initials: (product?.name || "PR").slice(0, 2).toUpperCase(),
});

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [threshold, setThreshold] = useState(10);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetchProducts();
        const list = Array.isArray(response?.products) ? response.products : [];
        setProducts(list.map(normalizeProduct));
      } catch (error) {
        setProducts([]);
      }
    };

    loadProducts();
  }, []);

  const changeStock = async (id, value) => {
    if (value === "" || !Number.isInteger(Number(value)) || Number(value) < 0) return;

    const nextValue = Number(value);
    const item = products.find((product) => product.id === id);

    if (!item) return;

    try {
      const result = await updateInventory(id, { stock: nextValue });
      const updatedProduct = result?.product || { ...item, stock: nextValue, status: nextValue ? "Active" : "Out of stock" };

      setProducts((prev) => prev.map((product) => {
        const sameProduct = product.id === id;
        return sameProduct ? { ...product, stock: Number(updatedProduct.stock ?? nextValue), status: Number(updatedProduct.stock ?? nextValue) ? "Active" : "Out of stock" } : product;
      }));

      setMessage("Inventory updated successfully.");
    } catch (error) {
      setProducts((prev) => prev.map((product) => product.id === id ? { ...product, stock: nextValue, status: nextValue ? "Active" : "Out of stock" } : product));
      setMessage("Updated locally. The backend rejected the stock change.");
    }
  };

  const low = products.filter((p) => p.stock > 0 && p.stock <= threshold);
  const empty = products.filter((p) => p.stock === 0);

  return (
    <div>
      <PageHeader title="Inventory" description="Monitor stock levels and identify products that need replenishment." />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: "Tracked products", value: products.length, icon: Boxes },
          { title: "Low stock", value: low.length, icon: AlertTriangle },
          { title: "Out of stock", value: empty.length, icon: PackageCheck },
        ].map(({ title, value, icon: Icon }) => <div key={title} className="flex items-center gap-4 rounded-2xl border border-[#e9ede7] bg-white p-5"><div className="rounded-xl bg-[#edf4ed] p-3 text-[#347048]"><Icon size={20} /></div><div><p className="text-xs text-[#879187]">{title}</p><p className="mt-1 text-2xl font-bold text-[#25372a]">{value}</p></div></div>)}
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e9ede7] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-bold text-[#26372b]">Stock threshold</h2><p className="mt-1 text-xs text-[#909b91]">Mark products at or below this level as low stock.</p></div>
        <div className="flex items-center gap-2"><label htmlFor="threshold" className="text-xs text-[#748076]">Low-stock alert at</label><input id="threshold" type="number" min="1" max="10000" value={threshold} onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded-xl border border-[#e1e8df] px-3 py-2 text-sm outline-none focus:border-[#659873]" /><span className="text-xs text-[#748076]">units</span></div>
      </div>

      {message && <p role="status" className="mb-4 text-xs font-medium text-[#327348]">{message}</p>}

      <div className="overflow-hidden rounded-2xl border border-[#e9ede7] bg-white">
        <div className="border-b border-[#eef0ec] px-5 py-5"><h2 className="text-sm font-bold text-[#26372b]">Stock levels</h2><p className="mt-1 text-xs text-[#909b91]">Edit stock quantities to reflect your inventory.</p></div>
        {products.length === 0 ? <div className="px-5 py-8 text-sm text-[#677468]">No product data yet. Add your first product to start tracking stock.</div> : (
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-[#fafbf9] text-[10px] uppercase tracking-wider text-[#98a198]"><tr>{["Product", "Current stock", "Stock health", "Update quantity"].map((h) => <th key={h} className="px-5 py-3.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#f0f2ee]">
                {products.map((p) => {
                  const health = p.stock === 0 ? "Out of stock" : p.stock <= threshold ? "Low stock" : "Healthy";
                  return <tr key={p.id} className="hover:bg-[#fafbf9]">
                    <td className="px-5 py-4"><p className="text-xs font-semibold text-[#354238]">{p.name}</p><p className="mt-1 text-[10px] text-[#9aa49b]">{p.id}</p></td>
                    <td className="px-5 py-4 text-sm font-bold text-[#354238]">{p.stock}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${health === "Healthy" ? "bg-emerald-50 text-emerald-700" : health === "Low stock" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{health}</span></td>
                    <td className="px-5 py-4"><input aria-label={`Stock quantity for ${p.name}`} type="number" min="0" step="1" value={p.stock} onChange={(e) => changeStock(p.id, e.target.value)} className="w-24 rounded-lg border border-[#e1e8df] px-3 py-2 text-xs outline-none focus:border-[#659873]" /></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}