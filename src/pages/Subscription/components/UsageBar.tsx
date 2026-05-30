import { useTranslation } from "react-i18next";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

type BarColor = "secondary" | "amber" | "error" | "none";

function getBarColor(used: number, limit: number | null): BarColor {
  if (limit === null) return "none";       // unlimited — never color
  if (limit === 0) return "none";          // feature not included in plan — no color, no nudge
  if (used >= limit) return "error";       // 100% — red
  if (used >= limit * 0.9) return "amber"; // ≥90% — amber
  return "secondary";                      // normal — blue
}

const barFillClasses: Record<BarColor, string> = {
  secondary: "bg-secondary",
  amber: "bg-amber",
  error: "bg-error",
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
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-darkgray">
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
          className="bg-lightgray h-2 w-full rounded-full overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all ${barFillClasses[color]}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      )}

      {color === "error" && onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="text-primary text-sm text-left hover:underline"
        >
          {t("usage.upgradeLink")} →
        </button>
      )}
    </div>
  );
}

export default UsageBar;
