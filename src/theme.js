// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// System-aware colours live in index.html as CSS custom properties.
// This file holds static brand colours and utility palettes used in JSX.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND        = "#7F77DD";
export const BRAND_BORDER = "#AFA9EC";

/** Semantic colour pairs used for status badges and alerts */
export const CLR = {
  green:  { bg: "#dcfce7", text: "#166534" },
  red:    { bg: "#fee2e2", text: "#991b1b" },
  amber:  { bg: "#fef3c7", text: "#92400e" },
  blue:   { bg: "#dbeafe", text: "#1e40af" },
  gray:   { bg: "#f3f4f6", text: "#6b7280" },
  orange: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
};

/** Single accent values used in StatCard and chart-like elements */
export const ACCENT = {
  green:  "#1D9E75",
  orange: "#D85A30",
};
