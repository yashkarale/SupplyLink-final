import { useEffect, useState } from "react";

const STORAGE_KEY = "supplylink-marketplace-location";

const readLocation = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return value && typeof value === "object" && value.city ? value : null;
  } catch {
    return null;
  }
};

export default function useMarketplaceLocation() {
  const [location, setLocationState] = useState(readLocation);
  useEffect(() => {
    const syncLocation = (event) => setLocationState(event.detail ?? readLocation());
    const syncStorage = (event) => {
      if (event.key === STORAGE_KEY) setLocationState(readLocation());
    };
    window.addEventListener("supplylink:marketplace-location", syncLocation);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("supplylink:marketplace-location", syncLocation);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const setLocation = (next) => {
    setLocationState(next || null);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Browsing still works if storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent("supplylink:marketplace-location", { detail: next || null }));
  };
  return [location, setLocation];
}
