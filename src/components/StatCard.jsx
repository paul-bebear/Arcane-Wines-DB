export default function StatCard({ label, value, sub, accent, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {(sub || trend) && (
        <div className="stat-card-sub">
          {trend && (
            <span style={{
              color: trend > 0 ? "#22c55e" : trend < 0 ? "#ef4444" : "var(--color-text-tertiary)",
              fontWeight: 600,
              marginRight: sub ? 4 : 0,
            }}>
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}{" "}
              {Math.abs(trend)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}
