
import { Outlet } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { MotionPage } from "../ui/MotionPage";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

const currentYear = new Date().getFullYear();
const THEME_STORAGE_KEY = "supplylink-theme";

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
  } catch {
    // Use light theme when browser storage is unavailable.
  }

  return "light";
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const isDark = theme === "dark";
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  // Keep the theme consistent across refreshes and nested pages.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = theme;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The interface still works when storage is unavailable.
    }
  }, [theme, isDark]);

  function toggleTheme() {
    setTheme((current) =>
      current === "light" ? "dark" : "light"
    );
  }

  return (
    <div
      className={`app-shell min-h-screen transition-colors duration-300 ${
        isDark ? "app-shell-dark" : "app-shell-light"
      }`}
      data-theme={theme}
    >
      <AppSidebar
        open={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="min-h-screen min-w-0 lg:pl-[252px]">
        <AppHeader
          onMenuClick={sidebarOpen ? closeSidebar : openSidebar}
          menuOpen={sidebarOpen}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main
          className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1600px] min-w-0 flex-col p-4 text-ink sm:p-6 lg:p-8"
        >
          <div className="flex-1">
            <MotionPage>
              <Outlet context={{ theme, setTheme }} />
            </MotionPage>
          </div>

          <footer
            className="mt-12 flex flex-col gap-2 border-t border-line py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              © {currentYear} Supply Link. Built for independent commerce sellers.
            </span>

            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Commerce Studio
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
