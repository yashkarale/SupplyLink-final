import {
  Bell,
  Check,
  Command,
  Menu,
  MoonStar,
  Search,
  Settings2,
  SunMedium,
  UserRound,
  X,
  ArrowUpRight,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  ChartNoAxesCombined,
  LayoutDashboard,
  CheckCheck,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  fetchNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/api.js";

const SEARCH_ITEMS = [
  {
    label: "Dashboard",
    description: "Store overview and performance",
    path: "/dashboard",
    icon: LayoutDashboard,
    keywords: "home overview sales revenue metrics",
  },
  {
    label: "Orders",
    description: "View and manage customer orders",
    path: "/orders",
    icon: ShoppingCart,
    keywords: "purchases deliveries status fulfill tracking",
  },
  {
    label: "Products",
    description: "Manage your product catalog",
    path: "/products",
    icon: Package,
    keywords: "catalog items pricing create edit",
  },
  {
    label: "Inventory",
    description: "Monitor stock and set alert thresholds",
    path: "/inventory",
    icon: Boxes,
    keywords: "stock quantity availability alert low",
  },
  {
    label: "Customers",
    description: "Customer directory and repeat buyers",
    path: "/customers",
    icon: Users,
    keywords: "buyers clients contacts directory repeat",
  },
  {
    label: "Analytics",
    description: "Revenue charts and store performance",
    path: "/analytics",
    icon: ChartNoAxesCombined,
    keywords: "revenue reports growth sales chart",
  },
  {
    label: "Settings",
    description: "Store profile, payment QR, and preferences",
    path: "/settings",
    icon: Settings2,
    keywords: "account profile preferences store slug whatsapp",
  },
];

function getNotificationId(notification) {
  return notification.id || notification._id;
}

function formatNotificationTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function AppHeader({
  onMenuClick,
  menuOpen = false,
  theme = "light",
  onToggleTheme,
}) {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notificationError, setNotificationError] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingIds, setMarkingIds] = useState([]);

  const searchRef = useRef(null);
  const searchContainerRef = useRef(null);
  const notificationRef = useRef(null);

  const isDark = theme === "dark";

  const visibleSearchItems = SEARCH_ITEMS.filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${item.label} ${item.description} ${item.keywords}`
      .toLowerCase()
      .includes(query);
  }).slice(0, 6);

  // Load notifications and unread count.
  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      setLoading(true);
      setNotificationError(false);

      try {
        const [notificationResult, unreadResult] = await Promise.allSettled([
          fetchNotifications({ limit: 5 }),
          getUnreadNotificationCount(),
        ]);

        if (!mounted) return;

        if (notificationResult.status === "fulfilled") {
          const data = notificationResult.value;
          setNotifications(data.notifications || []);
        } else {
          setNotificationError(true);
        }

        if (unreadResult.status === "fulfilled") {
          setUnreadCount(unreadResult.value.unreadCount || 0);
        }
      } catch {
        if (mounted) setNotificationError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadNotifications();

    function handleNewNotification(event) {
      const detail = event.detail;
      if (!detail) return;

      setNotifications((previous) => {
        const newId = getNotificationId(detail) || `local-${Date.now()}`;
        const withoutDuplicate = previous.filter(
          (item) => String(getNotificationId(item)) !== String(newId)
        );

        return [
          { ...detail, id: newId, read: false },
          ...withoutDuplicate,
        ].slice(0, 5);
      });

      setUnreadCount((previous) => previous + 1);
      setPanelOpen(true);
    }

    window.addEventListener("supplylink:notify", handleNewNotification);

    return () => {
      mounted = false;
      window.removeEventListener("supplylink:notify", handleNewNotification);
    };
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + K. Escape closes open panels.
  useEffect(() => {
    function handleKeyboard(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanelOpen(false);
        setMobileSearchOpen(true);
        setSearchOpen(true);

        requestAnimationFrame(() => {
          searchRef.current?.focus();
        });
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setPanelOpen(false);
        setMobileSearchOpen(false);
        searchRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  // Close dropdowns when clicking outside.
  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function handleMarkRead(notification) {
    if (notification.read) return;

    const id = getNotificationId(notification);
    if (!id || markingIds.includes(String(id))) return;

    setMarkingIds((previous) => [...previous, String(id)]);

    try {
      await markNotificationRead(id);

      setNotifications((previous) =>
        previous.map((item) =>
          String(getNotificationId(item)) === String(id)
            ? { ...item, read: true }
            : item
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    } finally {
      setMarkingIds((previous) =>
        previous.filter((item) => item !== String(id))
      );
    }
  }

  async function handleMarkAllRead() {
    if (markingAllRead) return;
    setMarkingAllRead(true);

    try {
      await markAllNotificationsRead();
      setNotifications((previous) =>
        previous.map((item) => ({ ...item, read: true }))
      );
      setUnreadCount(0);
    } catch {
      // Fallback: mark visible individual items
      const unread = notifications.filter((n) => !n.read);
      await Promise.allSettled(
        unread.map((n) => {
          const id = getNotificationId(n);
          return id ? markNotificationRead(id) : Promise.resolve();
        })
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAllRead(false);
    }
  }

  function handleSearchSelect(path) {
    setSearch("");
    setSearchOpen(false);
    setMobileSearchOpen(false);
    navigate(path);
  }

  function handleNotificationClick(notification) {
    if (!notification.read) {
      handleMarkRead(notification);
    }

    setPanelOpen(false);

    if (notification.link) {
      const path = notification.link.startsWith("/")
        ? notification.link
        : `/${notification.link}`;
      navigate(path);
    }
  }

  const surfaceClass = isDark
    ? "border-line bg-surface text-ink"
    : "border-line bg-white text-ink";

  const mutedClass = "text-muted";

  const controlClass = isDark
    ? "border-line bg-paper text-ink hover:bg-paper hover:border-line-strong"
    : "border-line bg-paper text-ink hover:bg-paper hover:border-line-strong";

  return (
    <header
      className={`app-header sticky top-0 z-40 flex min-h-[64px] items-center justify-between gap-2 border-b px-3 transition-colors duration-150 sm:gap-3 sm:px-6 lg:px-8 ${
        isDark
          ? "app-header-dark border-line bg-surface"
          : "app-header-light border-line bg-surface"
      }`}
    >
      {/* Left: Mobile toggle & Search */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="supplylink-sidebar"
          aria-expanded={menuOpen}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] border transition-colors lg:hidden ${controlClass}`}
        >
          <Menu size={18} />
        </button>

        {/* Desktop Search */}
        <div
          ref={searchContainerRef}
          className="relative hidden min-w-0 max-w-[440px] flex-1 sm:block"
        >
          <div
            className={`flex h-10 items-center gap-2.5 rounded-[5px] border px-3 transition-all duration-150 focus-within:border-ink focus-within:ring-4 focus-within:ring-accent/30 dark:focus-within:border-accent dark:focus-within:ring-accent/20 ${
              isDark
                ? "border-line bg-paper"
                : "border-line bg-paper"
            }`}
          >
            <Search size={16} className={`shrink-0 ${mutedClass}`} />

            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                setSearchOpen(true);
                setPanelOpen(false);
              }}
              placeholder="Search pages, orders, catalog... (Ctrl+K)"
              aria-label="Search workspace"
              aria-expanded={searchOpen}
              className={`min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-soft ${
                isDark ? "text-white" : "text-ink"
              }`}
            />

            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                  setSearchOpen(true);
                }}
                aria-label="Clear search"
                className={`rounded-[4px] p-1 ${mutedClass}`}
              >
                <X size={14} />
              </button>
            ) : (
              <div
                className={`hidden items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold md:flex ${
                  isDark
                    ? "border-line bg-surface text-muted-soft"
                    : "border-line bg-surface text-muted"
                }`}
              >
                <Command size={10} />
                <span>K</span>
              </div>
            )}
          </div>

          {searchOpen && (
            <div
              className={`absolute left-0 right-0 top-[48px] z-50 overflow-hidden rounded-[5px] border p-2 shadow-[var(--shadow-overlay)] ${surfaceClass}`}
            >
              <div
                className={`px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}
              >
                {search.trim() ? "Search results" : "Quick navigation"}
              </div>

              {visibleSearchItems.length ? (
                <div className="space-y-1">
                  {visibleSearchItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <button
                        type="button"
                        key={item.path}
                        onClick={() => handleSearchSelect(item.path)}
                        className={`flex w-full items-center gap-3 rounded-[5px] p-2 text-left transition-colors ${
                          isDark
                            ? "hover:bg-paper"
                            : "hover:bg-ink"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] ${
                            isDark
                              ? "bg-accent text-accent"
                              : "bg-info-soft text-ink"
                          }`}
                        >
                          <Icon size={16} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold">
                            {item.label}
                          </span>
                          <span className={`block text-[10px] truncate ${mutedClass}`}>
                            {item.description}
                          </span>
                        </span>

                        <ArrowUpRight
                          size={14}
                          className={mutedClass}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`px-3 py-6 text-center text-xs ${mutedClass}`}>
                  <Search size={20} className="mx-auto mb-2 opacity-50" />
                  No matching pages found.
                </div>
              )}

              <div
                className={`mt-2 flex items-center justify-between border-t px-3 pt-2 text-[10px] ${
                  isDark ? "border-line" : "border-line"
                } ${mutedClass}`}
              >
                <span>Supply Link workspace</span>
                <span>Esc to close</span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Search Input */}
        <div className="relative min-w-0 flex-1 sm:hidden">
          {mobileSearchOpen ? (
            <div ref={searchContainerRef} className="relative">
              <div
                className={`flex h-9 items-center gap-2 rounded-[5px] border px-3 ${controlClass}`}
              >
                <Search size={15} className={mutedClass} />

                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search pages..."
                  aria-label="Search workspace"
                  className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${
                    isDark ? "text-white" : "text-ink"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchOpen(false);
                    setSearch("");
                  }}
                  aria-label="Close search"
                >
                  <X size={15} />
                </button>
              </div>

              {searchOpen && (
                <div
                  className={`absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-[5px] border p-2 shadow-[var(--shadow-overlay)] ${surfaceClass}`}
                >
                  {visibleSearchItems.length ? (
                    visibleSearchItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => handleSearchSelect(item.path)}
                          className={`flex w-full items-center gap-2.5 rounded-[5px] p-2 text-left ${
                            isDark
                              ? "hover:bg-paper"
                              : "hover:bg-ink"
                          }`}
                        >
                          <Icon size={16} />
                          <span className="text-xs font-medium">
                            {item.label}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className={`p-3 text-center text-xs ${mutedClass}`}>
                      No matching pages found.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(true);
                setSearchOpen(true);
                setPanelOpen(false);
                requestAnimationFrame(() => searchRef.current?.focus());
              }}
              aria-label="Search workspace"
              className={`flex h-9 items-center gap-2 rounded-[5px] border px-3 text-xs ${controlClass}`}
            >
              <Search size={15} className={mutedClass} />
              <span className={`truncate ${mutedClass}`}>Search workspace...</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Theme switch, Notifications, Account */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Theme switch */}
        <button
          type="button"
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          onClick={onToggleTheme}
          className={`flex h-10 w-10 items-center justify-center rounded-[5px] border transition-colors ${controlClass}`}
        >
          {isDark ? (
            <SunMedium size={17} className="text-amber-300" />
          ) : (
            <MoonStar size={17} className="text-muted" />
          )}
        </button>

        {/* Notifications */}
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={panelOpen}
            onClick={() => {
              setPanelOpen((previous) => !previous);
              setSearchOpen(false);
              setMobileSearchOpen(false);
            }}
            className={`relative flex h-10 w-10 items-center justify-center rounded-[5px] border transition-colors ${controlClass}`}
          >
            <Bell size={17} />

            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-surface" />
            )}
          </button>

          {panelOpen && (
            <div
              className={`absolute right-0 top-[48px] z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[5px] border shadow-[var(--shadow-overlay)] ${surfaceClass}`}
            >
              {/* Panel heading */}
              <div
                className={`flex items-center justify-between border-b px-4 py-3 ${
                  isDark ? "border-line" : "border-line"
                }`}
              >
                <div>
                  <h3 className="text-xs font-bold text-ink dark:text-ink">
                    Notifications
                  </h3>
                  <p className={`text-[10px] ${mutedClass}`}>
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                      : "All caught up"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close notifications"
                  className={`flex h-7 w-7 items-center justify-center rounded-[5px] ${
                    isDark ? "hover:bg-paper" : "hover:bg-ink"
                  }`}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Notification list */}
              <div className="max-h-[380px] overflow-y-auto custom-scrollbar p-1.5">
                {loading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className={`animate-pulse rounded-[5px] p-3 ${
                          isDark ? "bg-paper" : "bg-paper"
                        }`}
                      >
                        <div
                          className={`h-2.5 w-2/5 rounded ${
                            isDark ? "bg-line-strong" : "bg-line-strong"
                          }`}
                        />
                        <div
                          className={`mt-2 h-2 w-4/5 rounded ${
                            isDark ? "bg-line" : "bg-line"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                ) : notificationError && notifications.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Bell size={22} className={`mx-auto mb-2 ${mutedClass}`} />
                    <p className="text-xs font-semibold">Notifications unavailable</p>
                    <p className={`mt-1 text-[11px] ${mutedClass}`}>
                      Check connection and try again.
                    </p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <span
                      className={`mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-[5px] ${
                        isDark
                          ? "bg-accent text-accent"
                          : "bg-info-soft text-ink"
                      }`}
                    >
                      <CheckCheck size={20} />
                    </span>
                    <p className="text-xs font-semibold">All caught up</p>
                    <p className={`mt-1 text-[11px] ${mutedClass}`}>
                      New activity will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => {
                      const id = getNotificationId(notification);
                      const isMarking = markingIds.includes(String(id));

                      return (
                        <div
                          key={id}
                          className={`group flex items-start gap-2.5 rounded-[5px] p-2.5 transition-colors ${
                            !notification.read
                              ? isDark
                                ? "bg-warning-soft/40 border border-warning/20"
                                : "bg-info-soft/60 border border-info-soft"
                              : isDark
                                ? "hover:bg-paper"
                                : "hover:bg-paper"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] ${
                              !notification.read
                                ? isDark
                                  ? "bg-warning-soft text-warning"
                                  : "bg-info-soft text-ink"
                                : isDark
                                  ? "bg-paper text-muted-soft"
                                  : "bg-paper text-muted"
                            }`}
                          >
                            <Bell size={14} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleNotificationClick(notification)}
                              className="block w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-bold leading-snug">
                                  {notification.title || "Notification"}
                                </span>
                                {!notification.read && (
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink dark:bg-accent" />
                                )}
                              </div>
                              <span
                                className={`mt-0.5 block text-[11px] leading-relaxed ${mutedClass}`}
                              >
                                {notification.message}
                              </span>
                              {notification.createdAt && (
                                <span className={`mt-1 block text-[10px] ${mutedClass}`}>
                                  {formatNotificationTime(notification.createdAt)}
                                </span>
                              )}
                            </button>

                            {!notification.read && (
                              <button
                                type="button"
                                disabled={isMarking}
                                onClick={() => handleMarkRead(notification)}
                                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-ink dark:text-accent hover:underline disabled:opacity-50"
                              >
                                <Check size={11} />
                                {isMarking ? "Saving..." : "Mark as read"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Panel footer */}
              {!loading && notifications.some((item) => !item.read) && (
                <div
                  className={`border-t p-2.5 ${
                    isDark ? "border-line" : "border-line"
                  }`}
                >
                  <button
                    type="button"
                    disabled={markingAllRead}
                    onClick={handleMarkAllRead}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-[5px] py-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                      isDark
                        ? "bg-accent text-ink hover:bg-ink-soft"
                        : "bg-info-soft text-ink hover:bg-paper"
                    }`}
                  >
                    <CheckCheck size={14} />
                    {markingAllRead ? "Updating..." : "Mark all as read"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account and settings */}
        <Link
          to="/settings"
          aria-label="Account and store settings"
          title="Store settings"
          className={`flex h-10 w-10 items-center justify-center rounded-[5px] border transition-colors ${controlClass}`}
        >
          <UserRound size={17} />
        </Link>
      </div>
    </header>
  );
}
