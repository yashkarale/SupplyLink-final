import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildStoreContactUrl, fetchMarketplaceProductBySlug, fetchPublicStore, fetchRelatedMarketplaceProducts } from "../services/api";
import CustomerNav from "../components/marketplace/CustomerNav";
import CustomerFooter from "../components/marketplace/CustomerFooter";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function MarketplaceProduct() {
  const { slug, sellerSlug, productSlug } = useParams();
  const [product, setProduct] = useState(null);
  const [sellerContactUrl, setSellerContactUrl] = useState("");
  const [store, setStore] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadProduct = async () => {
      try {
        setLoading(true);
        const payload = await fetchMarketplaceProductBySlug(productSlug || slug, sellerSlug);
        if (!ignore) {
          setProduct(payload.product || null);
          setError("");
        }
        const seller = payload.product?.seller;
        if (seller?.storeSlug) {
          Promise.allSettled([
            fetchPublicStore(seller.storeSlug),
            fetchRelatedMarketplaceProducts(seller.storeSlug, payload.product.slug || productSlug || slug, 4),
          ]).then(([storeResult, relatedResult]) => {
            if (ignore) return;
            if (storeResult.status === "fulfilled") {
              setStore(storeResult.value);
              if (storeResult.value.contactAvailable && storeResult.value.contactUrl) {
                setSellerContactUrl(buildStoreContactUrl(storeResult.value.contactUrl, [], payload.product.name || ""));
              }
            } else setSellerContactUrl("");
            if (relatedResult.status === "fulfilled") setRelatedProducts(relatedResult.value.products || []);
          });
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "Unable to locate this product.");
          setProduct(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    if (productSlug || slug) {
      loadProduct();
    }

    return () => {
      ignore = true;
    };
  }, [productSlug, sellerSlug, slug]);

  if (loading) {
    return (
      <><CustomerNav /><main className="mx-auto max-w-6xl px-4 py-6">
        <div className="animate-pulse rounded-[20px] border border-line bg-[#fffdfb] p-6">
          <div className="h-4 w-32 rounded bg-[#efeae0]" />
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="h-[420px] rounded-[18px] bg-[#efeae0]" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded bg-[#efeae0]" />
              <div className="h-5 w-24 rounded bg-[#efeae0]" />
              <div className="h-6 w-36 rounded bg-[#efeae0]" />
              <div className="h-24 w-full rounded bg-[#efeae0]" />
            </div>
          </div>
        </div>
      </main><CustomerFooter /></>
    );
  }

  if (error || !product) {
    return (
      <><CustomerNav /><main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-[20px] border border-line bg-[#fffdfb] p-8 text-center">
          <p className="text-lg font-bold text-[#17151a]">Product unavailable</p>
          <p className="mt-2 text-sm text-[#5d584f]">{error || "This item is not publicly available right now."}</p>
          <Link to="/marketplace" className="mt-5 inline-flex items-center justify-center rounded-[12px] border border-line bg-[#f5f1ea] px-4 py-2 text-sm font-semibold text-[#17151a]">
            Return to marketplace
          </Link>
        </div>
      </main><CustomerFooter /></>
    );
  }

  const seller = product.seller || {};
  const imageList = Array.isArray(product.images) && product.images.length > 0 ? product.images : [""];

  return (
    <>
    <CustomerNav />
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/marketplace" className="inline-flex items-center justify-center rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold text-[#17151a]">
          ← Back to marketplace
        </Link>
      </div>

      <article className="rounded-[22px] border border-line bg-[#fffdfb] p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[18px] border border-line bg-[#f4efe8]">
              {imageList[0] ? (
                <img src={imageList[0]} alt={product.name} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-5xl text-[#7d756a]">{(product.name || "S").slice(0, 1).toUpperCase()}</div>
              )}
            </div>

            {imageList.length > 1 ? (
              <div className="grid grid-cols-3 gap-3">
                {imageList.slice(0, 3).map((image, index) => (
                  <div key={`${product.slug || product._id || index}-thumb`} className="overflow-hidden rounded-[12px] border border-line bg-[#f4efe8]">
                    <img src={image} alt={`${product.name} preview ${index + 1}`} className="aspect-[1/1] w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-line bg-[#f4efe8] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5d584f]">
                {product.category || "General"}
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${product.availability === "in_stock" ? "border-[#d9e9d8] bg-[#edf7ec] text-[#375c3c]" : product.availability === "out_of_stock" ? "border-[#e8d0d0] bg-[#fdf2f2] text-[#7a2d2d]" : "border-line bg-[#f5f1ea] text-[#5d584f]"}`}>
                {product.availability === "in_stock" ? "Listed as in stock" : product.availability === "out_of_stock" ? "Listed as sold out" : "Check with seller"}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#17151a]">{product.name}</h1>
            <div className="mt-4 text-3xl font-black tracking-tight text-[#17151a]">{formatCurrency(product.price)}</div>

            <div className="mt-5 rounded-[14px] border border-line bg-[#f7f4ee] p-4 text-sm text-[#5d584f]">
              <p className="font-semibold text-[#17151a]">Sold by {seller.businessName || "this seller"}</p>
              {(seller.locality || seller.city || seller.state) && <p className="mt-1 text-xs text-[#6f685d]">{[seller.locality, seller.city, seller.state].filter(Boolean).join(", ")}</p>}
              <p className="mt-2">Visit the storefront for more products and seller-managed pickup and delivery details. Final availability is checked when the seller receives your order.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={seller.storefrontUrl || "/marketplace"} className="inline-flex items-center justify-center rounded-[12px] border border-line bg-[#17151a] px-4 py-2 text-sm font-semibold text-[#fffdfb]">
                  Visit storefront
                </Link>
                {seller.storeSlug && product.availability !== "out_of_stock" && <Link to={`/store/${encodeURIComponent(seller.storeSlug)}?product=${encodeURIComponent(product.slug || product._id)}`} className="inline-flex items-center justify-center rounded-[12px] border border-line bg-[#f4efe8] px-4 py-2 text-sm font-semibold text-[#17151a]">Order from this shop</Link>}
                {sellerContactUrl && <a href={sellerContactUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-[12px] border border-line bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#17151a]">Contact seller on WhatsApp</a>}
                <Link to="/marketplace" className="inline-flex items-center justify-center rounded-[12px] border border-line bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#17151a]">
                  Continue browsing
                </Link>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f685d]">Description</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5d584f]">
                {product.description || "This seller has not added a detailed product description yet."}
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-[14px] border border-line bg-[#fffdfb] p-4 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-[#6f685d]">Category</dt><dd className="mt-1 font-medium text-[#17151a]">{product.category || "Not specified"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-[#6f685d]">Availability</dt><dd className="mt-1 font-medium text-[#17151a]">{product.availability === "in_stock" ? "Listed as in stock" : product.availability === "out_of_stock" ? "Listed as sold out" : "Check with seller"}</dd></div>
              {store?.pickupAvailable && <div><dt className="text-xs font-semibold uppercase tracking-wider text-[#6f685d]">Pickup</dt><dd className="mt-1 font-medium text-[#17151a]">Offered by seller; confirm pickup point</dd></div>}
              {store?.sellerDeliveryAvailable && <div><dt className="text-xs font-semibold uppercase tracking-wider text-[#6f685d]">Delivery</dt><dd className="mt-1 font-medium text-[#17151a]">Seller delivery; confirm terms</dd></div>}
            </dl>
          </div>
        </div>
      </article>
      {relatedProducts.length > 0 && <section className="mt-10" aria-labelledby="related-products"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f685d]">More from nearby shops</p><h2 id="related-products" className="mt-1 text-2xl font-black text-[#17151a]">Related products</h2></div><Link to="/marketplace" className="text-sm font-semibold underline underline-offset-4">Browse all</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{relatedProducts.map((item) => <Link key={`${item.seller?.storeSlug}-${item._id}`} to={`/marketplace/product/${encodeURIComponent(item.seller?.storeSlug || "")}/${encodeURIComponent(item.slug || item._id)}`} className="overflow-hidden rounded-[16px] border border-line bg-[#fffdfb] transition hover:border-[#c9bfaf]">{item.images?.[0] ? <img src={item.images[0]} alt={item.name} loading="lazy" className="aspect-[4/3] w-full object-cover"/> : <div className="grid aspect-[4/3] place-items-center bg-[#f3efe8] text-4xl text-[#7d756a]">{item.name?.slice(0, 1)}</div>}<div className="p-4"><p className="text-sm font-bold text-[#17151a]">{item.name}</p><p className="mt-1 text-xs text-[#6f685d]">{item.seller?.businessName}</p><p className="mt-3 font-bold text-[#17151a]">{formatCurrency(item.price)}</p></div></Link>)}</div></section>}
    </main>
    <CustomerFooter />
    </>
  );
}
