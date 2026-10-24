
import { Link, useParams } from "react-router-dom";
import "./StorefrontPremium.css";
import {
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  Heart,
  Leaf,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  buildStoreContactUrl,
  createPublicOrder,
  fetchPublicStore,
  subscribeToPublicStore,
  uploadPublicPaymentProof,
} from "../services/api";
const accentThemes = [
  "from-[#efe8db] via-[#f7f4ee] to-[#e2dccf]",
  "from-[#f4e7d8] via-[#fffdf9] to-[#e9d9c6]",
  "from-[#e8e0d2] via-[#f7f4ee] to-[#d9cebd]",
  "from-[#f7f4ee] via-[#fffdf9] to-[#eadfce]",
  "from-[#efe8db] via-[#f7f4ee] to-[#ded5c7]",
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
const createRequestId = () =>
  window.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeProduct = (product, index) => ({
  id: product?._id || product?.id || `${product?.name || "product"}-${index}`,
  name: product?.name || `Product ${index + 1}`,
  price: Number(product?.price ?? 0),
  compareAt: Number(product?.compareAtPrice || product?.compareAt || 0),
  tag: product?.category || "General",
  accent: accentThemes[index % accentThemes.length],
  stock: Math.max(0, Number(product?.stock ?? 0)),
  description: product?.description || "",
  images: Array.isArray(product?.images) ? product.images : [],
  sku: product?.sku || "",
});
const getStoreGuideAnswer = (question, storeName, productList, faqList = []) => {
  const q = String(question || "").trim().toLowerCase();
  if (!q) {
    return "Ask about published products, prices, categories, or delivery information.";
  }
  const directFaq = faqList.find((faq) => {
    const faqQuestion = String(faq?.question || "").trim().toLowerCase();
    return faqQuestion && (
      q.includes(faqQuestion) ||
      faqQuestion.includes(q)
    );
  });
  if (directFaq?.answer) return directFaq.answer;
  if (/price|cost|how much|rate|cheap|expensive/.test(q)) {
    if (!productList.length) return `${storeName} has not published any products yet.`;
    const cheapest = [...productList].sort((a, b) => a.price - b.price)[0];
    return `Prices at ${storeName} currently start at ${formatCurrency(cheapest.price)}.`;
  }
  if (/category|categories|what type|what kind|products do you sell/.test(q)) {
    const categories = [...new Set(productList.map((item) => item.tag))];
    return categories.length
      ? `${storeName} offers products in ${categories.slice(0, 5).join(", ")}.`
      : `${storeName} has not published product categories yet.`;
  }
  if (/delivery|shipping|how long|when.*arrive|deliver/.test(q)) {
    return "Delivery timing has not been specified by this store. Contact the seller to confirm delivery availability, charges, and estimated arrival.";
  }
  if (/material|fabric|quality|made of|ingredients|care instructions/.test(q)) {
    const match = productList.find((product) =>
      q.includes(product.name.toLowerCase())
    );
    return match?.description
      ? `${match.name}: ${match.description}`
      : "Product-specific material and care details are not available here. Please contact the seller for confirmation.";
  }
  if (/gift|present|occasion/.test(q)) {
    return "Check the product descriptions for details, or message the seller to ask about gift options and availability.";
  }
  const match = productList.find((product) =>
    q.includes(product.name.toLowerCase())
  );
  if (match) {
    return `${match.name} is listed at ${formatCurrency(match.price)}. ${match.description || "The seller has not added a detailed description yet."} ${match.stock > 0 ? `${match.stock} available.` : "Currently out of stock."}`;
  }
  return `I couldn't find enough published information to answer that accurately. Contact ${storeName} directly for confirmation.`;
};
const Button = ({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  type = "button",
}) => {
  const styles = {
    primary: "border border-ink bg-ink text-paper hover:border-accent hover:bg-accent hover:text-ink",
    secondary: "border border-line bg-surface text-ink hover:border-line-strong hover:bg-paper",
    outline: "border border-line-strong bg-transparent text-ink hover:border-accent hover:bg-paper",
    light: "border border-accent bg-accent text-ink hover:brightness-95",
    dark: "border border-ink bg-ink text-paper hover:bg-[#302c25]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold transition duration-150 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-color)] ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
function ProductCard({ product, index = 0, onAdd, onBuy, onToggleWishlist, isWishlisted, contactAvailable, paymentReady, onOpen }) {
  const image = product.images?.[0];
  const reduceMotion = useReducedMotion();
  const [failedImage, setFailedImage] = useState("");
  const imageAvailable = Boolean(image && failedImage !== image);
  const discount =
    product.compareAt > product.price && product.compareAt > 0
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      viewport={{ once: true, amount: 0.12 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.12), ease: "easeOut" }}
      className="sl-product-card group flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface"
    >
      <div className={`sl-product-image relative aspect-[4/5] overflow-hidden bg-gradient-to-br ${product.accent}`}>
        <button
          type="button"
          onClick={() => onOpen?.(product)}
          className="absolute inset-0 grid w-full place-items-center"
          aria-label={`View details for ${product.name}`}
        >
          {imageAvailable ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailedImage(image)}
              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.025]"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted" aria-hidden="true">
              <ShoppingBag size={27} strokeWidth={1.35} />
            </span>
          )}
        </button>
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-3rem)] flex-wrap gap-1.5 sm:left-3 sm:top-3">
          {discount > 0 && (
            <span className="rounded-[3px] border border-line bg-surface px-2 py-1 text-[9px] font-bold text-ink">
              {discount}% off
            </span>
          )}
          {product.stock > 0 && product.stock <= 5 && (
            <span className="rounded-[3px] border border-warning/25 bg-warning-soft px-2 py-1 text-[9px] font-bold text-warning">
              Only {product.stock} left
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={isWishlisted}
          onClick={() => onToggleWishlist(product.id)}
          className={`absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-[var(--radius-control)] border border-line transition sm:right-3 sm:top-3 ${
            isWishlisted
              ? "bg-ink text-surface"
              : "bg-surface/95 text-muted hover:text-ink"
          }`}
        >
          <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        {product.stock < 1 && (
          <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center bg-paper/65">
            <span className="rounded-[3px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink">
              Sold out
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">
            {product.tag}
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold ${product.stock > 0 ? "text-success" : "text-danger"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-success" : "bg-danger"}`} />
            {product.stock > 0 ? `${product.stock} available` : "Sold out"}
            </span>
        </div>
        <h3 className="mt-2 min-h-[2.7rem] break-words text-sm font-semibold leading-snug text-ink sm:text-base">
          <button type="button" className="text-left" onClick={() => onOpen?.(product)}>
            {product.name}
          </button>
        </h3>
        <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="sl-tabular break-words text-base font-bold tracking-tight text-ink sm:text-lg">
              {formatCurrency(product.price)}
            </div>
            {product.compareAt > product.price && (
              <div className="mt-0.5 text-xs text-muted line-through">
                {formatCurrency(product.compareAt)}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Button
            variant="secondary"
            className="min-h-10 w-full min-w-0 rounded-[var(--radius-control)] px-2 text-[11px] sm:text-xs"
            disabled={product.stock < 1}
            onClick={() => onAdd(product)}
          >
            <ShoppingBag size={14} aria-hidden="true" /> Add to bag
          </Button>
          <Button
            variant="outline"
            className="min-h-10 w-full min-w-0 rounded-[var(--radius-control)] px-2 text-[11px] sm:text-xs"
            disabled={product.stock < 1 || !contactAvailable || !paymentReady}
            onClick={() => onBuy(product)}
          >
            <span className="truncate">Buy now</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
export default function Storefront() {
  const { slug } = useParams();
  const paymentSessionKey = `supplylink-payment-${slug || "store"}`;
  const [restoredPayment] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(paymentSessionKey) || "null");
    } catch {
      return null;
    }
  });
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartNotice, setCartNotice] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(Boolean(restoredPayment?.orderCheckout));
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState(createRequestId);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [orderCheckout, setOrderCheckout] = useState(restoredPayment?.orderCheckout || null);
  const [proofFile, setProofFile] = useState(null);
  const [checkoutStage, setCheckoutStage] = useState(restoredPayment?.checkoutStage || "details");
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [faqQuestion, setFaqQuestion] = useState("What type of products do you sell?");
  const [faqs, setFaqs] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [requestedProductQuantity, setRequestedProductQuantity] = useState(1);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const selectedQuantity = Math.min(requestedProductQuantity, Math.max(1, selectedProduct?.stock || 1));
  const reduceMotion = useReducedMotion();
  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postalCode: "",
    notes: "",
  });
  const loadStore = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      setLoadError("This store link is incomplete.");
      return;
    }
    try {
      const payload = await fetchPublicStore(slug);
      const seller = payload?.store || null;
      const list = Array.isArray(payload?.products) ? payload.products : [];
      setStore(seller);
      setFaqs(Array.isArray(seller?.faqs) ? seller.faqs : []);
      setProducts(list.map(normalizeProduct));
      setLoadError("");
    } catch (error) {
      setStore(null);
      setFaqs([]);
      setProducts([]);
      setLoadError(error?.message || "Unable to load this store.");
    } finally {
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    let active = true;
    let refreshInterval;
    const safeLoadStore = async () => {
      if (!active) return;
      await loadStore();
    };
    setLoading(true);
    safeLoadStore();
    let eventSource;
    try {
      eventSource = subscribeToPublicStore(slug);
      eventSource?.addEventListener?.("update", safeLoadStore);
    } catch {
      eventSource = null;
    }
    const syncRefresh = () => {
      window.clearInterval(refreshInterval);
      if (document.visibilityState === "visible") {
        refreshInterval = window.setInterval(safeLoadStore, 60000);
      }
    };
    syncRefresh();
    document.addEventListener("visibilitychange", syncRefresh);
    window.addEventListener("online", safeLoadStore);
    return () => {
      active = false;
      eventSource?.close?.();
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", syncRefresh);
      window.removeEventListener("online", safeLoadStore);
    };
  }, [slug, loadStore]);
  useEffect(() => {
    if (!cartNotice) return undefined;
    const timeout = window.setTimeout(() => setCartNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [cartNotice]);
  useEffect(() => {
    if (!selectedProduct && !checkoutOpen && !mobileMenuOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (selectedProduct) setSelectedProductId(null);
      else if (checkoutOpen && !placingOrder && !uploadingProof) setCheckoutOpen(false);
      else if (mobileMenuOpen) setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedProduct, checkoutOpen, mobileMenuOpen, placingOrder, uploadingProof]);
  useEffect(() => {
    if (!slug) return;
    if (orderCheckout) {
      sessionStorage.setItem(
        paymentSessionKey,
        JSON.stringify({ orderCheckout, checkoutStage })
      );
    } else {
      sessionStorage.removeItem(paymentSessionKey);
    }
  }, [slug, paymentSessionKey, orderCheckout, checkoutStage]);
  const businessName = useMemo(
    () => store?.businessName || titleCase(slug || "mystore"),
    [slug, store]
  );
  const businessDescription = useMemo(
    () => store?.description || "Browse the products currently published by this seller.",
    [store]
  );
  const category = store?.category || "Independent collection";
  useEffect(() => {
    if (!store) return undefined;
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.content;
    document.title = `${businessName} | Supply Link`;
    if (descriptionTag) {
      descriptionTag.content = businessDescription.slice(0, 160);
    }
    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription !== undefined) {
        descriptionTag.content = previousDescription;
      }
    };
  }, [store, businessName, businessDescription]);
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.tag))].sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tag.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "All" || product.tag === categoryFilter;
      const matchesStock = !inStockOnly || product.stock > 0;
      return matchesSearch && matchesCategory && matchesStock;
    });
    if (sortBy === "price-low") result.sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") result.sort((a, b) => b.price - a.price);
    if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "stock") result.sort((a, b) => b.stock - a.stock);
    return result;
  }, [products, search, categoryFilter, inStockOnly, sortBy]);
  const featuredProducts = useMemo(
    () => products.filter((product) => product.stock > 0).slice(0, 3),
    [products]
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const shippingFee = 0;
  const total = subtotal + shippingFee;
  const paymentReady = Boolean(store?.paymentQrUrl && store?.paymentProofAvailable);
  const contactAvailable = Boolean(store?.contactAvailable && store?.contactUrl);
  const faqAnswer = useMemo(
    () => getStoreGuideAnswer(faqQuestion, businessName, products, faqs),
    [faqQuestion, businessName, products, faqs]
  );
  const openProduct = (product) => {
    setSelectedProductId(product.id);
    setRequestedProductQuantity(1);
  };
  const addToCart = (product, quantity = 1) => {
    if (product.stock < 1) return;
    const requestedQuantity = Math.min(product.stock, Math.max(1, Math.floor(Number(quantity) || 1)));
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, stock: product.stock, quantity: Math.min(product.stock, item.quantity + requestedQuantity) }
            : item
        );
      }
      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          stock: Number(product.stock || 0),
          quantity: requestedQuantity,
        },
      ];
    });
    setCartNotice(`${product.name}${requestedQuantity > 1 ? ` × ${requestedQuantity}` : ""} added to your bag`);
    setOrderCheckout(null);
    setCheckoutStage("details");
    setCheckoutStatus(null);
    setCheckoutRequestId(createRequestId());
  };
  const buyNow = (product, quantity = 1) => {
    if (product.stock < 1 || !contactAvailable || !paymentReady) return;
    const requestedQuantity = Math.min(product.stock, Math.max(1, Math.floor(Number(quantity) || 1)));
    setCart([{
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      quantity: requestedQuantity,
    }]);
    setOrderCheckout(null);
    setCheckoutStage("details");
    setCheckoutOpen(true);
    setCheckoutStatus(null);
    setCheckoutRequestId(createRequestId());
  };
  const updateCartQuantity = (productId, nextQuantity) => {
    setCheckoutRequestId(createRequestId());
    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== productId) return item;
          const safeQuantity = Math.min(
            item.stock,
            Math.max(0, Number(nextQuantity))
          );
          return safeQuantity === 0 ? null : { ...item, quantity: safeQuantity };
        })
        .filter(Boolean)
    );
  };
  const removeFromCart = (productId) => {
    setCheckoutRequestId(createRequestId());
    setCart((current) => current.filter((item) => item.id !== productId));
  };
  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!slug || cart.length === 0) {
      setCheckoutStatus({
        tone: "error",
        message: "Add an available product before placing your order.",
      });
      return;
    }
    if (!contactAvailable || !paymentReady) {
      setCheckoutStatus({
        tone: "error",
        message: "This seller has not completed payment and contact setup yet.",
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
        paymentMethod: "WHATSAPP",
        requestId: checkoutRequestId,
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
      const buyerEmailStatus = response?.emailDelivery?.find(
        (item) => item.recipient === "buyer"
      )?.status;
      const emailNote = checkoutForm.email.trim() && buyerEmailStatus === "not_configured"
        ? " Email confirmation is not configured; keep your tracking link."
        : checkoutForm.email.trim() && buyerEmailStatus === "failed"
          ? " Email confirmation could not be submitted; keep your tracking link."
          : checkoutForm.email.trim() && buyerEmailStatus === "accepted"
            ? " The email provider accepted a confirmation request; inbox delivery is not confirmed."
            : "";
      const trackingUrl = response?.trackingToken
        ? `/track/${response.trackingToken}`
        : "";
      setCheckoutStatus({
        tone: "success",
        message: `Your order was saved and stock reserved. Scan the seller's QR and upload your payment screenshot. Payment remains pending until the seller verifies it. Reference: ${reference}.${emailNote}`,
        trackingUrl,
      });
      setOrderCheckout({
        reference,
        proofToken: response?.paymentProofToken || "",
        trackingUrl,
        items: cart.map((item) => ({
          productId: item.id,
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total: Number(response?.order?.totalAmount || total),
      });
      setCheckoutStage("payment");
      setProofFile(null);
      setCart([]);
      setCheckoutRequestId(createRequestId());
      setCheckoutForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        postalCode: "",
        notes: "",
      });
      await loadStore();
    } catch (error) {
      setCheckoutStatus({
        tone: "error",
        message: error?.message || "Unable to place your order. Please try again.",
      });
    } finally {
      setPlacingOrder(false);
    }
  };
  const handlePaymentProofSubmit = async (event) => {
    event.preventDefault();
    if (!orderCheckout?.proofToken || !proofFile || !slug) {
      setCheckoutStatus({
        tone: "error",
        message: "Choose a valid payment screenshot to continue.",
      });
      return;
    }
    const whatsappWindow = window.open("about:blank", "_blank");
    if (whatsappWindow) whatsappWindow.opener = null;
    setUploadingProof(true);
    setCheckoutStatus(null);
    try {
      await uploadPublicPaymentProof({
        slug,
        orderReference: orderCheckout.reference,
        token: orderCheckout.proofToken,
        file: proofFile,
      });
      const contactUrl = buildStoreContactUrl(
        store.contactUrl,
        orderCheckout.items,
        "",
        orderCheckout.reference,
        orderCheckout.proofToken
      );
      if (whatsappWindow && contactUrl) {
        whatsappWindow.location.href = contactUrl;
      } else if (contactUrl) {
        window.location.assign(contactUrl);
      } else {
        whatsappWindow?.close();
      }
      setOrderCheckout((current) =>
        current ? { ...current, proofToken: "" } : current
      );
      setCheckoutStage("complete");
      setCheckoutStatus({
        tone: "success",
        message: "Screenshot uploaded. Send the prepared WhatsApp message so the seller receives your order. Payment remains pending until the seller verifies it in their payment app.",
        trackingUrl: orderCheckout.trackingUrl,
      });
    } catch (error) {
      whatsappWindow?.close();
      setCheckoutStatus({
        tone: "error",
        message: error?.message || "Unable to upload payment screenshot.",
      });
    } finally {
      setUploadingProof(false);
    }
  };
  const handleProofFileChange = async (event) => {
    const file = event.target.files?.[0];
    setProofFile(null);
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      setCheckoutStatus({
        tone: "error",
        message: "Choose a PNG or JPEG screenshot no larger than 4 MB.",
      });
      event.target.value = "";
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const validSize =
        bitmap.width >= 320 &&
        bitmap.height >= 400 &&
        bitmap.width <= 6000 &&
        bitmap.height <= 6000;
      bitmap.close();
      if (!validSize) {
        throw new Error("Screenshot must be at least 320 × 400 pixels.");
      }
      setProofFile(file);
      setCheckoutStatus(null);
    } catch (error) {
      setCheckoutStatus({
        tone: "error",
        message: error?.message || "Unable to read this screenshot image.",
      });
      event.target.value = "";
    }
  };
  const handleSellerContact = (product = null) => {
    if (!contactAvailable) return;
    const items = product
      ? [{ productId: product.id, quantity: 1 }]
      : cart;
    const target = buildStoreContactUrl(
      store.contactUrl,
      items,
      product?.name || ""
    );
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };
  const toggleWishlist = (productId) => {
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F3ED] px-5 py-8" role="status" aria-label="Loading storefront">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[#E6E2D8]" />
              <div className="h-6 w-40 animate-pulse rounded-lg bg-[#E6E2D8]" />
            </div>
            <div className="h-10 w-24 animate-pulse rounded-full bg-[#E6E2D8]" />
          </div>
          <div className="mt-8 h-[360px] animate-pulse rounded-[30px] bg-[#E6E2D8] sm:h-[430px]" />
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="space-y-3 rounded-2xl bg-white p-3">
                <div className="aspect-[4/4.5] animate-pulse rounded-xl bg-[#E6E2D8]" />
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-[#E6E2D8]" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-[#E6E2D8]" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }
  if (loadError || !store) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F5F3ED] p-6">
        <div className="max-w-md rounded-[28px] border border-[#E6E2D8] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#F1EDE4] text-[#171B24]">
            <ShoppingBag size={24} />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#4A4F5C]">
            Supply Link
          </p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#171B24]">
            Store unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4A4F5C]">
            {loadError === "Store not found"
              ? "No published store matches this link. Check the URL or ask the seller to publish their store."
              : loadError || "This store could not be found."}
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Try again
            <ArrowRight size={15} />
          </Button>
        </div>
      </main>
    );
  }
  return (
    <div className="supply-storefront min-h-screen bg-[#F7F4EE] text-[#1C1A17]">
      <header className="sticky top-0 z-40 border-b border-[#E2DCCF] bg-[#F7F4EE]/95 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 px-3 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:px-8">
          <Link to={`/store/${slug}`} className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] bg-[#1C1A17] font-serif text-lg font-semibold text-white">
                {businessName.trim().slice(0, 1).toUpperCase() || "S"}
              </div>
              <div className="min-w-0">
                <div className="line-clamp-2 break-words font-serif text-base font-semibold leading-tight tracking-tight text-[#1C1A17] sm:text-lg">
                  {businessName}
                </div>
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            <a href="#collection" className="text-sm font-semibold text-[#4A4F5C] transition hover:text-[#171B24]">Collection</a>
            <a href="#our-story" className="text-sm font-semibold text-[#4A4F5C] transition hover:text-[#171B24]">About</a>
            <a href="#store-guide" className="text-sm font-semibold text-[#4A4F5C] transition hover:text-[#171B24]">Store guide</a>
          </nav>
          <div className="flex shrink-0 items-center justify-self-end gap-1.5 sm:gap-2">
            <Button
              variant="secondary"
              className="hidden px-3 sm:inline-flex"
              onClick={() => handleSellerContact()}
              disabled={!contactAvailable}
            >
              <MessageCircle size={16} />
              <span>Contact</span>
            </Button>
            <Button
              className="px-3 sm:px-4"
              onClick={() => setCheckoutOpen(true)}
            >
              <ShoppingBag size={16} />
              <span>Bag</span>
              <span className="grid min-w-5 place-items-center rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
                {cartCount}
              </span>
            </Button>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-[5px] border border-[#E2DCCF] bg-[#FFFDF9] text-[#1C1A17] lg:hidden"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {mobileMenuOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="col-span-full overflow-hidden border-t border-[#E2DCCF] bg-[#F7F4EE] px-5 py-4 lg:hidden"
          >
            <nav className="flex flex-col gap-4 text-sm font-semibold text-[#4A4F5C]">
              <a href="#collection" onClick={() => setMobileMenuOpen(false)}>Shop collection</a>
              <a href="#our-story" onClick={() => setMobileMenuOpen(false)}>About this store</a>
              <a href="#store-guide" onClick={() => setMobileMenuOpen(false)}>Store guide</a>
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSellerContact();
                }}
              >
                <MessageCircle size={16} />
                Message seller
              </button>
            </nav>
          </motion.div>
          )}
        </AnimatePresence>
      </header>
      {cartNotice && (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-[5px] border border-[#3b372f] bg-[#1c1a17] px-4 py-3.5 text-sm font-semibold text-white shadow-xl">
          <span className="min-w-0 truncate">{cartNotice}</span>
          <button
            type="button"
            onClick={() => {
              setCartNotice("");
              setCheckoutOpen(true);
            }}
            className="shrink-0 underline underline-offset-4"
          >
            View bag
          </button>
        </div>
      )}
      <main>
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
          <div className="storefront-hero-frame overflow-hidden border-y border-[#E2DCCF] bg-[#FFFDF9]">
            <div className="relative grid items-center gap-8 px-5 py-9 sm:px-10 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-14 lg:py-14">
                <motion.div
                  className="storefront-hero-copy relative z-10"
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6F685D]">
                  <span className="h-px w-7 bg-[#D98A1F]" />
                  The shop of
                </div>
                <h1 className="mt-4 max-w-2xl break-words font-serif text-4xl font-medium leading-[1.05] tracking-tight text-[#1C1A17] sm:text-6xl">
                  {businessName}
                </h1>
                <p className="mt-5 max-w-lg text-sm leading-7 text-[#6F685D] sm:text-base sm:leading-8">
                  {businessDescription}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href="#collection"
                    className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[5px] bg-[#1C1A17] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#39342E]"
                  >
                    Browse products
                    <ArrowRight size={16} />
                  </a>
                  <Button
                    variant="secondary"
                    onClick={() => handleSellerContact()}
                    disabled={!contactAvailable}
                  >
                    <MessageCircle size={16} />
                    Talk to the seller
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-medium text-[#6F685D]">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck size={15} />
                    Direct seller contact
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Package size={15} />
                    Live product availability
                  </span>
                </div>
                </motion.div>
              <div className="storefront-preview relative mx-auto w-full max-w-md border-l border-[#E2DCCF] pl-4 sm:pl-6 lg:ml-auto">
                <div className="absolute -right-1 top-4 z-10 border border-[#E2DCCF] bg-[#FFFDF9] px-3 py-2 sm:right-1 sm:top-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#171B24]">
                    <span className="grid h-7 w-7 place-items-center rounded-[4px] bg-[#F1EDE4]">
                      <BadgeCheck size={15} />
                    </span>
                    Seller-listed products
                  </div>
                </div>
                <div className="overflow-hidden border border-[#E2DCCF] bg-[#FFFDF9] p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4A4F5C]">Inside the shop</div>
                      <div className="mt-1 font-serif text-lg font-semibold tracking-tight text-[#1C1A17]">A look inside</div>
                    </div>
                    <span className="border border-[#E2DCCF] px-2 py-1 text-[10px] font-semibold text-[#6F685D]">
                      {products.length} {products.length === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                  {featuredProducts.length ? (
                    <>
                      {featuredProducts.slice(0, 1).map((product) => (
                        <div key={product.id} className="overflow-hidden border border-[#E2DCCF] bg-white">
                          <button
                            type="button"
                            onClick={() => openProduct(product)}
                            aria-label={`View ${product.name}`}
                            className="group relative block aspect-[4/3] w-full overflow-hidden bg-[#F1EDE4]"
                          >
                            <span className="absolute inset-0 grid place-items-center text-[#4A4F5C]">
                              <ShoppingBag size={34} strokeWidth={1.4} />
                            </span>
                            {product.images?.[0] && (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                loading="lazy"
                                onError={(event) => { event.currentTarget.hidden = true; }}
                                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                              />
                            )}
                            <span className="absolute left-3 top-3 border border-[#E2DCCF] bg-[#FFFDF9] px-2 py-1 text-[10px] font-semibold text-[#1C1A17]">
                              {product.stock > 0 ? `${product.stock} in stock` : "Sold out"}
                            </span>
                          </button>
                          <div className="flex items-center justify-between gap-3 p-4">
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A8F99]">{product.tag}</div>
                              <div className="mt-1 truncate text-sm font-bold text-[#171B24]">{product.name}</div>
                            </div>
                            <div className="shrink-0 text-sm font-extrabold text-[#171B24]">{formatCurrency(product.price)}</div>
                          </div>
                        </div>
                      ))}
                      {featuredProducts.slice(1, 3).map((product) => (
                          <button
                          key={product.id}
                          type="button"
                          onClick={() => openProduct(product)}
                          className="mt-2 flex w-full items-center justify-between gap-3 border border-[#E2DCCF] bg-[#F7F4EE] px-4 py-3 text-left transition hover:bg-[#F1EDE4]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-[#171B24]">{product.name}</span>
                            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#4A4F5C]">{product.tag}</span>
                          </span>
                          <span className="shrink-0 text-xs font-extrabold text-[#171B24]">{formatCurrency(product.price)}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="grid min-h-48 place-items-center rounded-[22px] border border-dashed border-[#D8D2C6] bg-[#F1EDE4] px-6 text-center">
                      <div>
                        <ShoppingBag size={25} className="mx-auto text-[#4A4F5C]" />
                        <p className="mt-3 text-sm font-semibold text-[#171B24]">Take a look around</p>
                        <p className="mt-1 text-xs leading-5 text-[#4A4F5C]">Browse the collection below to see products and their current availability.</p>
                      </div>
                    </div>
                  )}
                  <a href="#collection" className="mt-3 flex items-center justify-between bg-[#1C1A17] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#39342E]">
                    Explore the collection
                    <ArrowRight size={15} />
                  </a>
                </div>
                <div className="absolute -bottom-4 -left-2 hidden border border-[#E2DCCF] bg-[#FFFDF9] px-3 py-2 sm:block">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#171B24]">
                    <span className="grid h-7 w-7 place-items-center rounded-[4px] bg-[#F1EDE4]">
                      <Heart size={14} />
                    </span>
                    Browse the seller's collection
                  </div>
                </div>
              </div>
            </div>
          </div>
          {!store.paymentQrUrl && (
            <div role="status" className="store-payment-notice mt-5 flex items-start gap-3 border px-4 py-3.5 text-sm leading-relaxed">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <p>This seller has not completed payment setup. Product browsing is available, but checkout is temporarily unavailable.</p>
            </div>
          )}
        </section>
        <section className="storefront-stats mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 pb-12 sm:grid-cols-4 sm:gap-4 sm:px-6 lg:px-8">
          {[
            { icon: ShoppingBag, value: products.length, label: "Listed products" },
            { icon: Package, value: products.filter((item) => item.stock > 0).length, label: "Available now" },
            { icon: Star, value: categories.length, label: "Categories" },
            { icon: MessageCircle, value: contactAvailable ? "Ready" : "Unavailable", label: "Seller contact" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="storefront-stat-card rounded-2xl border border-[#e8e9df] bg-white p-4 sm:rounded-[22px] sm:p-5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#F1EDE4] text-[#4A4F5C]">
                <Icon size={17} />
              </div>
              <div className="mt-4 text-xl font-extrabold tracking-tight text-[#171B24] sm:text-2xl">{value}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4A4F5C] sm:text-xs">{label}</div>
            </div>
          ))}
        </section>
        <section id="collection" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#4A4F5C]">
                <span className="h-px w-7 bg-[#E6E2D8]" />
                Made for discovering
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-[#171B24] sm:text-4xl">
                Shop the collection<span className="text-[#4A4F5C]">.</span>
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#4A4F5C]">
                Explore what {businessName} has available. Find a product, compare prices, and order directly from the seller.
              </p>
            </div>
            <div className="text-xs font-medium text-[#4A4F5C]">
              {filteredProducts.length} of {products.length} products
            </div>
          </div>
          <div className="storefront-collection-tools mt-7 rounded-[24px] border border-[#E6E2D8] bg-white p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-4 py-3 focus-within:border-[#171B24]">
                <Search size={17} className="shrink-0 text-[#4A4F5C]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by product, category or SKU"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#171B24] outline-none placeholder:text-[#9ba396]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="text-[#4A4F5C]">
                    <X size={15} />
                  </button>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto]">
                <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3">
                  <ArrowDownUp size={15} className="shrink-0 text-[#4A4F5C]" />
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-3 text-xs font-semibold text-[#4A4F5C] outline-none"
                    aria-label="Sort products"
                  >
                    <option value="featured">Featured first</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="name">Name: A to Z</option>
                    <option value="stock">Availability</option>
                  </select>
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-xs font-semibold text-[#4A4F5C]">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(event) => setInStockOnly(event.target.checked)}
                    className="accent-[#171B24]"
                  />
                  In stock
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {["All", ...categories].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategoryFilter(item)}
                  aria-pressed={categoryFilter === item}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition ${
                    categoryFilter === item
                      ? "bg-[#171B24] text-white"
                      : "border border-[#e5e8de] bg-white text-[#4A4F5C] hover:bg-[#F1EDE4]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-[#E6E2D8] bg-white px-5 py-16 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#F1EDE4] text-[#4A4F5C]">
                <Search size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#171B24]">
                  {products.length ? "No matching products" : "No products published yet"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#4A4F5C]">
                {products.length
                  ? "Try a different search or clear your filters to see more products."
                  : "This seller has not published any products yet."}
              </p>
              {(search || categoryFilter !== "All" || inStockOnly) && (
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("All");
                    setInStockOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  onAdd={addToCart}
                  onBuy={buyNow}
                  onToggleWishlist={toggleWishlist}
                  isWishlisted={wishlist.includes(product.id)}
                  contactAvailable={contactAvailable}
                  paymentReady={paymentReady}
                  onOpen={openProduct}
                />
              ))}
            </div>
          )}
        </section>
        <section className="border-y border-[#E6E2D8] bg-[#F1EDE4]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:gap-6 sm:px-6 sm:py-12 lg:px-8">
            {[
              {
                icon: ShieldCheck,
                title: "Know who you're buying from",
                description: "Browse a seller's published collection and contact them directly before ordering.",
              },
              {
                icon: MessageCircle,
                title: "A direct conversation",
                description: "Use WhatsApp to discuss your order with the seller when contact is configured.",
              },
              {
                icon: Truck,
                title: "Confirm delivery details",
                description: "Ask the seller about delivery timelines, availability, and any additional charges.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#4A4F5C] shadow-sm">
                  <Icon size={19} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#171B24]">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-[#4A4F5C]">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
          <div id="store-guide" className="scroll-mt-28 rounded-[28px] border border-[#E6E2D8] bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F1EDE4] text-[#4A4F5C]">
                <Bot size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4A4F5C]">Collection assistant</div>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-[#171B24]">Questions before you buy?</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#4A4F5C]">
              Get answers based on the information this seller has published.
            </p>
            <label className="mt-5 block text-xs font-bold text-[#4A4F5C]">
              Your question
              <input
                value={faqQuestion}
                onChange={(event) => setFaqQuestion(event.target.value)}
                placeholder="Ask about products, pricing or delivery"
                className="mt-2 w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-4 py-3 text-sm font-normal text-[#171B24] outline-none transition focus:border-[#171B24]"
              />
            </label>
            <div className="mt-4 rounded-2xl bg-[#F1EDE4] p-4">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4A4F5C]">
                <Sparkles size={13} />
                Store information
              </div>
              <p className="mt-3 text-sm leading-7 text-[#171B24]">{faqAnswer}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "What type of products do you sell?",
                "How much does it cost?",
                "How fast is delivery?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setFaqQuestion(prompt)}
                  className="rounded-full border border-[#E6E2D8] bg-white px-3 py-2 text-[10px] font-semibold text-[#4A4F5C] transition hover:bg-[#F1EDE4]"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[10px] leading-5 text-[#8A8F99]">
              This guide uses published store details and simple matching rules; it does not independently verify product claims.
            </p>
          </div>
          <div id="our-story" className="scroll-mt-28 flex flex-col justify-between overflow-hidden rounded-[28px] bg-[#0E1118] p-6 text-white sm:p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#DCE5FF]">
                <Leaf size={13} />
                About {businessName}
              </div>
              <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-4xl">
                Meet {businessName}.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#DCE5FF]">
                {businessDescription}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-[#F5F3ED]">
                <BadgeCheck size={15} />
                {category}
              </div>
            </div>
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#C8F169]">
                Have a question?
              </div>
              <p className="mt-2 text-sm leading-6 text-[#F5F3ED]">
                Contact the seller to confirm product details, stock, and delivery before placing an order.
              </p>
              <Button
                variant="light"
                className="mt-5"
                disabled={!contactAvailable}
                onClick={() => handleSellerContact()}
              >
                <MessageCircle size={16} />
                Message the seller
                <ArrowRight size={15} />
              </Button>
              {!contactAvailable && (
                <p className="mt-3 text-xs text-[#FDE68A]">
                  Seller contact has not been configured yet.
                </p>
              )}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] border border-[#E6E2D8] bg-[#F1EDE4] p-6 sm:flex-row sm:items-center sm:p-9">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#4A4F5C]">
                Found something you love?
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171B24] sm:text-3xl">
                Explore {businessName}.
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#4A4F5C]">
                Browse the collection or start a conversation with {businessName}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#collection" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#171B24] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0E1118]">
                Shop products
                <ArrowRight size={15} />
              </a>
              <Button variant="secondary" onClick={() => handleSellerContact()} disabled={!contactAvailable}>
                <MessageCircle size={15} />
                Contact seller
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e5e7dc] bg-[#F5F3ED]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-[#4A4F5C] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#171B24] text-white">
              <Leaf size={14} />
            </div>
            <span className="font-bold text-[#4A4F5C]">Powered by Supply Link</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>Store: {businessName}</span>
            <a href="#collection" className="font-semibold transition hover:text-[#171B24]">Back to collection ↑</a>
          </div>
        </div>
      </footer>
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[55] bg-[#171B24]/45 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProductId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[#E6E2D8] bg-[#F5F3ED] p-5 shadow-2xl sm:inset-y-8 sm:left-auto sm:right-8 sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4A4F5C]">
                  {selectedProduct.tag}
                </p>
                <h2 id="product-detail-title" className="mt-1 text-2xl font-bold tracking-tight text-[#171B24]">
                  {selectedProduct.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close product details"
                onClick={() => setSelectedProductId(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#E6E2D8] bg-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative mt-4 grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl bg-[#F1EDE4] text-[#4A4F5C]">
              <ShoppingBag size={36} strokeWidth={1.4} />
              {selectedProduct.images?.[0] && (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  onError={(event) => { event.currentTarget.hidden = true; }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
            <p className="mt-4 text-sm leading-6 text-[#4A4F5C]">
              {selectedProduct.description || "The seller has not added a detailed description yet."}
            </p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-extrabold text-[#171B24]">{formatCurrency(selectedProduct.price)}</p>
                <p className="mt-1 text-xs text-[#4A4F5C]">
                  {selectedProduct.stock > 0 ? `${selectedProduct.stock} in stock` : "Out of stock"}
                </p>
              </div>
              {selectedProduct.sku ? (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8F99]">SKU {selectedProduct.sku}</p>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#E6E2D8] bg-white px-4 py-3">
              <span className="text-sm font-semibold text-[#171B24]">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={selectedQuantity <= 1}
                  onClick={() => setRequestedProductQuantity(Math.max(1, selectedQuantity - 1))}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#E6E2D8] bg-[#F5F3ED] text-[#171B24] disabled:opacity-40"
                >
                  <Minus size={15} />
                </button>
                <output aria-live="polite" className="min-w-6 text-center text-sm font-bold text-[#171B24]">{selectedQuantity}</output>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={selectedQuantity >= selectedProduct.stock}
                  onClick={() => setRequestedProductQuantity(Math.min(selectedProduct.stock, selectedQuantity + 1))}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#E6E2D8] bg-[#F5F3ED] text-[#171B24] disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={selectedProduct.stock < 1}
                onClick={() => {
                  addToCart(selectedProduct, selectedQuantity);
                  setSelectedProductId(null);
                }}
              >
                Add to cart
              </Button>
              <Button
                disabled={selectedProduct.stock < 1 || !contactAvailable || !paymentReady}
                onClick={() => {
                  buyNow(selectedProduct, selectedQuantity);
                  setSelectedProductId(null);
                }}
              >
                Buy now
              </Button>
            </div>
          </section>
        </div>
      )}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[#0E1118]/45 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !placingOrder && !uploadingProof) {
              setCheckoutOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[28px] border border-[#E6E2D8] bg-[#F5F3ED] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-2xl sm:rounded-none sm:rounded-l-[28px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#E6E2D8] bg-white px-5 py-5 sm:px-7">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4A4F5C]">
                  Your shopping bag
                </div>
                <h2 id="cart-title" className="mt-1 text-2xl font-bold tracking-tight text-[#171B24]">
                  {orderCheckout ? "Your order" : "Review your bag"}
                  {!orderCheckout && <span className="ml-2 text-sm font-semibold text-[#4A4F5C]">({cartCount})</span>}
                </h2>
              </div>
              <button
                type="button"
                disabled={placingOrder || uploadingProof}
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close shopping bag"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#E6E2D8] bg-white text-[#4A4F5C] transition hover:bg-[#F1EDE4] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
              {orderCheckout ? (
                <div className="mx-auto max-w-xl space-y-5">
                  <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4A4F5C]">Order reference</div>
                        <div className="mt-1 text-base font-extrabold text-[#171B24]">{orderCheckout.reference}</div>
                      </div>
                      <span className="rounded-full bg-[#FEF3C7] px-3 py-1.5 text-[10px] font-bold text-[#B45309]">
                        {checkoutStage === "complete" ? "Proof submitted" : "Payment pending"}
                      </span>
                    </div>
                    <div className="mt-5 space-y-3 border-t border-[#E6E2D8] pt-4">
                      {orderCheckout.items.map((item) => (
                        <div key={item.productId || item.id} className="flex justify-between gap-3 text-sm">
                          <span className="text-[#677664]">{item.name} × {item.quantity}</span>
                          <span className="shrink-0 font-semibold text-[#171B24]">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between border-t border-[#E6E2D8] pt-4 font-extrabold text-[#171B24]">
                      <span>Amount to pay</span>
                      <span>{formatCurrency(orderCheckout.total)}</span>
                    </div>
                  </div>
                  {checkoutStage === "payment" ? (
                    <>
                      {store.paymentQrUrl ? (
                        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 text-center">
                          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#F1EDE4] text-[#4A4F5C]">
                            <ShieldCheck size={19} />
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-[#171B24]">Pay the seller using UPI</h3>
                          <p className="mt-2 text-sm leading-6 text-[#4A4F5C]">
                            Scan the QR code and pay exactly {formatCurrency(orderCheckout.total)}. Keep your payment receipt screenshot.
                          </p>
                          <img
                            src={store.paymentQrUrl}
                            alt={`${businessName} seller payment QR code`}
                            className="mx-auto mt-5 h-56 w-56 max-w-full rounded-xl border border-[#E6E2D8] bg-white object-contain p-2"
                          />
                          <a
                            href={store.paymentQrUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#171B24] underline underline-offset-4"
                          >
                            Open or save QR image
                            <ArrowRight size={14} />
                          </a>
                        </div>
                      ) : (
                        <div role="alert" className="rounded-2xl border border-[#F59E0B] bg-[#FFFBEB] p-4 text-sm leading-6 text-[#92400E]">
                          The seller's payment QR is no longer available. Contact the seller before making a payment.
                        </div>
                      )}
                      <form onSubmit={handlePaymentProofSubmit} className="rounded-2xl border border-[#E6E2D8] bg-white p-5">
                        <label className="block text-sm font-bold text-[#171B24]">
                          Payment screenshot
                          <input
                            required
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleProofFileChange}
                            className="mt-3 block w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F1EDE4] file:px-3 file:py-2 file:font-semibold file:text-[#171B24]"
                          />
                        </label>
                        {proofFile && (
                          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#EAF8D6] px-3 py-2 text-xs font-semibold text-[#4A4F5C]">
                            <Check size={15} />
                            {proofFile.name}
                          </div>
                        )}
                        <p className="mt-3 text-xs leading-5 text-[#4A4F5C]">
                          PNG or JPEG, up to 4 MB, at least 320 × 400 pixels. Only upload your actual payment receipt. The screenshot is not proof that funds were received.
                        </p>
                        <button
                          type="submit"
                          disabled={!proofFile || uploadingProof || !orderCheckout.proofToken}
                          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171B24] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0E1118] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {uploadingProof ? "Uploading securely..." : "Upload screenshot & open WhatsApp"}
                          {!uploadingProof && <ArrowRight size={16} />}
                        </button>
                        {!orderCheckout.proofToken && (
                          <p className="mt-3 text-xs leading-5 text-[#92400E]">
                            This order's upload token is unavailable. Contact the seller for next steps instead of creating a duplicate order.
                          </p>
                        )}
                      </form>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[#E6E2D8] bg-[#EAF8D6] p-5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#4A4F5C]">
                          <Check size={19} />
                        </div>
                        <div>
                          <h3 className="font-bold text-[#171B24]">Order handoff complete</h3>
                          <p className="mt-1 text-xs text-[#4A4F5C]">Payment still requires seller verification.</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#4A4F5C]">
                        {checkoutStatus?.message || "Your payment screenshot has been submitted."}
                      </p>
                      {orderCheckout.trackingUrl && (
                        <Link to={orderCheckout.trackingUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#171B24] underline underline-offset-4">
                          Track this order
                          <ArrowRight size={15} />
                        </Link>
                      )}
                      <Button className="mt-5 w-full" onClick={() => setCheckoutOpen(false)}>
                        Continue shopping
                      </Button>
                    </div>
                  )}
                  {checkoutStatus?.tone === "error" && (
                    <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
                      {checkoutStatus.message}
                    </p>
                  )}
                  <p className="text-xs leading-5 text-[#8A8F99]">
                    Stock reservation and payment-proof expiry are managed by the backend. Always verify payment in your own account before treating an order as paid.
                  </p>
                </div>
              ) : cart.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#E6E2D8] bg-white px-5 py-12 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F1EDE4] text-[#4A4F5C]">
                    <ShoppingBag size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[#171B24]">Your bag is taking a break.</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#4A4F5C]">
                    Find something you like in the collection and it will appear here.
                  </p>
                  <Button className="mt-5" onClick={() => setCheckoutOpen(false)}>
                    Explore products
                    <ArrowRight size={15} />
                  </Button>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#171B24]">Items in your bag</h3>
                      <span className="text-xs text-[#4A4F5C]">{cartCount} items</span>
                    </div>
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-[#E6E2D8] bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#171B24]">{item.name}</p>
                              <p className="mt-1 text-xs text-[#4A4F5C]">{formatCurrency(item.price)} each</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="shrink-0 text-xs font-semibold text-[#B91C1C] underline underline-offset-4"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-3 rounded-full border border-[#E6E2D8] bg-[#F5F3ED] p-1">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                aria-label={`Decrease quantity for ${item.name}`}
                                className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#4A4F5C] shadow-sm"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="min-w-4 text-center text-sm font-bold text-[#171B24]">{item.quantity}</span>
                              <button
                                type="button"
                                disabled={item.quantity >= item.stock}
                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                aria-label={`Increase quantity for ${item.name}`}
                                className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#4A4F5C] shadow-sm disabled:opacity-40"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <span className="text-sm font-extrabold text-[#171B24]">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <form onSubmit={handleCheckoutSubmit} className="rounded-[24px] border border-[#E6E2D8] bg-white p-4 sm:p-5">
                    <h3 className="text-base font-bold text-[#171B24]">Delivery details</h3>
                    <p className="mt-1 text-xs leading-5 text-[#4A4F5C]">
                      Enter your details so the seller can process your order.
                    </p>
                    <div className="mt-4 grid gap-3">
                      <input
                        required
                        autoComplete="name"
                        maxLength={100}
                        value={checkoutForm.name}
                        onChange={(event) => setCheckoutForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Full name"
                        className="w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                      />
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={20}
                        value={checkoutForm.phone}
                        onChange={(event) => setCheckoutForm((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="Phone number"
                        className="w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                      />
                      <input
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={checkoutForm.email}
                        onChange={(event) => setCheckoutForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="Email address (optional)"
                        className="w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                      />
                      <textarea
                        required
                        autoComplete="street-address"
                        maxLength={500}
                        value={checkoutForm.address}
                        onChange={(event) => setCheckoutForm((current) => ({ ...current, address: event.target.value }))}
                        placeholder="Full delivery address"
                        rows={3}
                        className="w-full resize-y rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          autoComplete="address-level2"
                          maxLength={100}
                          value={checkoutForm.city}
                          onChange={(event) => setCheckoutForm((current) => ({ ...current, city: event.target.value }))}
                          placeholder="City"
                          className="min-w-0 w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                        />
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="postal-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={checkoutForm.postalCode}
                          onChange={(event) => setCheckoutForm((current) => ({ ...current, postalCode: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                          placeholder="PIN code"
                          className="min-w-0 w-full rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                        />
                      </div>
                      <textarea
                        maxLength={500}
                        value={checkoutForm.notes}
                        onChange={(event) => setCheckoutForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Order notes (optional)"
                        rows={2}
                        className="w-full resize-y rounded-xl border border-[#E6E2D8] bg-[#F5F3ED] px-3 py-3 text-sm outline-none transition focus:border-[#171B24]"
                      />
                    </div>
                    <div className="mt-5 space-y-3 rounded-2xl bg-[#F5F3ED] p-4">
                      <div className="flex justify-between text-sm text-[#4A4F5C]">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-[#4A4F5C]">
                        <span>Shipping</span>
                        <span>{shippingFee === 0 ? "To be confirmed" : formatCurrency(shippingFee)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#E6E2D8] pt-3 text-base font-extrabold text-[#171B24]">
                        <span>Product total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                      <p className="text-[10px] leading-5 text-[#8A8F99]">
                        Delivery fees, if any, must be confirmed with the seller. The amount shown here covers the listed products only.
                      </p>
                    </div>
                    {checkoutStatus && (
                      <div className={`mt-4 rounded-xl border px-3 py-3 text-xs leading-5 ${
                        checkoutStatus.tone === "success"
                          ? "border-[#E6E2D8] bg-[#EAF8D6] text-[#4A4F5C]"
                          : "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                      }`}>
                        {checkoutStatus.message}
                        {checkoutStatus.trackingUrl && (
                          <Link to={checkoutStatus.trackingUrl} className="mt-2 block font-bold underline underline-offset-4">
                            Track this order
                          </Link>
                        )}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={placingOrder || !contactAvailable || !paymentReady}
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171B24] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0E1118] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {placingOrder ? "Saving your order..." : "Continue to payment"}
                      {!placingOrder && <ArrowRight size={16} />}
                    </button>
                    {(!contactAvailable || !paymentReady) && (
                      <p className="mt-3 text-xs leading-5 text-[#92400E]">
                        Checkout requires the seller's contact details, payment QR, and secure payment-proof storage to be configured.
                      </p>
                    )}
                  </form>
                </div>
              )}
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#E6E2D8] bg-white p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#4A4F5C]" />
                <p className="text-xs leading-5 text-[#4A4F5C]">
                  Supply Link helps submit the order and payment screenshot. It does not independently verify a transfer. Never share your UPI PIN or OTP, and confirm the final payment status with the seller.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
