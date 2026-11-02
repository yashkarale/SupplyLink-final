import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchMarketplaceCategories, fetchMarketplaceSellers } from "../services/api";
import LocationPicker from "../components/marketplace/LocationPicker";
import CustomerNav from "../components/marketplace/CustomerNav";
import CustomerFooter from "../components/marketplace/CustomerFooter";
import useMarketplaceLocation from "../hooks/useMarketplaceLocation";

export default function ShopDiscovery() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [location, setLocation] = useMarketplaceLocation();
  const [sort, setSort] = useState("newest");
  const [category, setCategory] = useState("All");
  const [categories, setCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo(() => ({
    ...(location || {}),
    search: search.trim(),
    category: category === "All" ? "" : category,
    sort,
  }), [location, search, category, sort]);

  useEffect(() => {
    let active = true;
    fetchMarketplaceCategories(location || {})
      .then((payload) => { if (active) setCategories((payload.data || []).map((item) => item.category).filter(Boolean)); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [location]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMarketplaceSellers(page, 12, filters)
      .then((payload) => {
        if (!active) return;
        setShops(payload.sellers || []);
        setPagination(payload.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
        setError("");
      })
      .catch((loadError) => {
        if (!active) return;
        setShops([]);
        setError(loadError.message || "Unable to load shops right now.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);

  const categoryOptions = ["All", ...categories];

  return (
    <>
    <CustomerNav locationLabel={location ? [location.locality, location.city, location.state, location.country].filter(Boolean).join(", ") : "Choose a location"} />
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[18px] border border-line bg-[linear-gradient(135deg,#f8f5f0,#f3efe8)] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f685d]">Independent local businesses</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#17151a] sm:text-4xl">Find a shop near you</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5d584f]">Search published storefronts by business name, category, city, or locality. Open a shop to explore its own catalogue and contact the seller.</p>
          </div>
          <Link to="/marketplace" className="rounded-[var(--radius-control)] border border-line bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#17151a]">Browse products</Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="flex min-h-11 items-center rounded-[14px] border border-line bg-[#fffdfb] px-3 shadow-sm">
            <span className="mr-2 text-sm text-[#6f685d]">Shop</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search shop names" className="w-full bg-transparent py-2 text-sm text-[#17151a] outline-none placeholder:text-[#8b8276]" />
          </label>
          <LocationPicker value={location} onChange={(next) => { setLocation(next); setPage(1); }} />
          <label className="flex min-h-11 items-center gap-2 rounded-[14px] border border-line bg-[#fffdfb] px-3 text-sm text-[#5d584f]">
            <span>Sort</span>
            <select aria-label="Sort shops" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="bg-transparent py-2 font-semibold text-[#17151a] outline-none">
              <option value="newest">Recently added</option>
              <option value="name">Shop name</option>
              <option value="category">Category</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <button key={option} type="button" onClick={() => { setCategory(option); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${category === option ? "border-[#17151a] bg-[#17151a] text-[#fffdfb]" : "border-line bg-[#fffdfb] text-[#17151a]"}`}>
              {option}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#17151a]">Public storefronts</h2>
          {!loading && <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6f685d]">{pagination.total} shops</span>}
        </div>
        {error && <div role="alert" className="mb-4 rounded-[14px] border border-[#d7a3a3] bg-[#fdf2f2] p-4 text-sm text-[#7a2d2d]">{error}</div>}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="animate-pulse rounded-[16px] border border-line bg-[#fffdfb] p-5"><div className="h-3 w-24 rounded bg-[#efeae0]"/><div className="mt-4 h-6 w-40 rounded bg-[#efeae0]"/><div className="mt-3 h-4 w-full rounded bg-[#efeae0]"/></div>)}</div>
        ) : shops.length === 0 ? (
          <div className="rounded-[16px] border border-line bg-[#fffdfb] p-8 text-center text-sm text-[#5d584f]">No public shops match these filters. Try a different location, category, or search.</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <Link key={shop.id || shop.storeSlug} to={shop.storefrontUrl || `/store/${encodeURIComponent(shop.storeSlug)}`} className="group rounded-[16px] border border-line bg-[#fffdfb] p-5 transition hover:border-[#c9bfaf] hover:bg-[#f8f4ef]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f685d]">{shop.category || "Independent shop"}</p>
                  <h3 className="mt-3 text-xl font-bold text-[#17151a] group-hover:underline">{shop.businessName}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5d584f]">{shop.description || "Browse this seller’s public storefront and contact them directly."}</p>
                  <p className="mt-4 text-xs font-medium text-[#6f685d]">{[shop.locality, shop.city, shop.state, shop.country].filter(Boolean).join(", ") || "Location not provided"}</p>
                  {(shop.pickupAvailable || shop.sellerDeliveryAvailable) && <div className="mt-3 flex flex-wrap gap-2">{shop.pickupAvailable && <span className="rounded-full border border-line bg-[#f4efe8] px-2 py-1 text-[10px] font-semibold text-[#514b43]">Pickup available</span>}{shop.sellerDeliveryAvailable && <span className="rounded-full border border-line bg-[#f4efe8] px-2 py-1 text-[10px] font-semibold text-[#514b43]">Seller delivery</span>}</div>}
                  {formatOpeningHours(shop.openingHours) && <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#6f685d]">{formatOpeningHours(shop.openingHours)}</p>}
                  <span className="mt-5 inline-flex rounded-full border border-line bg-[#f4efe8] px-3 py-1.5 text-xs font-semibold text-[#17151a]">Visit storefront</span>
                </Link>
              ))}
            </div>
            {pagination.totalPages > 1 && <div className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold disabled:opacity-50">Previous</button><span className="text-sm text-[#5d584f]">Page {page} of {pagination.totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages} className="rounded-[12px] border border-line bg-[#fffdfb] px-3 py-2 text-sm font-semibold disabled:opacity-50">Next</button></div>}
          </>
        )}
      </section>
    </main>
    <CustomerFooter />
    </>
  );
}

function formatOpeningHours(hours = []) {
  if (!Array.isArray(hours)) return "";
  return hours.filter((entry) => entry.isClosed || entry.intervals?.length)
    .map((entry) => `${entry.day}: ${entry.isClosed ? "Closed" : entry.intervals.map(({ open, close }) => `${open}–${close}`).join(", ")}`)
    .join(" · ");
}
