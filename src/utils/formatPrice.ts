/**
 * Convert a price in kopiyky to a UAH integer string for display.
 * Returns "0" for zero — callers should use t("price.free") when monthly_price === 0.
 * Example: formatPrice(19900) → "199"
 */
export function formatPrice(kopiyky: number): string {
  return String(Math.round(kopiyky / 100));
}
