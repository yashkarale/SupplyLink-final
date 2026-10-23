import { useEffect, useRef } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Users,
  X,
  Layers,
} from "lucide-react";

const groups = [
  {
    label: "Manage",
    links: [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      { label: "Orders", path: "/orders", icon: ShoppingBag },
      { label: "Products", path: "/products", icon: Package },
      { label: "Inventory", path: "/inventory", icon: Boxes },
      { label: "Customers", path: "/customers", icon: Users },
    ],
  },
  {
    label: "Grow",
    links: [
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
      { label: "AI Insights", path: "/ai-insights", icon: Bot, badge: "AI" },
      { label: "Billing & Plan", path: "/billing", icon: CreditCard },
    ],
  },
];

export default function AppSidebar({ open = false, onClose = () => {} }) {
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector("a, button")?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusable = [...sidebarRef.current.querySelectorAll('a[href], button:not([disabled])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  const navLinkClass = ({ isActive }) =>
    `group relative flex min-h-11 items-center gap-3 rounded-[5px] border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      isActive
        ? "border-[#665d4f] bg-[#332e26] font-semibold text-[#fffdf9]"
        : "border-transparent text-[#c5bcad] hover:border-[#51483b] hover:bg-[#29251f] hover:text-[#fffdf9]"
    }`;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/45 transition-opacity duration-200 lg:hidden ${open ? "visible opacity-100" : "invisible pointer-events-none opacity-0"}`}
      />
      <aside
        id="supplylink-sidebar"
        aria-label="Main navigation"
        ref={sidebarRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(280px,calc(100vw-40px))] flex-col border-r border-line bg-surface text-ink shadow-[var(--shadow-subtle)] transition-transform duration-200 motion-reduce:transition-none lg:w-[252px] lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[78px] shrink-0 items-center justify-between border-b border-line px-5">
          <Link to="/dashboard" onClick={onClose} className="group flex min-w-0 items-center gap-3 rounded-[5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="brand-mark grid h-9 w-9 shrink-0 place-items-center rounded-[5px] bg-ink text-accent">
              <Layers size={19} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="brand-copy min-w-0">
              <span className="block font-serif text-lg font-semibold leading-tight tracking-tight">Supply Link</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Seller workspace</span>
            </span>
          </Link>
          <button type="button" aria-label="Close navigation" onClick={onClose} className="sidebar-close grid h-10 w-10 shrink-0 place-items-center rounded-[5px] text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-accent lg:hidden">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-5">
          {groups.map((group) => (
            <section key={group.label} className="mb-7">
              <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{group.label}</h2>
              <nav aria-label={group.label} className="space-y-1">
                {group.links.map(({ label, path, icon: Icon, badge }) => (
                  <NavLink key={path} to={path} end={path === "/dashboard"} onClick={onClose} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <Icon size={17} strokeWidth={isActive ? 2 : 1.7} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {badge && <span className="border border-line px-1.5 py-0.5 text-[9px] font-semibold text-muted">{badge}</span>}
                        {isActive && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Current page" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </section>
          ))}
          <section>
            <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Workspace</h2>
            <nav aria-label="Workspace preferences">
              <NavLink to="/settings" onClick={onClose} className={navLinkClass}>
                <Settings size={17} strokeWidth={1.7} aria-hidden="true" />
                <span className="flex-1">Settings</span>
              </NavLink>
            </nav>
          </section>
        </div>

        <div className="shrink-0 border-t border-line p-3">
          <div className="border border-line bg-paper p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center border border-line bg-surface text-muted"><Activity size={15} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink">Store toolkit</p>
                <p className="text-[10px] text-muted">Keep your catalog current</p>
              </div>
            </div>
            <Link to="/products" onClick={onClose} className="mt-3 flex min-h-10 items-center justify-between gap-2 bg-ink px-3 text-xs font-semibold text-paper transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span className="flex items-center gap-2"><Package size={14} aria-hidden="true" /> Manage products</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <p className="pt-3 text-center text-[10px] tracking-wide text-muted">Supply Link <span className="mx-1">·</span> Commerce</p>
        </div>
      </aside>
    </>
  );
}
