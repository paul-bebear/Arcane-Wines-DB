// ─────────────────────────────────────────────────────────────────────────────
// Display maps for single-letter codes stored in the database
// ─────────────────────────────────────────────────────────────────────────────

/** Calice (glass) codes → display label */
export const GLASS_LABELS = {
  B: "Bordeaux",
  S: "Standard",
  U: "Universal",
  V: "Vetro grande",
};

/** Fmt (format) codes → display label */
export const FORMAT_LABELS = {
  0.375: "375ml (half)",
  0.5:   "500ml",
  0.75:  "750ml",
  1.5:   "Magnum 1.5L",
  3:     "Double Magnum 3L",
  4.5:   "Jeroboam 4.5L",
  6:     "Imperiale 6L",
};

/** AP (acquisition path) codes → display label */
export const AP_LABELS = {
  A: "Acquisto diretto",
  F: "Fornitore",
};

/**
 * Returns a human-readable label for a glass code,
 * falling back to the raw value if unknown.
 */
export function glassLabel(code) {
  return GLASS_LABELS[code] || code || "—";
}

// Supabase stores format as text strings ("0.75L", "1.5L", etc.)
const FORMAT_STRING_LABELS = {
  "0.375L": "375ml (½ bottle)",
  "0.5L":   "500ml",
  "0.75L":  "750ml",
  "1.5L":   "Magnum 1.5L",
  "3L":     "Double Magnum 3L",
  "4.5L":   "Jeroboam 4.5L",
  "6L":     "Imperiale 6L",
};

/**
 * Returns a human-readable label for a format value.
 * Handles both string ("0.75L") and numeric (0.375) inputs.
 * Null/undefined → "750ml" (standard bottle).
 */
export function formatLabel(fmt) {
  if (fmt === null || fmt === undefined) return "750ml";
  if (typeof fmt === "string") return FORMAT_STRING_LABELS[fmt] || fmt;
  return FORMAT_LABELS[fmt] || `${fmt}L`;
}
