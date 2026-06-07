import { useTranslation } from "react-i18next";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

type BarColor = "success" | "warning" | "destructive" | "none";

function getBarColor(used: number, limit: number | null): BarColor {
  if (limit === null) return "none";           // unlimited — never color
  if (limit === 0) return "none";              // feature not included in plan — no color, no nudge
  if (used >= limit) return "destructive";     // 100% — red
  if (used >= limit * 0.9) return "warning";  // ≥90% — amber
  return "success";                            // normal — green
}

const barFillClasses: Record<BarColor, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  none: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface UsageBarProps {
  label: string;
  used: number;
  limit: number | null; // null = unlimited
  onUpgradeClick?: () => void;
  className?: string;
}

function UsageBar({
  label,
  used,
  limit,
  onUpgradeClick,
  className = "",
}: UsageBarProps) {
  const { t } = useTranslation("subscription");
  const color = getBarColor(used, limit);
  const fillPercent =
    limit === null || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex justify-between text-body">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {limit === null
            ? t("usage.unlimitedLabel", { used: formatCount(used) })
            : `${formatCount(used)} / ${formatCount(limit)}`}
        </span>
      </div>

      {limit !== null && (
        <div
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
          className="bg-border h-2 w-full rounded-full overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all ${barFillClasses[color]}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      )}

      {color === "destructive" && onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="text-primary text-body text-left hover:underline"
        >
          {t("usage.upgradeLink")} →
        </button>
      )}
    </div>
  );
}

export default UsageBar;
