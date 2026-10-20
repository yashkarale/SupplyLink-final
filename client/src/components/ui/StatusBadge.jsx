const statusTones = {
  processing: "warning",
  confirmed: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  active: "success",
  healthy: "success",
  "out of stock": "danger",
  "low stock": "warning",
  loyal: "success",
  returning: "info",
  new: "info",
  "at risk": "warning",
  paid: "success",
  verified: "success",
  pending: "warning",
  draft: "neutral",
};

export default function StatusBadge({ status, className = "" }) {
  const normalizedStatus = typeof status === "string" ? status.trim() : "";
  const tone = statusTones[normalizedStatus.toLowerCase()] || "neutral";

  return (
    <span
      className={[
        "sl-status-badge inline-flex items-center whitespace-nowrap rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold",
        `sl-status-badge--${tone}`,
        className,
      ].filter(Boolean).join(" ")}
    >
      {normalizedStatus || "Unknown"}
    </span>
  );
}
