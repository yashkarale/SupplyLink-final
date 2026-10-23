import { useId } from "react";

export default function Input({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  error,
  helperText,
  className = "",
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const hasError = Boolean(error);

  return (
    <div className={["mb-4", className].filter(Boolean).join(" ")}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-semibold text-[var(--ink-soft)]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[var(--danger)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <input
        {...props}
        id={inputId}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError}
        aria-describedby={
          hasError ? errorId : helperText ? helperId : undefined
        }
        className={[
          "block min-h-11 w-full min-w-0 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm outline-none",
          "bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted-soft)]",
          "transition-[border-color,box-shadow] duration-150",
          hasError
            ? "border-[var(--danger)] focus-visible:ring-2 focus-visible:ring-[var(--danger)]/25"
            : "border-[var(--line)] focus-visible:border-[var(--focus-color)] focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]/20",
        ].join(" ")}
      />

      {hasError && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      )}

      {!hasError && helperText && (
        <p id={helperId} className="mt-1.5 text-xs text-[var(--muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
}
