
import { NavLink } from "react-router-dom";
import {
  Activity, BarChart3, Bot, Boxes, CreditCard, LayoutDashboard,
  Package, Settings, ShoppingBag, Users, X, Leaf, ExternalLink
} from "lucide-react";

const groups = [
  {
    label: "WORKSPACE",
    links: [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      { label: "Orders", path: "/orders", icon: ShoppingBag },
      { label: "Products", path: "/products", icon: Package },
      { label: "Inventory", path: "/inventory", icon: Boxes },
      { label: "Customers", path: "/customers", icon: Users },
    ],
  },
  {
    label: "GROW YOUR BUSINESS",
    links: [
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
      { label: "AI Insights", path: "/ai-insights", icon: Bot },
      { label: "Billing & Plan", path: "/billing", icon: CreditCard },
    ],
  },
];

export default function AppSidebar({ open, onClose, theme }) {
  return (
    <>
      {open && <button aria-label="Close menu overlay" onClick={onClose} className="fixed inset-0 z-40 bg-black/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} ${theme === "dark" ? "border-[#21382d] bg-[linear-gradient(180deg,#12251b,#0d1d15)] text-[#edf5ee]" : "border-[#e9ede7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,245,0.96))] text-[#1d2b23]"}`}>
        <div className={`flex h-[76px] items-center justify-between border-b px-6 ${theme === "dark" ? "border-[#21382d]" : "border-[#eef0ec]"}`}>
          <NavLink to="/" onClick={onClose} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,#173d2c,#2f7d52)] text-white shadow-[0_12px_24px_rgba(23,61,44,0.25)]">
              <Leaf size={22} />
            </div>
            <div>
              <p className={`text-[17px] font-bold tracking-tight ${theme === "dark" ? "text-[#ebf7ee]" : "text-[#1e3324]"}`}>supply<span className="text-[#45875a]">link</span></p>
              <p className={`text-[10px] font-medium tracking-[0.16em] ${theme === "dark" ? "text-[#94a095]" : "text-[#94a095]"}`}>SELLER STUDIO</p>
            </div>
          </NavLink>
          <button onClick={onClose} className={`rounded-lg p-2 lg:hidden ${theme === "dark" ? "text-white/80 hover:bg-white/5" : "text-gray-500 hover:bg-gray-100"}`}><X size={19} /></button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-6">
          {groups.map((group) => (
            <div key={group.label} className="mb-7">
              <p className={`mb-3 px-3 text-[10px] font-bold tracking-[0.15em] ${theme === "dark" ? "text-[#9ba49c]" : "text-[#9ba49c]"}`}>{group.label}</p>
              <nav className="space-y-1">
                {group.links.map(({ label, path, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === "/dashboard"}
                    onClick={onClose}
                    className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${isActive ? (theme === "dark" ? "bg-[#183128] text-[#dff7e6] shadow-[inset_0_0_0_1px_rgba(117,171,130,0.2)]" : "bg-[linear-gradient(135deg,#eaf3ec,#edf7f0)] text-[#215c39] shadow-[inset_0_0_0_1px_rgba(33,92,57,0.09)]") : theme === "dark" ? "text-[#afc7b0] hover:bg-white/5 hover:text-[#edf7ee]" : "text-[#778178] hover:bg-[#f6f8f5] hover:text-[#26372b]"}`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{label}</span>
                    {label === "AI Insights" && <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-bold ${theme === "dark" ? "bg-[#1b4537] text-[#dff7e6]" : "bg-[#d9efde] text-[#27633b]"}`}>AI</span>}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
          <p className={`mb-3 px-3 text-[10px] font-bold tracking-[0.15em] ${theme === "dark" ? "text-[#9ba49c]" : "text-[#9ba49c]"}`}>PREFERENCES</p>
          <NavLink to="/settings" onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${isActive ? (theme === "dark" ? "bg-[#183128] text-[#dff7e6] shadow-[inset_0_0_0_1px_rgba(117,171,130,0.2)]" : "bg-[linear-gradient(135deg,#eaf3ec,#edf7f0)] text-[#215c39] shadow-[inset_0_0_0_1px_rgba(33,92,57,0.09)]") : theme === "dark" ? "text-[#afc7b0] hover:bg-white/5" : "text-[#778178] hover:bg-[#f6f8f5]"}`}>
            <Settings size={18} strokeWidth={1.8} /> Settings
          </NavLink>
        </div>

        <div className={`border-t p-4 ${theme === "dark" ? "border-[#21382d]" : "border-[#eef0ec]"}`}>
          <div className={`rounded-2xl p-4 shadow-[0_12px_28px_rgba(17,43,28,0.04)] ${theme === "dark" ? "bg-[linear-gradient(135deg,#183128,#10261d)]" : "bg-[linear-gradient(135deg,#f4f8f3,#edf6ef)]"}`}>
            <div className="mb-2 flex items-center gap-2">
              <Activity size={16} className="text-[#438457]" />
              <span className={`text-xs font-semibold ${theme === "dark" ? "text-[#ebf7ee]" : "text-[#284c31]"}`}>Your store is growing</span>
            </div>
            <p className={`mb-3 text-[11px] leading-5 ${theme === "dark" ? "text-[#c8d9cd]" : "text-[#78857a]"}`}>Keep your catalog updated to give customers a better shopping experience.</p>
            <NavLink to="/products" onClick={onClose} className={`flex items-center gap-1 text-xs font-semibold ${theme === "dark" ? "text-[#d0f6db]" : "text-[#27633b]"}`}>Manage products <ExternalLink size={12} /></NavLink>
          </div>
          <p className={`mt-4 text-center text-[10px] ${theme === "dark" ? "text-[#a7b7ab]" : "text-[#a3aba4]"}`}>Supply Link · Seller Studio</p>
        </div>
      </aside>
    </>
  );
}