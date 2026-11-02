import { useEffect, useId, useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { fetchMarketplaceLocalities } from "../../services/api";

const locationLabel = (location) => [location?.locality, location?.city, location?.state, location?.country]
  .filter(Boolean)
  .join(", ");

const cityKey = (location) => [location.country, location.state, location.city].map((part) => part || "").join("|");
const localityKey = (location) => `${cityKey(location)}|${location.locality || ""}|${location.area || ""}`;

export default function LocationPicker({ value = null, onChange = () => {} }) {
  const inputId = useId();
  const [query, setQuery] = useState(locationLabel(value));
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(locationLabel(value));
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await fetchMarketplaceLocalities({ search: query.trim(), limit: 24 });
        if (active) setSuggestions(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, query.trim() ? 220 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const cities = useMemo(() => {
    const unique = new Map();
    for (const item of suggestions) {
      const key = cityKey(item);
      if (!unique.has(key) && item.city) unique.set(key, item);
    }
    return [...unique.values()];
  }, [suggestions]);

  const choose = (item, includeLocality = true) => {
    const next = {
      country: item.country || "",
      state: item.state || "",
      city: item.city || "",
      locality: includeLocality ? item.locality || "" : "",
    };
    onChange(next);
    setQuery(locationLabel(next));
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <label htmlFor={inputId} className="sr-only">Choose a city or locality</label>
      <div className="flex min-h-11 items-center gap-2 rounded-[14px] border border-line bg-[#fffdfb] px-3 shadow-sm">
        <MapPin size={16} className="shrink-0 text-[#6f685d]" aria-hidden="true" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-options`}
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="Choose city or locality"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#17151a] outline-none placeholder:text-[#8b8276]"
        />
        {value && <button type="button" onClick={clear} aria-label="Clear selected location" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#6f685d] hover:bg-[#f4efe8]"><X size={15} /></button>}
      </div>
      {open && (
        <div id={`${inputId}-options`} role="listbox" aria-label="Available seller locations" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-[14px] border border-line bg-[#fffdfb] p-2 shadow-xl">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f685d]">
            {query.trim() ? "Matching seller locations" : "Available seller locations"}
          </p>
          {loading ? <p className="px-3 py-3 text-sm text-[#6f685d]">Finding locations…</p> : suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[#6f685d]">No seller locations match. Clear the field to browse all locations.</p>
          ) : (
            <>
              {cities.map((item) => (
                <button key={`city-${cityKey(item)}`} type="button" role="option" aria-selected={false} onClick={() => choose(item, false)} className="block w-full rounded-[9px] px-3 py-2 text-left text-sm font-semibold text-[#17151a] hover:bg-[#f4efe8]">
                  All localities in {[item.city, item.state, item.country].filter(Boolean).join(", ")}
                </button>
              ))}
              {suggestions.filter((item) => item.locality).map((item) => (
                <button key={`locality-${localityKey(item)}`} type="button" role="option" aria-selected={false} onClick={() => choose(item, true)} className="block w-full rounded-[9px] px-3 py-2 text-left text-sm text-[#5d584f] hover:bg-[#f4efe8]">
                  {[item.locality, item.city, item.state, item.country].filter(Boolean).join(", ")}
                </button>
              ))}
            </>
          )}
          {value && <button type="button" onClick={clear} className="mt-1 w-full rounded-[9px] px-3 py-2 text-left text-xs font-semibold text-[#6f685d] hover:bg-[#f4efe8]">Browse all locations</button>}
        </div>
      )}
      {value && <p className="mt-1 truncate px-1 text-[10px] text-[#6f685d]">Showing results near {locationLabel(value)}</p>}
    </div>
  );
}
