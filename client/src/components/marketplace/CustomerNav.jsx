import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import LocationPicker from "./LocationPicker";
import useMarketplaceLocation from "../../hooks/useMarketplaceLocation";

const navClass = ({ isActive }) => `rounded-full px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-[#17151a] text-[#fffdfb]" : "text-[#514b43] hover:bg-[#f2ede5]"}`;

export default function CustomerNav() {
  const [location, setLocation] = useMarketplaceLocation();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(`/marketplace${query ? `?search=${encodeURIComponent(query)}` : ""}#products`);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#fffdfb]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex w-full items-center justify-between gap-3 md:w-auto">
          <Link to="/marketplace" className="flex shrink-0 items-center gap-2.5 text-[#17151a]" aria-label="Supply Link marketplace home">
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[5px] bg-[#1c1a17] font-[Fraunces] text-lg font-semibold text-[#fffdfb]">S</span>
            <span><span className="block font-[Fraunces] text-xl font-semibold leading-none tracking-tight">Supply Link</span><span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#6f685d]">Local marketplace</span></span>
          </Link>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-[8px] border border-line bg-[#fffdfb] text-[#17151a] md:hidden" aria-label={menuOpen ? "Close buyer navigation" : "Open buyer navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <form onSubmit={submitSearch} role="search" className="order-3 flex min-w-0 w-full items-center gap-2 rounded-[12px] border border-line bg-[#f8f5f0] px-3 md:order-none md:ml-3 md:w-auto md:min-w-[220px] md:flex-1 md:max-w-md">
          <Search size={16} className="shrink-0 text-[#6f685d]" aria-hidden="true" />
          <label className="sr-only" htmlFor="buyer-global-search">Search products</label>
          <input id="buyer-global-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[#17151a] outline-none placeholder:text-[#8b8276]" />
          <button type="submit" className="rounded-[8px] bg-[#1c1a17] px-2.5 py-1.5 text-xs font-semibold text-white">Search</button>
        </form>

        <div className="order-4 min-w-0 w-full md:order-none md:w-[230px]">
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        <nav aria-label="Buyer navigation" className="ml-auto hidden items-center gap-1 md:flex">
          <NavLink to="/marketplace" end className={navClass}>Discover</NavLink>
          <Link to="/marketplace#products" className="rounded-full px-3 py-2 text-sm font-semibold text-[#514b43] transition hover:bg-[#f2ede5]">Products</Link>
          <NavLink to="/shops" className={navClass}>Shops</NavLink>
          <Link to="/marketplace#categories" className="rounded-full px-3 py-2 text-sm font-semibold text-[#514b43] transition hover:bg-[#f2ede5]">Categories</Link>
        </nav>

        <Link to="/sell" className="order-2 ml-auto hidden shrink-0 rounded-full border border-line bg-[#fffdfb] px-3 py-2 text-xs font-semibold text-[#17151a] hover:bg-[#f5f1ea] md:order-none md:ml-0 md:inline-flex">For sellers</Link>

        {menuOpen && <nav aria-label="Mobile buyer navigation" className="order-5 grid w-full grid-cols-2 gap-2 border-t border-line pt-3 md:hidden">
          <NavLink to="/marketplace" end className={navClass} onClick={() => setMenuOpen(false)}>Discover</NavLink>
          <Link to="/marketplace#products" className="rounded-full px-3 py-2 text-sm font-semibold text-[#514b43] hover:bg-[#f2ede5]" onClick={() => setMenuOpen(false)}>Products</Link>
          <NavLink to="/shops" className={navClass} onClick={() => setMenuOpen(false)}>Shops</NavLink>
          <Link to="/marketplace#categories" className="rounded-full px-3 py-2 text-sm font-semibold text-[#514b43] hover:bg-[#f2ede5]" onClick={() => setMenuOpen(false)}>Categories</Link>
          <Link to="/sell" className="col-span-2 rounded-full border border-line px-3 py-2 text-center text-sm font-semibold text-[#17151a]" onClick={() => setMenuOpen(false)}>For sellers</Link>
        </nav>}
      </div>
    </header>
  );
}
