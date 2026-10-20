import { PackageSearch, ArrowRight } from "lucide-react";
import Button from "./Button";

export default function EmptyState({
  title = "Nothing here yet",
  description = "Try changing your search or filters.",
  actionLabel,
  onAction,
  icon: Icon = PackageSearch,
  secondaryLabel,
  onSecondaryAction,
}) {
  return (
    <div className="flex min-h-[260px] min-w-0 flex-col items-center justify-center px-5 py-14 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]">
        <Icon aria-hidden="true" size={25} strokeWidth={1.75} />
      </div>

      <h3 className="break-words text-base font-bold tracking-tight text-[var(--ink)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
        {description}
      </p>

      {(actionLabel && onAction) || (secondaryLabel && onSecondaryAction) ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button onClick={onAction} size="md">
              {actionLabel}
              <ArrowRight aria-hidden="true" size={15} />
            </Button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <Button variant="secondary" onClick={onSecondaryAction} size="md">
              {secondaryLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
