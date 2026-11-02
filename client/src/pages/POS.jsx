import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, ArrowRight, Banknote, CreditCard, Minus, Plus, Search, ShoppingCart, Trash2, Wallet, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { createOfflinePosSale, fetchProducts } from "../services/api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const paymentMethods = [
  { value: "CASH", label: "Cash", Icon: Banknote },
  { value: "UPI", label: "UPI", Icon: Wallet },
  { value: "CARD", label: "Card", Icon: CreditCard },
  { value: "OTHER", label: "Other", Icon: ArrowRight },
];

const normalizeProduct = (product) => ({
  id: product?._id || product?.id || "",
  name: product?.name || "Untitled product",
  category: product?.category || "General",
  status: product?.status || "published",
  price: Number(product?.price ?? 0),
  stock: Number(product?.stock ?? 0),
  image: product?.images?.[0] || "",
  sku: product?.sku || "",
});

export default function POS() {
  const { theme = "light" } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const requestKeyRef = useRef(null);

  useEffect(() => {
    let active = true;

    fetchProducts()
      .then((response) => {
        if (!active) return;
        setProducts((Array.isArray(response?.products) ? response.products : []).map(normalizeProduct).filter((product) => product.status !== "archived"));
      })
      .catch((err) => {
        if (!active) return;
        setErrorMessage(err?.response?.data?.message || err?.message || "Unable to load products for POS.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => ["All", ...new Set(products.map((product) => product.category).filter(Boolean))], [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query);
      const matchesCategory = category === "All" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, search, category]);

  const cartItems = useMemo(() =>
    cart.map((entry) => {
      const product = products.find((item) => item.id === entry.id);
      if (!product) return null;
      return { ...product, quantity: entry.quantity };
    }).filter(Boolean),
  [cart, products]);

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

  const addToCart = (product) => {
    setMessage("");
    setErrorMessage("");
    const existing = cart.find((entry) => entry.id === product.id);
    if (existing && existing.quantity >= product.stock) {
      setErrorMessage(`Only ${product.stock} ${product.stock === 1 ? "unit" : "units"} are available for ${product.name}.`);
      return;
    }

    setCart((prev) => {
      if (existing) {
        return prev.map((entry) => entry.id === product.id ? { ...entry, quantity: Math.min(entry.quantity + 1, product.stock) } : entry);
      }
      return [...prev, { id: product.id, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    const existing = cart.find((entry) => entry.id === productId);
    const product = products.find((item) => item.id === productId);
    if (delta > 0 && existing && product && existing.quantity >= product.stock) {
      setErrorMessage(`Only ${product.stock} ${product.stock === 1 ? "unit" : "units"} are available for ${product.name}.`);
      return;
    }
    setErrorMessage("");
    setCart((prev) => prev.flatMap((entry) => {
      if (entry.id !== productId) return [entry];
      const nextQty = entry.quantity + delta;
      return nextQty > 0 ? [{ ...entry, quantity: nextQty }] : [];
    }));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((entry) => entry.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setMessage("");
    setErrorMessage("");
  };

  const handleCheckout = async () => {
    if (!cartItems.length) {
      setErrorMessage("Add at least one product before completing the sale.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const payload = {
        paymentMethod,
        customer: Object.values(customer).some((value) => String(value || "").trim()) ? customer : undefined,
        items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
      };
      const fingerprint = JSON.stringify(payload);
      if (!requestKeyRef.current || requestKeyRef.current.fingerprint !== fingerprint) {
        requestKeyRef.current = { fingerprint, requestId: crypto.randomUUID() };
      }

      const response = await createOfflinePosSale({ ...payload, requestId: requestKeyRef.current.requestId });
      setMessage(`POS sale ${response?.sale?.orderReference || "recorded"} completed successfully.`);
      requestKeyRef.current = null;
      setCart([]);
      setCustomer({ name: "", phone: "", email: "", address: "" });
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Unable to record the walk-in sale.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-w-0 space-y-6 text-[var(--ink)]">
      <PageHeader
        title="Point of Sale"
        description="Quick walk-in sales for your shop floor, with instant stock deduction and a clean checkout flow."
        theme={theme}
      />

      {message && (
        <div className="rounded-[var(--radius-card)] border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm text-[var(--success)]">
          {message}
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.65fr_0.95fr]">
        <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3">
              <Search size={16} className="text-[var(--muted)]" />
              <input
                aria-label="Search products for POS"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted)] outline-none"
                placeholder="Search products or SKU"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <span>Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-[var(--radius-control)] bg-[var(--paper)]" />
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.length ? filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock < 1 || submitting}
                  className="group rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] p-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface)]"
                >
                  <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--surface)]">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{product.category.slice(0, 2)}</div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{product.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{product.category}</p>
                    </div>
                  <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">{product.stock > 0 ? `${product.stock} left` : "Out of stock"}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-[var(--ink)]">{currency.format(product.price)}</span>
                    <span className="text-xs font-medium text-[var(--muted)]">Add</span>
                  </div>
                </button>
              )) : (
                <div className="col-span-full rounded-[var(--radius-control)] border border-dashed border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">
                  No matching products found for this search and category.
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart size={16} />
              Cart
            </div>
            {cartItems.length > 0 && (
              <button type="button" onClick={clearCart} className="text-xs font-medium text-[var(--muted)] underline underline-offset-2">
                Clear cart
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {cartItems.length ? cartItems.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-[var(--muted)]">{currency.format(item.price)} each</p>
                  </div>
                  <button type="button" onClick={() => removeFromCart(item.id)} className="rounded border border-[var(--line)] p-1.5 text-[var(--muted)] hover:text-[var(--ink)]">
                    <X size={14} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--paper)]">
                      <Minus size={14} />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button type="button" disabled={item.quantity >= item.stock} onClick={() => updateQuantity(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Increase quantity for ${item.name}`}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold">{currency.format(item.price * item.quantity)}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
                Cart is empty. Add products to begin the sale.
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <div className="mb-3 flex items-center justify-between text-sm text-[var(--muted)]">
              <span>Payment</span>
              <span className="font-medium text-[var(--ink)]">Offline</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={[
                    "flex items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium transition",
                    paymentMethod === value ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]" : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <input
                value={customer.name}
                onChange={(event) => setCustomer((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Customer name (optional)"
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none"
              />
              <input
                value={customer.phone}
                onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Phone (optional)"
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none"
              />
              <input
                value={customer.email}
                onChange={(event) => setCustomer((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email (optional)"
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none"
              />
              <input
                value={customer.address}
                onChange={(event) => setCustomer((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Address (optional)"
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none"
              />
            </div>

            <div className="mt-5 space-y-2 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between"><span>Subtotal</span><strong className="text-[var(--ink)]">{currency.format(subtotal)}</strong></div>
              <div className="flex items-center justify-between text-base font-bold text-[var(--ink)]"><span>Total</span><span>{currency.format(subtotal)}</span></div>
            </div>

            <Button type="button" onClick={handleCheckout} disabled={!cartItems.length || submitting} className="mt-5 w-full" loading={submitting}>
              Complete sale
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
