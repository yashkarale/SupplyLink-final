import { Plus } from "lucide-react";
import Button from "./Button";

export default function PageHeader({
  title,
  description,
  action,
  onAction,
  icon: Icon = Plus,
  theme = "light",
  actionDisabled = false,
  actionLoading = false,
  className = "",
  children,
}) {
  const isDark = theme === "dark";

  return (
    <header
      className={[
        "mb-7 flex min-w-0 flex-col gap-4",
        "sm:flex-row sm:items-center sm:justify-between",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        <h1
          className={[
            "text-2xl font-extrabold tracking-tight sm:text-[28px]",
            "break-words",
            isDark ? "text-[#F3F5F7]" : "text-[#171B24]",
          ].join(" ")}
        >
          {title}
        </h1>

        {description && (
          <p
            className={[
              "mt-1 max-w-2xl text-sm leading-relaxed",
              isDark ? "text-[#B6BBBF]" : "text-[#4A4F5C]",
            ].join(" ")}
          >
            {description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {children}
        {action && (
          <Button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            loading={actionLoading}
            className="w-full sm:w-auto"
          >
            <Icon size={16} strokeWidth={2.2} />
            {action}
          </Button>
        )}
      </div>
    </header>
  );
}
