import { useMemo } from "react";

/**
 * Operational alert panel for the Dashboard.
 * Shows actionable alerts grouped by severity.
 */
export default function AlertPanel({ wines, openBottles, deadStock, reorderSoon, collapsed, onToggle }) {
  const alerts = useMemo(() => {
    const critical = [];
    const warning = [];
    const info = [];

    // Wines priced below cost
    const losingMoney = wines.filter(w => w.buy_price > 0 && w.table_price > 0 && w.table_price < w.buy_price);
    if (losingMoney.length > 0) {
      critical.push({
        icon: "🔴",
        text: `${losingMoney.length} wine${losingMoney.length > 1 ? "s" : ""} priced below cost`,
        detail: losingMoney.slice(0, 3).map(w => w.wine_name).join(", ") + (losingMoney.length > 3 ? ` +${losingMoney.length - 3} more` : ""),
      });
    }

    // Out of stock popular wines (had sales but now 0)
    const outOfStock = wines.filter(w => w.bottle_count === 0);
    if (outOfStock.length > 0) {
      warning.push({
        icon: "📦",
        text: `${outOfStock.length} wine${outOfStock.length > 1 ? "s" : ""} out of stock`,
        detail: outOfStock.slice(0, 3).map(w => w.wine_name).join(", ") + (outOfStock.length > 3 ? ` +${outOfStock.length - 3} more` : ""),
      });
    }

    // Last bottle alerts
    const lastBottle = wines.filter(w => w.bottle_count === 1);
    if (lastBottle.length > 0) {
      warning.push({
        icon: "⚠️",
        text: `${lastBottle.length} wine${lastBottle.length > 1 ? "s" : ""} down to last bottle`,
        detail: lastBottle.slice(0, 3).map(w => w.wine_name).join(", ") + (lastBottle.length > 3 ? ` +${lastBottle.length - 3} more` : ""),
      });
    }

    // Stale BTG sessions (open > 48 hours)
    if (openBottles?.length > 0) {
      const stale = openBottles.filter(b => {
        const opened = new Date(b.session_date);
        const hoursSince = (Date.now() - opened.getTime()) / (1000 * 60 * 60);
        return hoursSince > 48;
      });
      if (stale.length > 0) {
        warning.push({
          icon: "🥂",
          text: `${stale.length} BTG bottle${stale.length > 1 ? "s" : ""} open for >48 hours`,
          detail: "Risk of spoilage — consider closing sessions",
        });
      }
    }

    // Dead stock
    if (deadStock?.length > 0) {
      info.push({
        icon: "💤",
        text: `${deadStock.length} wine${deadStock.length > 1 ? "s" : ""} with no sales in 30 days`,
        detail: deadStock.slice(0, 3).map(w => w.wine_name).join(", ") + (deadStock.length > 3 ? ` +${deadStock.length - 3} more` : ""),
      });
    }

    // Reorder soon
    if (reorderSoon?.length > 0) {
      info.push({
        icon: "🔄",
        text: `${reorderSoon.length} wine${reorderSoon.length > 1 ? "s" : ""} need reordering soon`,
        detail: reorderSoon.slice(0, 3).map(w => `${w.wine_name} (${w.daysRemaining}d left)`).join(", "),
      });
    }

    return { critical, warning, info, total: critical.length + warning.length + info.length };
  }, [wines, openBottles, deadStock, reorderSoon]);

  if (alerts.total === 0) return null;

  return (
    <div style={{ marginBottom: 28 }} className="animate-in">
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", marginBottom: collapsed ? 0 : 10,
          padding: "8px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Operational Alerts
          </span>
          <span className="badge badge-pill" style={{
            background: alerts.critical.length > 0 ? "#fee2e2" : alerts.warning.length > 0 ? "#fef3c7" : "#dbeafe",
            color: alerts.critical.length > 0 ? "#991b1b" : alerts.warning.length > 0 ? "#92400e" : "#1e40af",
          }}>
            {alerts.total}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", userSelect: "none" }}>
          {collapsed ? "▸ Show" : "▾ Hide"}
        </span>
      </div>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} className="animate-stagger">
          {alerts.critical.map((a, i) => (
            <div key={`c-${i}`} className="alert alert-critical">
              <span>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.text}</div>
                {a.detail && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{a.detail}</div>}
              </div>
            </div>
          ))}
          {alerts.warning.map((a, i) => (
            <div key={`w-${i}`} className="alert alert-warning">
              <span>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.text}</div>
                {a.detail && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{a.detail}</div>}
              </div>
            </div>
          ))}
          {alerts.info.map((a, i) => (
            <div key={`i-${i}`} className="alert alert-info">
              <span>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.text}</div>
                {a.detail && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{a.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
