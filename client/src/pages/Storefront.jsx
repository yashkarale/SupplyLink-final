import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Clock3,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildStoreContactUrl, createPublicOrder, fetchPublicStore, subscribeToPublicStore } from "../services/api";

const accentThemes = [
  "from-[#edf6ee] via-[#f6fbf6] to-[#dfeafc]",
  "from-[#f4efe8] via-[#fffaf4] to-[#e7f4eb]",
  "from-[#eef4f7] via-[#f6fbff] to-[#eaf0ff]",
  "from-[#f4efe8] via-[#fff7f2] to-[#f0f7ec]",
  "from-[#edf7ee] via-[#f4fbf3] to-[#e7f5ea]",
  "from-[#f2effd] via-[#f8f4ff] to-[#ebf0ff]",
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const titleCase = (value) =>
  String(value || "mystore")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeProduct = (product, index) => ({
  id: product?._id || product?.id || `${product?.name || "product"}-${index}`,
  name: product?.name || `Featured item ${index + 1}`,
  price: Number(product?.price ?? 0),
  compareAt: Number(product?.compareAtPrice || product?.compareAt || 0),
  tag: product?.category || "General",
  accent: accentThemes[index % accentThemes.length],
  stock: Number(product?.stock ?? 0),
  description: product?.description || "",
  images: Array.isArray(product?.images) ? product.images : [],
  sku: product?.sku || "",
});

const getStoreGuideAnswer = (question, storeName, productList, faqList = []) => {
  const q = String(question || "").toLowerCase();

  if (!q) {
    return "Ask about this store’s published products, prices, or delivery information.";
  }

  const directFaq = faqList.find((faq) => {
    const faqQuestion = String(faq?.question || "").toLowerCase();
    const faqAnswer = String(faq?.answer || "").toLowerCase();
    const payload = `${faqQuestion} ${faqAnswer}`;
    return q.includes(faqQuestion) || faqQuestion.includes(q) || payload.includes(q) || q.includes(payload.slice(0, 24));
  });

  if (directFaq?.answer) {
    return directFaq.answer;
  }

  if (q.includes("price") || q.includes("cost") || q.includes("how much") || q.includes("rate")) {
    if (!productList.length) return `${storeName} has not published any products yet.`;
    const cheapest = productList.reduce((lowest, item) => (item.price < lowest.price ? item : lowest), productList[0]);
    return `${storeName} currently lists products starting at ${formatCurrency(cheapest.price)}.`;
  }

  if (q.includes("what type") || q.includes("type is") || q.includes("kind of") || q.includes("category")) {
    const categories = [...new Set(productList.map((item) => item.tag))].slice(0, 3).join(", ");
    return categories ? `${storeName} lists products in these categories: ${categories}.` : `${storeName} has not published product categories yet.`;
  }

  if (q.includes("delivery") || q.includes("shipping") || q.includes("how long") || q.includes("when")) {
    return "Delivery timing is not listed by this store. Please contact the seller to confirm availability and delivery options.";
  }

  if (q.includes("material") || q.includes("fabric") || q.includes("quality") || q.includes("made of")) {
    return "Material and care information is not listed for this collection. Please contact the seller for product specific details.";
  }

  if (q.includes("gift") || q.includes("present") || q.includes("occasion")) {
    return "Please check the product details or contact the seller to ask about gift options.";
  }

  if (q.includes("use") || q.includes("used for") || q.includes("for whom") || q.includes("good for")) {
    const featured = productList[0]?.name || "the collection";
    return `Please see the details listed for ${featured}, or contact the seller for usage guidance.`;
  }

  const match = productList.find((product) => q.includes(product.name.toLowerCase()));
  if (match) {
    return `${match.name} is part of the featured lineup at ${storeName}. It is currently priced at ${formatCurrency(match.price)} and selected for premium everyday use.`;
  }

  return `I do not have enough store information to answer that. Contact ${storeName} directly to confirm.`;
};

export default function Storefront() {
  const { slug } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [faqQuestion, setFaqQuestion] = useState("What type of products do you sell?");
  const [faqs, setFaqs] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postalCode: "",
    notes: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadStore = async () => {
      try {
        const payload = await fetchPublicStore(slug || "mystore");
        const seller = payload?.store || null;
        const list = Array.isArray(payload?.products) ? payload.products : [];

        if (isMounted) {
          setStore(seller);
          setFaqs(Array.isArray(seller?.faqs) ? seller.faqs : []);
          setProducts(list.map(normalizeProduct));
          setLoadError("");
        }
      } catch (error) {
        if (isMounted) {
          setStore(null);
          setFaqs([]);
          setProducts([]);
          setLoadError(error?.message || "Unable to load this store.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStore();
    const eventSource = subscribeToPublicStore(slug);
    eventSource.addEventListener("update", loadStore);
    eventSource.onopen = loadStore;
    const refreshInterval = setInterval(loadStore, 15000);

    return () => {
      isMounted = false;
      eventSource.close();
      clearInterval(refreshInterval);
    };
  }, [slug]);

  const businessName = useMemo(
    () => store?.businessName || titleCase(slug || "mystore"),
    [slug, store]
  );

  const businessDescription = useMemo(
    () =>
      store?.description || "Browse the products published by this seller.",
    [store]
  );

  const category = useMemo(() => store?.category || "General", [store]);
  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);
  const categories = useMemo(() => [...new Set(products.map((product) => product.tag))], [products]);
  const topProducts = useMemo(() => products.filter((product) =>
    product.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (categoryFilter === "All" || product.tag === categoryFilter)
  ), [products, search, categoryFilter]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const shippingFee = 0;
  const total = subtotal + shippingFee;

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(Number(product.stock || 0), item.quantity + 1) }
            : item,
        );
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          stock: Number(product.stock || 0),
          quantity: 1,
        },
      ];
    });

    setCheckoutOpen(true);
    setCheckoutStatus(null);
  };

  const updateCartQuantity = (productId, nextQuantity) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== productId) {
            return item;
          }

          const safeQuantity = Math.min(Number(item.stock || 0), Math.max(0, Number(nextQuantity)));
          return safeQuantity === 0 ? null : { ...item, quantity: safeQuantity };
        })
        .filter(Boolean),
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();

    if (!slug || cart.length === 0) {
      setCheckoutStatus({
        tone: "error",
        message: "Add products to your cart before placing an order.",
      });
      return;
    }

    setPlacingOrder(true);
    setCheckoutStatus(null);

    try {
      const payload = {
        slug,
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        paymentMethod: "COD",
        customer: {
          name: checkoutForm.name.trim(),
          phone: checkoutForm.phone.trim(),
          email: checkoutForm.email.trim(),
          address: checkoutForm.address.trim(),
          city: checkoutForm.city.trim(),
          postalCode: checkoutForm.postalCode.trim(),
          notes: checkoutForm.notes.trim(),
        },
      };

      const response = await createPublicOrder(payload);
      const reference = response?.order?.orderReference || "SL-ORDER";
      const buyerEmailStatus = response?.emailDelivery?.find((item) => item.recipient === "buyer")?.status;
      const emailNote = checkoutForm.email.trim() && buyerEmailStatus === "not_configured"
        ? " Email confirmation is not configured; keep your tracking link."
        : checkoutForm.email.trim() && buyerEmailStatus === "failed"
          ? " Email confirmation could not be submitted; keep your tracking link."
          : checkoutForm.email.trim() && buyerEmailStatus === "accepted"
            ? " The email provider accepted a confirmation request; inbox delivery is not confirmed."
            : "";

      setCheckoutStatus({
        tone: "success",
        message: `Order request received and pending seller confirmation. Reference: ${reference}.${emailNote}`,
        trackingUrl: response?.trackingToken ? `/track/${response.trackingToken}` : "",
      });
      setCart([]);
      setCheckoutForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        postalCode: "",
        notes: "",
      });
    } catch (error) {
      setCheckoutStatus({
        tone: "error",
        message: error?.message || "Unable to place order.",
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  const faqAnswer = useMemo(
    () => getStoreGuideAnswer(faqQuestion, businessName, products, faqs),
    [faqQuestion, businessName, products, faqs]
  );

  const handleSellerContact = (product = null) => {
    if (!store?.contactUrl) return;
    const items = product ? [{ productId: product.id, quantity: 1 }] : cart;
    const target = buildStoreContactUrl(store.contactUrl, items, product?.name || "");
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f6f3ee] text-[#385744]">Loading store…</main>;
  if (loadError || !store) return <main className="grid min-h-screen place-items-center bg-[#f6f3ee] p-6 text-center"><div><h1 className="text-2xl font-bold text-[#173421]">Store unavailable</h1><p className="mt-2 text-sm text-[#667266]">{loadError === "Store not found" ? "No published store matches this link. Check the store URL or ask the seller to finish setup and publish it." : loadError || "This store could not be found."}</p></div></main>;

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#15291d]">
      <header className="sticky top-0 z-40 border-b border-[#e9e2d9] bg-[#f8f5f1]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <div>
            <div className="text-[10px] font-black tracking-[0.28em] text-[#6a8572]">SUPPLY LINK</div>
            <div className="mt-1 text-xl font-black tracking-[-0.05em] text-[#173421]">{businessName.toLowerCase()}</div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe9e1] bg-[#eef6ef] px-2.5 py-1.5 text-[10px] font-semibold text-[#37614a] shadow-sm sm:px-3 sm:py-2 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#38b573] animate-pulse" />
              <span className="hidden sm:inline">Live storefront</span>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOpen((open) => !open)}
              className="rounded-full border border-[#dfe8df] bg-white px-3 py-2 text-xs font-semibold text-[#25472d] transition hover:-translate-y-0.5 hover:shadow-sm sm:px-4 sm:text-sm"
            >
              {cartCount > 0 ? `Cart (${cartCount})` : "Cart"}
            </button>
            <button
              type="button"
              onClick={() => handleSellerContact()}
              disabled={!store.contactAvailable}
              className="rounded-full bg-[#1d5738] px-3 py-2 text-xs font-bold text-white shadow-[0_12px_25px_rgba(29,87,56,0.24)] transition hover:-translate-y-0.5 hover:bg-[#174d2f] sm:px-4 sm:text-sm"
            >
              Message seller
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 rounded-2xl border border-[#dfe8df] bg-[#f2f7f2] px-4 py-3 text-xs font-semibold text-[#2a5737] shadow-sm">
          Product orders are submitted to this store. WhatsApp opens a conversation with the seller; Razorpay is used for Supply Link subscriptions.
        </div>
        <section className="premium-panel relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#163d2a] via-[#234f37] to-[#3a8960] p-6 text-white shadow-[0_30px_60px_rgba(23,55,37,0.18)] sm:p-8 lg:p-10">
          <div className="absolute -right-10 top-10 h-60 w-60 rounded-full bg-white/8 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#d9f8df]/10 blur-3xl" />

          <div className="relative grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-[#ebf7ef]">
                <Sparkles size={12} className="text-[#c6f7d0]" />
                CURRENT COLLECTION
              </div>

              <h1 className="max-w-xl text-4xl font-black leading-[0.88] tracking-[-0.08em] sm:text-5xl lg:text-[4.2rem]">
                {businessName}
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-[#e4efe5] sm:text-base">
                {businessDescription}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="#products"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white px-6 py-3.5 text-sm font-black text-[#1f422c] shadow-[0_12px_26px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-[#f3faf4]"
                  style={{ minWidth: 170, letterSpacing: "-0.02em" }}
                >
                  View collection
                </a>
                <button
                  type="button"
                  onClick={() => handleSellerContact()}
                  disabled={!store.contactAvailable}
                  className="inline-flex items-center justify-center rounded-full border border-[#dff5e5]/60 bg-[#dff5e5] px-6 py-3.5 text-sm font-black text-[#153f2a] shadow-[0_12px_22px_rgba(15,54,33,0.14)] transition hover:-translate-y-0.5 hover:bg-[#cfeedd] disabled:opacity-50"
                  style={{ minWidth: 210, letterSpacing: "-0.02em" }}
                >
                  Order on WhatsApp
                </button>
              </div>

              <div className="mt-7 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#dfeee2]">
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-2">{products.length} products</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-2">{category}</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-2">Order request</span>
              </div>

            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm shadow-[0_18px_35px_rgba(9,31,18,0.12)] ring-1 ring-white/10">
              <div className="rounded-[24px] bg-[#edf7ee] p-4 text-[#1c3829]">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5d7d66]">Featured</div>
                    <div className="mt-1 text-base font-black">Collection highlights</div>
                  </div>
                  <div className="rounded-full bg-[#d7efd9] px-2.5 py-1 text-[10px] font-bold text-[#225a39]">{products.length} items</div>
                </div>

                <div className="space-y-3">
                  {featuredProducts.map((product) => (
                    <div key={`${product.id}-${product.name}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#edf1eb]">
                      <div>
                        <div className="text-sm font-bold text-[#1a3526]">{product.name}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7d71]">{product.tag}</div>
                      </div>
                      <div className="text-sm font-extrabold text-[#1b5b30]">{formatCurrency(product.price)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#edf2ee]">
                    <div className="text-lg font-black text-[#1d572f]">{products.length}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#768579]">Products</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#edf2ee]">
                    <div className="text-lg font-black text-[#1d572f]">{products.filter((product) => product.stock > 0).length}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#768579]">In stock</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#edf2ee]">
                    <div className="text-lg font-black text-[#1d572f]">{category}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#768579]">Collection</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Curated products", value: `${products.length}+`, icon: Sparkles },
            { label: "Product categories", value: categories.length, icon: Star },
            { label: "Available items", value: products.filter((product) => product.stock > 0).length, icon: Clock3 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[24px] border border-[#e5eee6] bg-white p-5 shadow-[0_16px_35px_rgba(20,40,28,0.04)] transition hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(20,40,28,0.08)] premium-card">
              <div className="mb-4 inline-flex rounded-xl bg-[#edf6ee] p-2.5 text-[#1b5e36]"><Icon size={18} /></div>
              <div className="text-2xl font-black text-[#1d4c31]">{value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[#7d8d81]">{label}</div>
            </div>
          ))}
        </section>

        {checkoutOpen && (
          <section className="mt-10 rounded-[30px] border border-[#e6eee7] bg-white p-6 shadow-[0_18px_40px_rgba(22,33,27,0.04)] premium-card sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-[0.18em] text-[#78917c]">CART</div>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1a2d1d]">Your order</h2>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="text-sm font-semibold text-[#235939]">Close</button>
            </div>

            {cart.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#dfe7e1] bg-[#f7faf7] p-5 text-sm text-[#5d7164]">Your cart is empty. Add a product to begin checkout.</div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#edf1ee] bg-[#fafcf9] p-3">
                      <div>
                        <p className="text-sm font-bold text-[#1d3124]">{item.name}</p>
                        <p className="mt-1 text-xs text-[#75867a]">{formatCurrency(item.price)} each</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="rounded-lg border border-[#e7efe8] bg-white p-1.5 text-[#1d5738]" aria-label={`Decrease quantity for ${item.name}`}>
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[22px] text-center text-sm font-bold text-[#1d3124]">{item.quantity}</span>
                        <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="rounded-lg border border-[#e7efe8] bg-white p-1.5 text-[#1d5738]" aria-label={`Increase quantity for ${item.name}`}>
                          <Plus size={14} />
                        </button>
                        <button type="button" onClick={() => removeFromCart(item.id)} className="ml-2 text-xs font-semibold text-[#8d3b3b]">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCheckoutSubmit} className="rounded-[24px] border border-[#edf1ee] bg-[#fafcf9] p-4">
                  <div className="grid gap-3">
                    <input required value={checkoutForm.name} onChange={(event) => setCheckoutForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                    <input required value={checkoutForm.phone} onChange={(event) => setCheckoutForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                    <input value={checkoutForm.email} onChange={(event) => setCheckoutForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email (optional)" className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                    <textarea required value={checkoutForm.address} onChange={(event) => setCheckoutForm((current) => ({ ...current, address: event.target.value }))} placeholder="Delivery address" rows={3} className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={checkoutForm.city} onChange={(event) => setCheckoutForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                      <input value={checkoutForm.postalCode} onChange={(event) => setCheckoutForm((current) => ({ ...current, postalCode: event.target.value }))} placeholder="Postal code" className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                    </div>
                    <textarea value={checkoutForm.notes} onChange={(event) => setCheckoutForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Order notes (optional)" rows={2} className="rounded-xl border border-[#e1e8df] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#659873]" />
                  </div>

                  <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#edf0eb]">
                    <div className="flex items-center justify-between text-sm text-[#607166]">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-[#607166]">
                      <span>Shipping</span>
                      <span>{formatCurrency(shippingFee)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#edf0eb] pt-3 text-base font-black text-[#1d3124]">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {checkoutStatus && (
                    <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${checkoutStatus.tone === "success" ? "border-[#d8eef0] bg-[#edf9f5] text-[#1c5f3c]" : "border-[#f3d4d5] bg-[#fff4f4] text-[#7f2d2d]"}`}>
                      {checkoutStatus.message}
                      {checkoutStatus.trackingUrl && <Link to={checkoutStatus.trackingUrl} className="mt-2 block font-bold underline">Track this order</Link>}
                    </div>
                  )}

                  <button type="submit" disabled={placingOrder} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5738] px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(29,87,56,0.18)] disabled:cursor-not-allowed disabled:opacity-70">
                    {placingOrder ? "Placing order..." : "Place order"}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        <section id="products" className="mt-10 rounded-[30px] border border-[#e6eee7] bg-[#f9f7f4] p-6 shadow-[0_18px_40px_rgba(22,33,27,0.04)] premium-card sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-[#78917c]">FEATURED</div>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1a2d1d]">Products</h2>
            </div>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#235939]">View all <ArrowRight size={14} /></Link>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="min-w-0 flex-1 rounded-xl border border-[#dfe8df] bg-white px-4 py-3 text-sm outline-none focus:border-[#659873]" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-[#dfe8df] bg-white px-4 py-3 text-sm outline-none">
              {["All", ...categories].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          {topProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dfe7e1] bg-white p-8 text-center text-sm text-[#607166]">
              {products.length ? "No products match your search." : "This store has not published any products yet."}
            </div>
          ) : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {topProducts.map((product) => (
              <article key={`${product.id}-${product.name}`} className="group overflow-hidden rounded-[26px] border border-[#edf0eb] bg-white p-4 shadow-[0_10px_35px_rgba(17,34,24,0.03)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(24,52,35,0.08)]">
                <div className={`mb-4 flex h-40 items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br ${product.accent} text-2xl font-black text-[#2a5f3b] shadow-inner ring-1 ring-white/60`}>
                  {product.images[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : product.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#738577]">{product.tag}</div>
                  <div className="text-[10px] font-bold text-[#22593b]">{product.stock > 0 ? "In stock" : "Out of stock"}</div>
                </div>

                <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#1d3124]">{product.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#697b71]">{product.description}</p>
                <details className="mt-3 text-xs text-[#52685a]">
                  <summary className="cursor-pointer font-semibold">Product details</summary>
                  <p className="mt-2">{product.description || "The seller has not added more details for this product."}</p>
                  <p className="mt-1">SKU: {product.sku || "Not provided"}</p>
                </details>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xl font-black text-[#1d5a32]">{formatCurrency(product.price)}</div>
                    {product.compareAt > product.price && <div className="text-xs text-[#8a938b] line-through">{formatCurrency(product.compareAt)}</div>}
                  </div>
                  <div className="text-xs font-medium text-[#5d6d64]">{product.stock} left</div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    disabled={product.stock < 1}
                    onClick={() => addToCart(product)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#1d5738] px-3 py-3 text-xs font-black text-white shadow-[0_12px_24px_rgba(29,87,56,0.18)] transition hover:bg-[#154a2d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingBag size={14} /> Add to cart
                  </button>
                  <button
                    type="button"
                    disabled={!store.contactAvailable}
                    onClick={() => handleSellerContact(product)}
                    className="rounded-[14px] border border-[#e3eae4] bg-[#f4f7f5] px-3 py-3 text-xs font-bold text-[#1f422d] transition hover:bg-[#edf3ef]"
                    aria-label={`Message seller about ${product.name}`}
                  >
                    Chat
                  </button>
                </div>
              </article>
            ))}
          </div>}
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-[#e5eee6] bg-white p-6 shadow-[0_12px_35px_rgba(21,44,31,0.04)] premium-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#edf6ee] p-2.5 text-[#1f5a37]"><Bot size={18} /></div>
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-[#7f9582]">STORE GUIDE</div>
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">Ask anything about the collection</h3>
              </div>
            </div>

            <div className="rounded-2xl border border-[#eaf1eb] bg-[#f8fbf8] p-3">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#738577]">Your question</label>
              <div>
                <input
                  value={faqQuestion}
                  onChange={(event) => setFaqQuestion(event.target.value)}
                  placeholder="Example: What type of products do you sell?"
                  className="w-full rounded-xl border border-[#dfe9e2] bg-white px-3 py-3 text-sm text-[#1c2e22] outline-none ring-0 placeholder:text-[#8a978d] focus:border-[#2e7a52]"
                />
              </div>
            </div>

            <div className="mt-5 rounded-[22px] bg-gradient-to-br from-[#edf7ee] to-[#f4faf4] p-4 border border-[#e7f0e9]">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e7b67]">
                <Bot size={12} /> Smart answer
              </div>
              <p className="text-sm leading-7 text-[#294937]">{faqAnswer}</p>
            </div>

            <div className="mt-5 space-y-2">
              {[
                "What type of products do you sell?",
                "How much does it cost?",
                "How fast is delivery?",
                "Is this good for gifting?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setFaqQuestion(prompt);
                  }}
                  className="block w-full rounded-xl border border-[#e6eee7] bg-[#fafcf9] px-3 py-2.5 text-left text-sm font-medium text-[#213c2d] transition hover:border-[#cfe0d0] hover:bg-[#f2f8f2]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#e5eee6] bg-[#f9fbf9] p-6 shadow-[0_12px_35px_rgba(21,44,31,0.04)] premium-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#edf6ee] p-2.5 text-[#1f5a37]"><MessageCircle size={18} /></div>
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-[#7f9582]">ORDER SAFE</div>
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">Contact seller on WhatsApp</h3>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#e7efe8] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f9582]">Contact</div>
                  <div className="mt-2 text-base font-black text-[#1d3528]">WhatsApp order chat</div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-7 text-[#607166]">
                Your number is not displayed on this page. WhatsApp requires a recipient identifier to start a chat, so that identifier may be visible in the destination URL. For full privacy, this needs a WhatsApp Business messaging service on the backend.
              </p>

              <button
                type="button"
                onClick={() => handleSellerContact()}
                disabled={!store.contactAvailable}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5738] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#154a2d] shadow-[0_12px_24px_rgba(29,87,56,0.2)]"
              >
                <MessageCircle size={16} /> Start order on WhatsApp
              </button>
              {!store.contactAvailable && <p role="status" className="mt-3 text-xs text-[#8a5a32]">The seller has not configured a valid WhatsApp number yet.</p>}
            </div>

          </div>
        </section>

        <section className="mt-10">
          <div className="rounded-[28px] border border-[#e5eee6] bg-white p-6 shadow-sm premium-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#edf6ee] p-2.5 text-[#1f5a37]"><ShieldCheck size={18} /></div>
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-[#7f9582]">ABOUT THIS STORE</div>
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">{businessName}</h3>
              </div>
            </div>

            <p className="mt-3 text-sm leading-7 text-[#607166]">{businessDescription || "The seller has not added a store description."}</p>
            <div className="mt-4 inline-flex rounded-full bg-[#edf6ee] px-3 py-2 text-xs font-semibold text-[#315c3e]">{category}</div>
          </div>

        </section>

        <section className="mt-10 rounded-[30px] bg-gradient-to-r from-[#173d2a] via-[#1d4d34] to-[#3f8f61] p-6 text-white shadow-[0_24px_60px_rgba(28,70,47,0.18)] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d6efe0]">READY TO ORDER</div>
              <h3 className="mt-2 text-2xl font-black tracking-tight">Bring premium shopping to your next customer.</h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-[#ebf7ee]">{cartCount} items added</div>
              <button
                type="button"
                onClick={() => handleSellerContact()}
                disabled={!store.contactAvailable}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1d4b31] transition hover:-translate-y-0.5"
              >
                Chat on WhatsApp <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
