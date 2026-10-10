import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPublicOrder } from "../services/api";

const accentThemes = [
  "from-[#edf6ee] via-[#f6fbf6] to-[#dfeafc]",
  "from-[#f4efe8] via-[#fffaf4] to-[#e7f4eb]",
  "from-[#eef4f7] via-[#f6fbff] to-[#eaf0ff]",
  "from-[#f4efe8] via-[#fff7f2] to-[#f0f7ec]",
  "from-[#edf7ee] via-[#f4fbf3] to-[#e7f5ea]",
  "from-[#f2effd] via-[#f8f4ff] to-[#ebf0ff]",
];

const fallbackProducts = [
  { id: "fallback-1", name: "Everyday Tote", price: 799, compareAt: 999, tag: "Best seller", accent: accentThemes[0], stock: 12, rating: 4.9, reviews: 214 },
  { id: "fallback-2", name: "Classic Cotton Shirt", price: 999, compareAt: 1299, tag: "New", accent: accentThemes[1], stock: 8, rating: 4.8, reviews: 189 },
  { id: "fallback-3", name: "Minimal Wallet", price: 599, compareAt: 799, tag: "Popular", accent: accentThemes[2], stock: 15, rating: 4.7, reviews: 143 },
  { id: "fallback-4", name: "Ceramic Mug", price: 349, compareAt: 499, tag: "Hot", accent: accentThemes[3], stock: 26, rating: 4.9, reviews: 271 },
  { id: "fallback-5", name: "Travel Bottle", price: 499, compareAt: 699, tag: "Trending", accent: accentThemes[4], stock: 7, rating: 4.8, reviews: 168 },
  { id: "fallback-6", name: "Leather Journal", price: 749, compareAt: 999, tag: "Premium", accent: accentThemes[5], stock: 10, rating: 4.9, reviews: 132 },
];

const reviewCards = [
  {
    name: "Riya K.",
    text: "The product experience felt premium from the first click. Delivery was precisely on time and the packaging looked beautifully branded.",
    rating: 5,
  },
  {
    name: "Amit P.",
    text: "The storefront feels effortless to browse, and the WhatsApp ordering flow makes shopping quick and easy on mobile.",
    rating: 5,
  },
  {
    name: "Sneha M.",
    text: "Beautifully curated essentials with real quality. This feels like a premium boutique rather than a generic online store.",
    rating: 5,
  },
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
  price: Number(product?.price || 499 + index * 100),
  compareAt: Number(product?.compareAtPrice || product?.compareAt || product?.price * 1.2 || 599 + index * 120),
  tag: product?.category || ["Best seller", "New", "Popular", "Hot", "Trending", "Premium"][index % 6],
  accent: accentThemes[index % accentThemes.length],
  stock: Number(product?.stock ?? 12 + (index % 5) * 6),
  rating: Number(product?.rating || 4.8),
  reviews: Number(product?.reviews || 120 + index * 18),
  description: product?.description || "Premium everyday essentials selected for convenience and style.",
});

const buildWhatsAppLink = (phone, businessName, productName = "") => {
  const digits = String(phone || "").replace(/\D/g, "");
  const cleanBusinessName = businessName || "this store";
  const message = productName
    ? `Hi ${cleanBusinessName}, I am interested in ${productName}. Please share pricing, availability, and the next step to order.`
    : `Hi ${cleanBusinessName}, I want to place an order or ask a question about your products.`;

  if (!digits) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

const openWhatsApp = (phone, businessName, productName = "") => {
  const url = buildWhatsAppLink(phone, businessName, productName);

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return url;
};

const buildSellerChatUrl = (chatUrl, businessName, productName = "") => {
  const cleanBusinessName = businessName || "this store";
  const productMessage = productName
    ? `Hi ${cleanBusinessName}, I want to order ${productName}. Please share pricing, availability, and the next steps to complete my order.`
    : `Hi ${cleanBusinessName}, I want to place an order or ask a question about your products.`;

  if (!chatUrl) {
    return buildWhatsAppLink(null, cleanBusinessName, productName);
  }

  try {
    const parsedUrl = new URL(chatUrl);
    parsedUrl.searchParams.set("text", productMessage);
    return parsedUrl.toString();
  } catch (error) {
    return buildWhatsAppLink(null, cleanBusinessName, productName);
  }
};

const getAiAnswer = (question, storeName, productList, faqList = []) => {
  const q = String(question || "").toLowerCase();

  if (!q) {
    return "Ask anything about the products, pricing, delivery, or usage and I’ll help instantly.";
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
    const cheapest = productList.reduce((lowest, item) => (item.price < lowest.price ? item : lowest), productList[0]);
    return `${storeName} starts from ${formatCurrency(cheapest.price)} for selected essentials, with premium options available depending on the product.`;
  }

  if (q.includes("what type") || q.includes("type is") || q.includes("kind of") || q.includes("category")) {
    const categories = [...new Set(productList.map((item) => item.tag))].slice(0, 3).join(", ");
    return `${storeName} focuses on ${categories} essentials, with curated products designed for daily use, gifting, and premium lifestyle needs.`;
  }

  if (q.includes("delivery") || q.includes("shipping") || q.includes("how long") || q.includes("when")) {
    return `Orders are typically confirmed quickly, and delivery is arranged in a fast local workflow so customers can receive their essentials without long delays.`;
  }

  if (q.includes("material") || q.includes("fabric") || q.includes("quality") || q.includes("made of")) {
    return `The collection is selected to balance lasting quality, comfort, and premium everyday use. Each item is reviewed for finish and practical value before dispatch.`;
  }

  if (q.includes("gift") || q.includes("present") || q.includes("occasion")) {
    return `Yes — many items in this store are well suited for gifting, especially premium daily-use essentials and curated bundles created for thoughtful occasions.`;
  }

  if (q.includes("use") || q.includes("used for") || q.includes("for whom") || q.includes("good for")) {
    const featured = productList[0]?.name || "the collection";
    return `${featured} is designed for everyday living and practical premium use, making it easy to style and use across daily routines.`;
  }

  const match = productList.find((product) => q.includes(product.name.toLowerCase()));
  if (match) {
    return `${match.name} is part of the featured lineup at ${storeName}. It is currently priced at ${formatCurrency(match.price)} and selected for premium everyday use.`;
  }

  return `The best way to confirm this is to message ${storeName} directly on WhatsApp. We can answer sizing, product fit, delivery timing, and custom order questions quickly.`;
};

export default function Storefront() {
  const { slug } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState(fallbackProducts);
  const [loading, setLoading] = useState(true);
  const [liveViews, setLiveViews] = useState(142);
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [faqQuestion, setFaqQuestion] = useState("What type of products do you sell?");
  const [faqAnswer, setFaqAnswer] = useState("");
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
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const response = await fetch(`${apiBase}/store/${encodeURIComponent(slug || "mystore")}`);

        if (!response.ok) {
          throw new Error("Store unavailable");
        }

        const payload = await response.json();
        const seller = payload?.store || null;
        const list = Array.isArray(payload?.products) && payload.products.length > 0 ? payload.products : fallbackProducts;

        if (isMounted) {
          const nextSeller = seller || {
            businessName: titleCase(slug || "mystore"),
            description: "Premium essentials for everyday living and effortless gifting.",
            category: "Lifestyle",
            whatsapp: "",
            faqs: [],
          };

          setStore(nextSeller);
          setFaqs(Array.isArray(nextSeller.faqs) ? nextSeller.faqs : []);
          setProducts(list.map(normalizeProduct));
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (isMounted) {
          const fallbackSeller = {
            businessName: titleCase(slug || "mystore"),
            description: "Premium essentials for everyday living and effortless gifting.",
            category: "Lifestyle",
            whatsapp: "",
            faqs: [],
          };

          setStore(fallbackSeller);
          setFaqs([]);
          setProducts(fallbackProducts);
          setLastUpdated(new Date());
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStore();
    const refreshInterval = setInterval(loadStore, 15000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [slug]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setLiveViews((current) => {
        const next = current + (Math.random() > 0.5 ? 2 : -1);
        return Math.max(76, next);
      });
    }, 4500);

    return () => clearInterval(ticker);
  }, []);

  const businessName = useMemo(
    () => store?.businessName || titleCase(slug || "mystore"),
    [slug, store]
  );

  const businessDescription = useMemo(
    () =>
      store?.description ||
      "Premium essentials for everyday living and effortless gifting with a refined shopping experience.",
    [store]
  );

  const category = useMemo(() => store?.category || "Lifestyle", [store]);
  const sellerChatLink = useMemo(
    () => store?.chatUrl || buildWhatsAppLink(store?.whatsapp, businessName),
    [store, businessName]
  );
  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);
  const topProducts = useMemo(() => products.slice(0, 6), [products]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const shippingFee = subtotal > 0 ? 49 : 0;
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

          const safeQuantity = Math.max(0, Number(nextQuantity));
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

      setCheckoutStatus({
        tone: "success",
        message: `Order placed successfully. Reference: ${reference}`,
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

  useEffect(() => {
    const initialAnswer = getAiAnswer(faqQuestion, businessName, products, faqs);
    setFaqAnswer(initialAnswer);
  }, [businessName, products, faqs]);

  const askAiFaq = () => {
    setFaqAnswer(getAiAnswer(faqQuestion, businessName, products, faqs));
  };

  const handleSellerContact = (productName = "") => {
    const directTarget = buildSellerChatUrl(store?.chatUrl || store?.whatsapp, businessName, productName);

    if (typeof window !== "undefined") {
      window.open(directTarget, "_blank", "noopener,noreferrer");
    }

    return directTarget;
  };

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
              className="rounded-full bg-[#1d5738] px-3 py-2 text-xs font-bold text-white shadow-[0_12px_25px_rgba(29,87,56,0.24)] transition hover:-translate-y-0.5 hover:bg-[#174d2f] sm:px-4 sm:text-sm"
            >
              Message seller
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 rounded-2xl border border-[#dfe8df] bg-[#f2f7f2] px-4 py-3 text-xs font-semibold text-[#2a5737] shadow-sm">
          Buyers order through WhatsApp. Razorpay is only used for platform subscription billing, not for product orders.
        </div>
        <section className="premium-panel relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#163d2a] via-[#234f37] to-[#3a8960] p-6 text-white shadow-[0_30px_60px_rgba(23,55,37,0.18)] sm:p-8 lg:p-10">
          <div className="absolute -right-10 top-10 h-60 w-60 rounded-full bg-white/8 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#d9f8df]/10 blur-3xl" />
          <div className="absolute right-6 top-6 hidden rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ebf7ef] backdrop-blur-sm sm:block">
            Trusted by 2.4k shoppers
          </div>

          <div className="relative grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-[#ebf7ef]">
                <Sparkles size={12} className="text-[#c6f7d0]" />
                {loading ? "LOADING COLLECTION" : "LIVE COLLECTION"}
              </div>

              <h1 className="max-w-xl text-4xl font-black leading-[0.88] tracking-[-0.08em] sm:text-5xl lg:text-[4.2rem]">
                Premium essentials for a more beautiful everyday.
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-[#e4efe5] sm:text-base">
                {loading
                  ? "Syncing the latest products and live updates from this storefront..."
                  : `${businessDescription} Discover thoughtfully curated ${category.toLowerCase()} picks from ${businessName}.`}
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
                  className="inline-flex items-center justify-center rounded-full border border-[#dff5e5]/60 bg-[#dff5e5] px-6 py-3.5 text-sm font-black text-[#153f2a] shadow-[0_12px_22px_rgba(15,54,33,0.14)] transition hover:-translate-y-0.5 hover:bg-[#cfeedd]"
                  style={{ minWidth: 210, letterSpacing: "-0.02em" }}
                >
                  Order on WhatsApp
                </button>
              </div>

              <div className="mt-7 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#dfeee2]">
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-2">Same-day dispatch</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-2">Secure checkout</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-2">Verified quality</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {[
                  { label: "2.4k+ orders", tone: "bg-white/8" },
                  { label: "4.9/5 rating", tone: "bg-[#dff5e5] text-[#153f2a]" },
                  { label: "2h support", tone: "bg-white/8" },
                ].map(({ label, tone }) => (
                  <div key={label} className={`rounded-full border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] ${tone}`}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm shadow-[0_18px_35px_rgba(9,31,18,0.12)] ring-1 ring-white/10">
              <div className="rounded-[24px] bg-[#edf7ee] p-4 text-[#1c3829]">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5d7d66]">Today</div>
                    <div className="mt-1 text-base font-black">Live pulse</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#d7efd9] px-2.5 py-1 text-[10px] font-bold text-[#225a39]">
                    <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" /> LIVE
                  </div>
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
                    <div className="text-lg font-black text-[#1d572f]">{liveViews}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#768579]">Views</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#edf2ee]">
                    <div className="text-lg font-black text-[#1d572f]">{Math.max(18, Math.round(products.length * 2.2))}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#768579]">Orders</div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#edf2ee]">
                    <div className="text-lg font-black text-[#1d572f]">{lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#768579]">Updated</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Curated products", value: `${products.length}+`, icon: Sparkles },
            { label: "Happy customers", value: "8.4k", icon: Star },
            { label: "Response time", value: "2 hrs", icon: Clock3 },
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
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1a2d1d]">Popular this week</h2>
            </div>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#235939]">View all <ArrowRight size={14} /></Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {topProducts.map((product) => (
              <article key={`${product.id}-${product.name}`} className="group overflow-hidden rounded-[26px] border border-[#edf0eb] bg-white p-4 shadow-[0_10px_35px_rgba(17,34,24,0.03)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(24,52,35,0.08)]">
                <div className={`mb-4 flex h-40 items-center justify-center rounded-[20px] bg-gradient-to-br ${product.accent} text-2xl font-black text-[#2a5f3b] shadow-inner ring-1 ring-white/60`}>
                  {product.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#738577]">{product.tag}</div>
                  <div className="flex items-center gap-1 rounded-full bg-[#edf7ee] px-2 py-1 text-[10px] font-bold text-[#22593b]">
                    <Star size={10} fill="currentColor" /> {Number(product.rating).toFixed(1)}
                  </div>
                </div>

                <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#1d3124]">{product.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#697b71]">{product.description}</p>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xl font-black text-[#1d5a32]">{formatCurrency(product.price)}</div>
                    <div className="text-xs text-[#8a938b] line-through">{formatCurrency(product.compareAt)}</div>
                  </div>
                  <div className="text-xs font-medium text-[#5d6d64]">{product.stock} left</div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#1d5738] px-3 py-3 text-xs font-black text-white shadow-[0_12px_24px_rgba(29,87,56,0.18)] transition hover:bg-[#154a2d]"
                  >
                    <ShoppingBag size={14} /> Add to cart
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSellerContact(product.name)}
                    className="rounded-[14px] border border-[#e3eae4] bg-[#f4f7f5] px-3 py-3 text-xs font-bold text-[#1f422d] transition hover:bg-[#edf3ef]"
                    aria-label={`Message seller about ${product.name}`}
                  >
                    Chat
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-[#e5eee6] bg-white p-6 shadow-[0_12px_35px_rgba(21,44,31,0.04)] premium-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#edf6ee] p-2.5 text-[#1f5a37]"><Bot size={18} /></div>
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-[#7f9582]">AI SHOP GUIDE</div>
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">Ask anything about the collection</h3>
              </div>
            </div>

            <div className="rounded-2xl border border-[#eaf1eb] bg-[#f8fbf8] p-3">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#738577]">Your question</label>
              <div className="flex gap-2">
                <input
                  value={faqQuestion}
                  onChange={(event) => setFaqQuestion(event.target.value)}
                  placeholder="Example: What type of products do you sell?"
                  className="w-full rounded-xl border border-[#dfe9e2] bg-white px-3 py-3 text-sm text-[#1c2e22] outline-none ring-0 placeholder:text-[#8a978d] focus:border-[#2e7a52]"
                />
                <button
                  onClick={askAiFaq}
                  className="inline-flex items-center justify-center rounded-xl bg-[#1d5738] p-3 text-white transition hover:bg-[#174a2f]"
                  aria-label="Ask AI"
                >
                  <Send size={16} />
                </button>
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
                    setFaqAnswer(getAiAnswer(prompt, businessName, products, faqs));
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
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">Secure WhatsApp ordering</h3>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#e7efe8] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f9582]">Contact</div>
                  <div className="mt-2 text-base font-black text-[#1d3528]">WhatsApp order chat</div>
                </div>
                <div className="rounded-full bg-[#ecf9f0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#24613b]">Private</div>
              </div>

              <p className="mt-3 text-sm leading-7 text-[#607166]">
                We do not expose the raw seller number in the storefront. Customers start a secure WhatsApp chat through a protected link, keeping the number safer while still allowing instant ordering.
              </p>

              <button
                type="button"
                onClick={() => handleSellerContact()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5738] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#154a2d] shadow-[0_12px_24px_rgba(29,87,56,0.2)]"
              >
                <MessageCircle size={16} /> Start order on WhatsApp
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { icon: ShieldCheck, title: "Safer contact", text: "Number is not exposed directly on the storefront." },
                { icon: Clock3, title: "Fast reply", text: "Customers can order or ask questions in seconds." },
                { icon: Sparkles, title: "Premium trust", text: "The flow feels polished and more professional for buyers." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border border-[#edf0eb] bg-white p-3">
                  <div className="rounded-xl bg-[#edf6ee] p-2 text-[#1f5a37]"><Icon size={16} /></div>
                  <div>
                    <div className="text-sm font-bold text-[#213f2d]">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-[#697b71]">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-[#e5eee6] bg-white p-6 shadow-sm premium-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#edf6ee] p-2.5 text-[#1f5a37]"><ShieldCheck size={18} /></div>
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-[#7f9582]">WHY SHOP HERE</div>
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">Thoughtful service at every step</h3>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Truck, title: "Fast local delivery", text: "Orders are packed and dispatched quickly for a frictionless experience." },
                { icon: Check, title: "Quality checked", text: "Each product is reviewed before it's sent to customers and shoppers." },
                { icon: MapPin, title: "Local-first service", text: "Built around neighborhood delivery and easy-to-reach support." },
                { icon: MessageCircle, title: "Quick WhatsApp help", text: "Get updates, questions, and confirmations directly on your phone." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-[#edf0eb] bg-[#fafcf9] p-4">
                  <div className="mb-3 inline-flex rounded-xl bg-[#edf6ee] p-2.5 text-[#234f36]">
                    <Icon size={18} />
                  </div>
                  <div className="text-base font-bold text-[#213f2d]">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-[#6d7a71]">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#e5eee6] bg-[#f9fbf9] p-6 shadow-sm premium-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-[#7f9582]">LIVE</div>
                <h3 className="mt-1 text-2xl font-black text-[#1a2d1d]">Recent activity</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#edf7ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#23593a]">
                <Zap size={10} /> {liveViews} online
              </div>
            </div>

            <div className="space-y-3">
              {[
                { name: "Maya S.", action: "placed an order", time: "just now" },
                { name: "Arjun D.", action: "saved a product", time: "2 mins ago" },
                { name: "Kavya R.", action: "requested a custom quote", time: "6 mins ago" },
                { name: "Neha R.", action: "ordered a gift bundle", time: "11 mins ago" },
              ].map(({ name, action, time }) => (
                <div key={`${name}-${time}`} className="flex items-center justify-between rounded-2xl border border-[#e8eee8] bg-white px-3 py-3">
                  <div>
                    <div className="text-sm font-bold text-[#213f2d]">{name}</div>
                    <div className="text-xs text-[#6f7d72]">{action}</div>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6a7f6b]">{time}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-[#78917c]">REVIEWS</div>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-[#1a2d1d]">Loved by customers</h3>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#edf7ee] px-3 py-2 text-sm font-bold text-[#204e35]">
              <TrendingUp size={14} /> 4.9/5
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {reviewCards.map(({ name, text, rating }) => (
              <div key={name} className="rounded-[24px] border border-[#e5eee6] bg-white p-5 shadow-sm premium-card">
                <div className="mb-3 flex items-center gap-1 text-[#f5b942]">
                  {Array.from({ length: rating }).map((_, index) => (
                    <Star key={`${name}-${index}`} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm leading-7 text-[#586760]">“{text}”</p>
                <div className="mt-4 border-t border-[#edf0eb] pt-3 text-sm font-bold text-[#1d3527]">{name}</div>
              </div>
            ))}
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
