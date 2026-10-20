import { motion, useReducedMotion } from "framer-motion";

const variantClasses = {
  primary:
    "border border-transparent bg-[var(--accent)] text-[var(--accent-contrast)] hover:brightness-95 focus-visible:ring-[var(--focus-color)]",

  secondary:
    "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--paper)] focus-visible:ring-[var(--focus-color)]",

  outline:
    "border border-[var(--line-strong)] bg-transparent text-[var(--ink)] hover:border-[var(--accent)] hover:bg-[var(--paper)] focus-visible:ring-[var(--focus-color)]",

  ghost:
    "border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)] focus-visible:ring-[var(--focus-color)]",

  danger:
    "border border-transparent bg-[var(--danger)] text-white hover:brightness-95 focus-visible:ring-[var(--danger)]",
  whatsapp:
    "border border-transparent bg-[var(--whatsapp)] text-white hover:brightness-95 focus-visible:ring-[var(--whatsapp)]",
};

const sizeClasses = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-base",
  icon: "size-11 p-0",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  className = "",
  type = "button",
  ...props
}) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
      whileHover={
        !isDisabled && !reduceMotion
          ? { y: -1 }
          : undefined
      }
      whileTap={
        !isDisabled && !reduceMotion
          ? { scale: 0.98 }
          : undefined
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.16, ease: "easeOut" }
      }
      className={[
        "relative inline-flex shrink-0 items-center justify-center gap-2",
        "min-w-0 rounded-[var(--radius-control)] font-semibold",
        "transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-[#F5F3ED] dark:focus-visible:ring-offset-[#0E1118]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "select-none",
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        className,
      ].join(" ")}
      {...props}
    >
      {loading && (
        <>
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
          <span className="sr-only">Loading</span>
        </>
      )}

      {children}
    </motion.button>
  );
}
