
import { Bell, ChevronDown, Menu, MoonStar, Search, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

const liveFeedSeed = [
  { id: 1, title: "Store published", message: "Your storefront is live and ready for shoppers.", tone: "success" },
  { id: 2, title: "Stock monitor", message: "3 products need replenishment this week.", tone: "warning" },
  { id: 3, title: "AI update", message: "Demand trend is up 18% for your top sellers.", tone: "info" },
  { id: 4, title: "New order", message: "A customer placed an order in the last 2 minutes.", tone: "success" },
];

const liveUpdates = [
  { title: "New order", message: "A customer just placed a premium order from your store.", tone: "success" },
  { title: "Inventory alert", message: "Low stock on your top-selling tote collection.", tone: "warning" },
  { title: "AI demand pulse", message: "Demand for cotton essentials is trending above plan.", tone: "info" },
  { title: "Store activity", message: "Two new visitors checked out your storefront today.", tone: "success" },
];

export default function AppHeader({ onMenuClick, theme, onToggleTheme }) {
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(liveFeedSeed);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail;
      if (!detail) return;

      setNotifications((previous) => [{ ...detail, id: Date.now() + Math.random() }, ...previous].slice(0, 5));
      setPanelOpen(true);
    };

    const interval = setInterval(() => {
      const item = liveUpdates[Math.floor(Math.random() * liveUpdates.length)];
      setNotifications((previous) => [{ ...item, id: Date.now() + Math.random() }, ...previous].slice(0, 5));
    }, 12000);

    window.addEventListener("supplylink:notify", handler);
    return () => {
      window.removeEventListener("supplylink:notify", handler);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className={`app-header ${theme === "dark" ? "app-header-dark" : "app-header-light"} sticky top-0 z-30 flex h-[76px] items-center justify-between gap-3 px-4 backdrop-blur-xl sm:px-6 lg:px-9`}>
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuClick} className="rounded-xl p-2 hover:opacity-90 lg:hidden"><Menu size={21} /></button>
        <div className={`hidden items-center gap-2 rounded-xl border px-3 py-2 sm:flex sm:w-[250px] lg:w-[300px] ${theme === "dark" ? "border-[#2a3d2f] bg-[#13241a]" : "border-[#e9ede7] bg-[#fafbf9]"}`}>
          <Search size={16} className="shrink-0 text-[#99a39a]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your workspace..." className={`w-full bg-transparent text-xs outline-none placeholder:text-[#a3aca4] ${theme === "dark" ? "text-white" : "text-[#1a2720]"}`} />
          <kbd className={`hidden rounded border px-1.5 py-0.5 text-[10px] md:inline ${theme === "dark" ? "border-[#2f4236] text-[#b5c3b7]" : "border-[#e4e9e2] text-[#9aa49b]"}`}>⌘ K</kbd>
        </div>
        <p className="truncate text-xs text-[#9aa49b] sm:hidden">Seller workspace</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${theme === "dark" ? "border-[#2a3d2f] bg-[#11261a] text-[#d7f0de]" : "border-[#e9ede7] bg-[#f9fbf9] text-[#4b5e52]"}`}
        >
          {theme === "dark" ? <SunMedium size={18} /> : <MoonStar size={18} />}
        </button>

        <div className="hidden text-right sm:block">
          <p className={`text-xs font-semibold ${theme === "dark" ? "text-[#eaf4eb]" : "text-[#26372b]"}`}>My Store</p>
          <p className={`mt-0.5 text-[10px] ${theme === "dark" ? "text-[#9aa89f]" : "text-[#929d93]"}`}>Launch plan</p>
        </div>

        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => setPanelOpen((open) => !open)}
            className={`relative rounded-xl border p-2.5 shadow-sm transition hover:-translate-y-0.5 ${theme === "dark" ? "border-[#2a3d2f] bg-[#122a1d] text-[#dcefe2]" : "border-[#e9ede7] bg-[#f9fbf9] text-[#718074]"}`}
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e39c42] ring-2 ring-white" />
          </button>

          {panelOpen && (
            <div className={`notification-panel absolute right-0 top-[54px] w-[330px] rounded-2xl border p-3 shadow-[0_22px_60px_rgba(17,43,28,0.12)] backdrop-blur-xl ${theme === "dark" ? "border-[#2a3d2f] bg-[#12261a]/95 text-[#edf5ee]" : "border-[#e7eee6] bg-white/95 text-[#203a2c]"}`}>
              <div className="mb-2 flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1f7b52] shadow-[0_0_0_4px_rgba(31,123,82,0.1)]" />
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${theme === "dark" ? "text-[#b6d2bc]" : "text-[#6f8674]"}`}>Live updates</span>
                </div>
                <button className={`text-[10px] font-semibold ${theme === "dark" ? "text-[#d4f6dd]" : "text-[#3f7253]"}`} onClick={() => setNotifications([])}>Clear</button>
              </div>

              <div className="space-y-2">
                {notifications.length === 0 ? (
                  <div className={`rounded-xl px-3 py-4 text-center text-[11px] ${theme === "dark" ? "bg-[#142d21] text-[#abc0b1]" : "bg-[#f7faf6] text-[#7a877d]"}`}>No new alerts</div>
                ) : notifications.map((notification) => (
                  <div key={notification.id} className={`rounded-xl border p-3 transition ${theme === "dark" ? "border-[#2a3d2f] bg-[#122c1f] hover:bg-[#163125]" : "border-[#edf0ee] bg-[#fafcf9] hover:bg-[#f5faf6]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[11px] font-bold ${theme === "dark" ? "text-[#effaf0]" : "text-[#203a2c]"}`}>{notification.title}</p>
                        <p className={`mt-1 text-[10px] leading-5 ${theme === "dark" ? "text-[#b7cabc]" : "text-[#707e72]"}`}>{notification.message}</p>
                      </div>
                      <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${notification.tone === "success" ? "bg-[#3d9b67]" : notification.tone === "warning" ? "bg-[#d39a3d]" : "bg-[#5e7bd9]"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className={`flex items-center gap-2 rounded-xl p-1.5 ${theme === "dark" ? "hover:bg-[#12261a]" : "hover:bg-[#f7f9f6]"}`}>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${theme === "dark" ? "bg-[#1f4232] text-[#dff5e5]" : "bg-[#e3eee3] text-[#285b37]"}`}>YK</div>
          <ChevronDown size={15} className={`hidden sm:block ${theme === "dark" ? "text-[#b0c8b8]" : "text-[#829084]"}`} />
        </button>
      </div>
    </header>
  );
}