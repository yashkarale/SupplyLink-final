import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchMarketplaceCategories, fetchMarketplaceProducts, fetchMarketplaceSellers, fetchPopularMarketplaceProducts } from "../services/api";
import CustomerNav from "../components/marketplace/CustomerNav";
import CustomerFooter from "../components/marketplace/CustomerFooter";
import useMarketplaceLocation from "../hooks/useMarketplaceLocation";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [collectionError, setCollectionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [sellerError, setSellerError] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [location, setLocation] = useMarketplaceLocation();
  const [sort, setSort] = useState("newest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setPage(1);
  }, [searchParams]);

  const categories = useMemo(() => ["All", ...categoryOptions], [categoryOptions]);

  useEffect(() => {
    let ignore = false;
    fetchMarketplaceCategories(location || {})
      .then((payload) => {
        if (!ignore) setCategoryOptions((payload.data || []).map((item) => item.category).filter(Boolean));
      })
      .catch(() => {
        if (!ignore) setCategoryOptions([]);
      });
    return () => { ignore = true; };
  }, [location, reloadKey]);

  useEffect(() => {
    let ignore = false;
    setPopularLoading(true);
    Promise.all([
      fetchPopularMarketplaceProducts(6, location || {}),
      fetchMarketplaceProducts(1, 6, { ...(location || {}), sort: "newest" }),
    ]).then(([popular, recent]) => {
      if (ignore) return;
      setPopularProducts(popular.products || []);
      setRecentProducts(recent.products || []);
      setCollectionError("");
    }).catch((loadError) => {
      if (ignore) return;
      setPopularProducts([]);
      setRecentProducts([]);
      setCollectionError(loadError.message || "Some product collections could not be loaded.");
    }).finally(() => { if (!ignore) setPopularLoading(false); });
    return () => { ignore = true; };
  }, [location, reloadKey]);

  useEffect(() => {
    let ignore = false;

    const loadMarketplace = async () => {
      try {
        setLoading(true);
        const payload = await fetchMarketplaceProducts(page, 12, {
          ...(location || {}),
          search: search.trim(),
          category: category !== "All" ? category : "",
          minPrice,
          maxPrice,
          inStock: inStockOnly ? 1 : 0,
          sort,
        });

        if (!ignore) {
          setProducts(payload.products || []);
          setPagination(payload.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
          setError("");
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "Unable to load the marketplace.");
          setProducts([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadMarketplace();
    return () => {
      ignore = true;
    };
  }, [search, category, sort, inStockOnly, minPrice, maxPrice, page, location, reloadKey]);

  useEffect(() => {
    let ignore = false;

    const loadSellers = async () => {
      try {
        setSellerLoading(true);
        const payload = await fetchMarketplaceSellers(1, 6, location || {});
        if (!ignore) {
          setSellers(payload.sellers || []);
          setSellerError("");
        }
      } catch (loadError) {
        if (!ignore) {
          setSellers([]);
          setSellerError(loadError.message || "Unable to load nearby shops.");
        }
      } finally {
        if (!ignore) setSellerLoading(false);
      }
    };

    loadSellers();
    return () => {
      ignore = true;
    };
  }, [location, reloadKey]);

  return (
    <>
    <CustomerNav locationLabel={location ? [location.locality, location.city, location.state, location.country].filter(Boolean).join(", ") : "Choose a location"} />
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[18px] border border-line bg-[linear-gradient(135deg,#f8f5f0,#f3efe8)] p-6 shadow-[0_8px_24px_rgba(17,16,12,0.03)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f685d]">Supply Link marketplace</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#17151a] sm:text-5xl">Good things, from shops around you.</h1>
            <p className="mt-3 text-sm leading-6 text-[#5d584f] sm:text-base">
              Find products from independent local businesses, explore their shops, and order directly from the seller.
            </p>
          </div>
            <Link to="/sell" className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-line bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#17151a] transition hover:border-[#d7d0c3] hover:bg-[#f5f1ea]">
            Start selling
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1.5fr_auto] lg:grid-cols-[1.5fr_0.7fr_0.7fr]">
          <label className="flex items-center rounded-[14px] border border-line bg-[#fffdfb] px-3 py-2 shadow-sm">
            <span className="mr-2 text-sm text-[#6f685d]">Search</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search products, makers, or categories"
              className="w-full border-0 bg-transparent text-sm text-[#17151a] outline-none placeholder:text-[#8b8276]"
            />
          </label>

          <button type="button" onClick={() => navigate(`/shops${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`)} className="rounded-[14px] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold text-[#17151a] hover:bg-[#f5f1ea]">Search shops</button>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="rounded-[14px] border border-line bg-[#fffdfb] px-3 py-2 text-sm text-[#17151a] outline-none"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to high</option>
            <option value="price_desc">Price: High to low</option>
            <option value="relevance">Relevance</option>
          </select>

          <label className="flex items-center justify-between rounded-[14px] border border-line bg-[#fffdfb] px-3 py-2 text-sm text-[#17151a]">
            <span>In stock only</span>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => {
                setInStockOnly(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-[#17151a]"
            />
          </label>
        </div>

        <div id="categories" className="mt-4 flex flex-wrap gap-2 scroll-mt-20">
          {categories.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setCategory(option);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${category === option ? "border-[#17151a] bg-[#17151a] text-[#fffdfb]" : "border-line bg-[#fffdfb] text-[#17151a]"}`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm text-[#17151a]">
            <span>Min</span>
            <input type="number" min="0" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} placeholder="₹0" className="w-full bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm text-[#17151a]">
            <span>Max</span>
            <input type="number" min="0" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} placeholder="₹5000" className="w-full bg-transparent outline-none" />
          </label>
        </div>
      </section>

      <ProductCollection title="Popular products" description="Most ordered items from completed customer orders." products={popularProducts} loading={popularLoading} unavailable={Boolean(collectionError)} empty="Popular items will appear after customers complete orders." />
      {collectionError && !error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#d7a3a3] bg-[#fdf2f2] p-4 text-sm text-[#7a2d2d]"><span>Product collections could not be loaded. {collectionError}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="font-semibold underline underline-offset-2">Retry</button></div>}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#d7a3a3] bg-[#fdf2f2] p-4 text-sm font-medium text-[#7a2d2d]">
          <span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="font-semibold underline underline-offset-2">Retry</button>
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#17151a]">{location ? `Shops near ${[location.locality, location.city].filter(Boolean).join(", ") || location.state || location.country}` : "Shops to explore"}</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f685d]">Public storefronts</span>
        </div>

        {sellerError ? (
          error || collectionError ? null : <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#d7a3a3] bg-[#fdf2f2] p-4 text-sm text-[#7a2d2d]"><span>Nearby shops could not be loaded. {sellerError}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="font-semibold underline underline-offset-2">Retry</button></div>
        ) : sellerLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-[16px] border border-line bg-[#fffdfb] p-4">
                <div className="h-4 w-28 rounded bg-[#efeae0]" />
                <div className="mt-4 h-6 w-40 rounded bg-[#efeae0]" />
                <div className="mt-3 h-4 w-20 rounded bg-[#efeae0]" />
              </div>
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <div className="rounded-[16px] border border-line bg-[#fffdfb] p-5 text-sm text-[#5d584f]">
            No public sellers are available right now.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sellers.map((seller) => (
              <Link key={seller.id || seller.storeSlug} to={seller.storefrontUrl || "/marketplace"} className="rounded-[16px] border border-line bg-[#fffdfb] p-5 transition hover:border-[#d7d0c3] hover:bg-[#f8f4ef]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f685d]">{seller.category || "General"}</p>
                <h3 className="mt-3 text-lg font-bold text-[#17151a]">{seller.businessName}</h3>
                <p className="mt-1 text-xs font-medium text-[#6f685d]">{[seller.locality, seller.city, seller.state].filter(Boolean).join(", ")}</p>
                <p className="mt-2 text-sm leading-6 text-[#5d584f]">{seller.description || "This seller is currently showcasing their public storefront."}</p>
                <div className="mt-4 inline-flex items-center rounded-full border border-line bg-[#f4efe8] px-2.5 py-1 text-xs font-semibold text-[#17151a]">
                  Visit storefront
                </div>
              </Link>
            ))}
          </div>
        )}
        <Link to="/shops" className="mt-4 inline-flex text-sm font-semibold text-[#17151a] underline underline-offset-4">Search and browse all shops</Link>
      </section>

      <section id="products" className="scroll-mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#17151a]">Product catalogue</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f685d]">{pagination.total} listings</span>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-[18px] border border-line bg-[#fffdfb] p-4">
                <div className="h-52 rounded-[12px] bg-[#efeae0]" />
                <div className="mt-4 h-4 w-24 rounded bg-[#efeae0]" />
                <div className="mt-3 h-6 w-3/4 rounded bg-[#efeae0]" />
                <div className="mt-3 h-4 w-1/3 rounded bg-[#efeae0]" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-[18px] border border-line bg-[#fffdfb] p-8 text-center text-sm text-[#5d584f]">
            No products match these filters. Try another location, search term, or category.
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product._id || product.slug} product={product} />
              ))}
            </div>

            {pagination.totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold text-[#17151a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-[#5d584f]">Page {page} of {pagination.totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold text-[#17151a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ProductCollection title="Recently added" description="Newly published products from active local shops." products={recentProducts} loading={popularLoading} unavailable={Boolean(collectionError)} empty="No new products are listed for this location yet." />
    </main>
    <CustomerFooter />
    </>
  );
}

function ProductCollection({ title, description, products, loading, unavailable, empty }) {
  return (
    <section aria-labelledby={`collection-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id={`collection-${title.toLowerCase().replace(/\s+/g, "-")}`} className="text-xl font-black text-[#17151a]">{title}</h2><p className="mt-1 text-sm text-[#6f685d]">{description}</p></div>
        <Link to="/marketplace#products" className="text-sm font-semibold text-[#17151a] underline underline-offset-4">Browse products</Link>
      </div>
      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-[16px] border border-line bg-[#efeae0]" />)}</div>
        : products.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.slice(0, 3).map((product) => <ProductCard key={`${product.seller?.storeSlug}-${product._id}`} product={product} />)}</div>
          : unavailable ? null
          : <div className="rounded-[16px] border border-line bg-[#fffdfb] p-5 text-sm text-[#6f685d]">{empty}</div>}
    </section>
  );
}

function ProductCard({ product }) {
  const image = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : "";
  const seller = product.seller || {};

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[18px] border border-line bg-[#fffdfb]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f3efe8]">
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-[#7d756a]">{(product.name || "S").slice(0, 1).toUpperCase()}</div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-line bg-[#f4efe8] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5d584f]">
            {product.category || "General"}
          </span>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${product.availability === "in_stock" ? "border-[#d9e9d8] bg-[#edf7ec] text-[#375c3c]" : product.availability === "out_of_stock" ? "border-[#e8d0d0] bg-[#fdf2f2] text-[#7a2d2d]" : "border-line bg-[#f5f1ea] text-[#5d584f]"}`}>
            {product.availability === "in_stock" ? "Listed as in stock" : product.availability === "out_of_stock" ? "Listed as sold out" : "Check with seller"}
          </span>
        </div>

        <h3 className="mt-4 text-lg font-bold text-[#17151a]">{product.name}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5d584f]">{product.description || "No product description is available yet."}</p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-tight text-[#17151a]">{formatCurrency(product.price)}</div>
            {Number(product.compareAtPrice || 0) > Number(product.price || 0) ? (
              <div className="text-xs text-[#7d756a] line-through">{formatCurrency(product.compareAtPrice)}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-3 text-sm text-[#5d584f]">
          Sold by <Link to={seller.storefrontUrl || "/marketplace"} className="font-semibold text-[#17151a] underline-offset-2 hover:underline">{seller.businessName || "Independent seller"}</Link>
          {(seller.locality || seller.city || seller.state) && <p className="mt-1 text-xs text-[#6f685d]">{[seller.locality, seller.city, seller.state].filter(Boolean).join(", ")}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <Link to={product.seller?.storeSlug ? `/marketplace/product/${encodeURIComponent(product.seller.storeSlug)}/${encodeURIComponent(product.slug || product._id)}` : `/marketplace/product/${encodeURIComponent(product.slug || product._id)}`} className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-control)] border border-line bg-[#f5f1ea] px-3 py-2 text-sm font-semibold text-[#17151a] transition hover:border-[#d7d0c3] hover:bg-[#efe8df]">
            View product
          </Link>
          <Link to={seller.storefrontUrl || "/marketplace"} className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-control)] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold text-[#17151a] transition hover:border-[#d7d0c3] hover:bg-[#f5f1ea]">
            Storefront
          </Link>
        </div>
      </div>
    </article>
  );
}
