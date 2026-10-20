import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

const toneIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toneColors = {
  success:
    "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
  error:
    "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25",
  warning:
    "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/25",
  info:
    "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/25",
};

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, message, tone = "info", duration = 4000 }) => {
    const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, tone }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    return { id, clear: () => clearTimeout(timer) };
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for global notification events (backward compatibility with notifyUser)
  useEffect(() => {
    const handler = (event) => {
      const { title, message, tone = "info" } = event.detail || {};
      if (title || message) addToast({ title, message, tone });
    };
    window.addEventListener("supplylink:notify", handler);
    return () => window.removeEventListener("supplylink:notify", handler);
  }, [addToast]);

  const value = { addToast, removeToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <aside
        aria-label="Notification toasts"
        className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[200] mx-auto flex max-w-sm flex-col gap-2.5 sm:inset-x-auto sm:right-5 sm:mx-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = toneIcons[toast.tone] || toneIcons.info;
            return (
              <motion.div
                key={toast.id}
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 14, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`pointer-events-auto flex items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3 shadow-[var(--shadow-overlay)] ${
                  toneColors[toast.tone] || toneColors.info
                }`}
              >
                <Icon size={18} className="mt-0.5 shrink-0" strokeWidth={2.2} />
                <div className="flex-1 min-w-0 pr-1">
                  {toast.title && <p className="font-bold text-xs leading-snug">{toast.title}</p>}
                  {toast.message && <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{toast.message}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => removeToast(toast.id)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] opacity-70 transition-opacity hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
