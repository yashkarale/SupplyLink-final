
import { Outlet } from "react-router-dom";
import { useState } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("light");

  return (
    <div className={`app-shell ${theme === "dark" ? "app-shell-dark" : "app-shell-light"}`}>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} theme={theme} />
      <div className="min-h-screen lg:pl-[252px]">
        <AppHeader
          onMenuClick={() => setSidebarOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        />
        <main className={`mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-9 ${theme === "dark" ? "text-[#edf5ee]" : "text-[#1d2b23]"}`}>
          <div className="animate-fade-up">
            <Outlet context={{ theme }} />
          </div>
          <footer className={`mt-12 flex flex-col gap-2 border-t py-5 text-[11px] sm:flex-row sm:items-center sm:justify-between ${theme === "dark" ? "border-[#21382d] text-[#9aa49b]" : "border-[#e6ebe4] text-[#9aa49b]"}`}>
            <span>© {new Date().getFullYear()} Supply Link. Built for independent sellers.</span>
            <span>Seller Studio · Live workspace</span>
          </footer>
        </main>
      </div>
    </div>
  );
}