import { useMemo } from "react";
import { usePriceHistory } from "../hooks/usePriceHistory.js";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BRAND, ACCENT } from "../theme.js";

/**
 * Price history chart and table for a specific wine.
 * Shows buy and table price over time from wine_prices.
 */
export default function PriceHistory({ wineId }) {
  const { history, loading } = usePriceHistory(wineId);

  const chartData = useMemo(() =>
    history.map((h) => ({
      date: new Date(h.effective_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
      rawDate: h.effective_date,
      buy: h.buy_price,
      table: h.table_price,
      takeaway: h.takeaway_price,
    })),
  [history]);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div className="skeleton skeleton-card" style={{ height: 160 }} />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)" }}>
        No price history available
      </div>
    );
  }

  if (history.length === 1) {
    const h = history[0];
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 8 }}>Current prices (since {h.effective_date})</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Buy</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>€{h.buy_price ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Table</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: ACCENT.green }}>€{h.table_price ?? "—"}</div>
          </div>
          {h.takeaway_price != null && (
            <div>
              <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Takeaway</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>€{h.takeaway_price}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8, paddingLeft: 4 }}>
        Price History ({history.length} changes)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-text-tertiary)" }} />
          <YAxis tick={{ fontSize: 9, fill: "var(--color-text-tertiary)" }} tickFormatter={(v) => `€${v}`} />
          <Tooltip
            contentStyle={{
              background: "var(--color-background-secondary)",
              border: "1px solid var(--color-border-tertiary)",
              borderRadius: 10, fontSize: 12,
            }}
            formatter={(v, name) => [`€${v}`, name === "buy" ? "Buy Price" : name === "table" ? "Table Price" : "Takeaway"]}
          />
          <Line type="monotone" dataKey="buy" name="buy" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="table" name="table" stroke={ACCENT.green} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Price change table */}
      <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 8 }}>
        <table className="table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Buy</th>
              <th style={{ textAlign: "right" }}>Table</th>
              <th style={{ textAlign: "right" }}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((h, i) => {
              const margin = h.buy_price > 0 && h.table_price > 0
                ? ((h.table_price - h.buy_price) / h.table_price * 100).toFixed(1)
                : null;
              return (
                <tr key={h.id}>
                  <td style={{ color: "var(--color-text-secondary)" }}>{h.effective_date}</td>
                  <td style={{ textAlign: "right" }}>€{h.buy_price ?? "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>€{h.table_price ?? "—"}</td>
                  <td style={{ textAlign: "right", color: margin >= 40 ? ACCENT.green : margin >= 20 ? "#eab308" : "#ef4444" }}>
                    {margin ? `${margin}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
