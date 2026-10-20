import { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  closeLabel = "Close",
  closeOnBackdrop = true,
  closeOnEscape = true,
  maxWidth = "max-w-lg",
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }

      // Keep keyboard focus inside the open dialog.
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose, closeOnEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (
              closeOnBackdrop &&
              event.target === event.currentTarget
            ) {
              onClose?.();
            }
          }}
        >
          {/* Backdrop */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="absolute inset-0 bg-black/55"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.97, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.98, y: 8 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.24, ease: "easeOut", exit: { duration: 0.16 } }
            }
            onMouseDown={(event) => event.stopPropagation()}
            className={[
              "relative z-[101] flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] w-full flex-col sm:max-h-[90dvh]",
              "overflow-hidden rounded-[var(--radius-dialog)] border shadow-[var(--shadow-overlay)]",
              "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
              "outline-none",
              maxWidth,
            ].join(" ")}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="truncate text-base font-bold tracking-tight text-[var(--ink)]"
                  >
                    {title}
                  </h2>
                )}
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
