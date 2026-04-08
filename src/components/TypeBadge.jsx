// Wine type colour-coded badge
// Handles both full names (from Supabase view) and single-letter codes (raw sheet)

// Single-letter T codes → display label
// Full-name types (Rosato, Zero Alcohol) have no letter code — stored verbatim in DB
export const TYPE_LABELS = {
  R: "Rosso",
  W: "Bianco",
  S: "Bollicine",
  O: "Orange",
  D: "Dolce",
  P: "Passito",
  C: "Birra/Cidre",
};

const COLORS = {
  // Full names
  Rosso:       { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  Bianco:      { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  Rosato:      { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  Bollicine:   { bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" },
  Orange:      { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" },
  Dolce:       { bg: "#fdf4ff", text: "#6b21a8", border: "#e9d5ff" },
  Passito:     { bg: "#fdf4ff", text: "#6b21a8", border: "#e9d5ff" },
  "Birra/Cidre":  { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  "Zero Alcohol": { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  // Single-letter fallbacks
  R: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  W: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  S: { bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" },
  O: { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" },
  D: { bg: "#fdf4ff", text: "#6b21a8", border: "#e9d5ff" },
  P: { bg: "#fdf4ff", text: "#6b21a8", border: "#e9d5ff" },
  C: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
};

export default function TypeBadge({ type }) {
  const label = TYPE_LABELS[type] || type; // expand code → label, or pass through full name
  const c = COLORS[type] || COLORS[label] || { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" };
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
