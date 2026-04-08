import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";
import TypeBadge from "./TypeBadge.jsx";
import PriceHistory from "./PriceHistory.jsx";
import { glassLabel, formatLabel } from "../lib/displayMaps.js";
import { BRAND, ACCENT, CLR } from "../theme.js";

/**
 * Wine detail slide-out panel.
 * Shows full wine info, price history, recent movements, BTG sessions, and quick actions.
 */
export default function WineDetail({ wine, onClose, onEdit, onAdjustStock, onOpenBtg }) {
  const [movements, setMovements] = useState([]);
  const [btgSessions, setBtgSessions] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [loadingBtg, setLoadingBtg] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [editingStockId, setEditingStockId] = useState(null);
  const [editStockQty, setEditStockQty] = useState("");
  const [savingStock, setSavingStock] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Lazy-load movements and BTG sessions for this wine
  useEffect(() => {
    if (!wine?.id) return;

    (async () => {
      setLoadingMovements(true);
      const { data } = await supabase
        .from("inventory_movements")
        .select("id,quantity_change,movement_type,source,notes,created_at")
        .eq("wine_id", wine.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setMovements(data || []);
      setLoadingMovements(false);
    })();

    (async () => {
      setLoadingBtg(true);
      const { data } = await supabase
        .from("btg_sessions")
        .select("id,session_date,price_per_glass,glasses_target,glasses_poured,status")
        .eq("wine_id", wine.id)
        .order("session_date", { ascending: false })
        .limit(10);
      setBtgSessions(data || []);
      setLoadingBtg(false);
    })();

    (async () => {
      setLoadingStock(true);
      const { data } = await supabase
        .from("inventory")
        .select("id,location,shelf_location,quantity,census_date")
        .eq("wine_id", wine.id)
        .order("location");
      setStockRows(data || []);
      setLoadingStock(false);
    })();
  }, [wine?.id]);

  const handleStockSave = async (row) => {
    const newQty = parseInt(editStockQty);
    if (isNaN(newQty) || newQty < 0) return;
    const diff = newQty - (row.quantity || 0);
    if (diff === 0) { setEditingStockId(null); return; }
    setSavingStock(true);
    try {
      await supabase.from("inventory").update({ quantity: newQty }).eq("id", row.id);
      const { data: wineRow } = await supabase.from("wines").select("bottle_count").eq("id", wine.id).maybeSingle();
      if (wineRow) {
        await supabase.from("wines").update({ bottle_count: Math.max(0, (wineRow.bottle_count || 0) + diff) }).eq("id", wine.id);
      }
      await supabase.from("inventory_movements").insert({
        wine_id: wine.id, quantity_change: diff, movement_type: "adjustment",
        source: "wine_detail", notes: `${row.location}: ${row.quantity} → ${newQty}`,
      });
      setStockRows(prev => prev.map(r => r.id === row.id ? { ...r, quantity: newQty } : r));
      setEditingStockId(null);
    } catch (e) { console.error(e); }
    setSavingStock(false);
  };

  if (!wine) return null;

  const margin = wine.buy_price > 0 && wine.table_price > 0
    ? ((wine.table_price - wine.buy_price) / wine.table_price * 100).toFixed(1)
    : null;
  const markup = wine.buy_price > 0 && wine.table_price > 0
    ? (wine.table_price / wine.buy_price).toFixed(1)
    : null;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "stock", label: `Stock${stockRows.length ? ` (${stockRows.reduce((s, r) => s + (r.quantity || 0), 0)})` : ""}` },
    { key: "pricing", label: "Pricing" },
    { key: "movements", label: "Movements" },
    { key: "btg", label: "BTG" },
  ];

  return (
    <>
      <div className="slide-panel-overlay" onClick={onClose} />
      <div className="slide-panel">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <TypeBadge type={wine.wine_type} />
              {wine.reserved_list && (
                <span className="badge" style={{ background: CLR.red.bg, color: CLR.red.text }}>Reserved</span>
              )}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
              {wine.wine_name}
              {wine.vintage && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)", marginLeft: 6 }}>{wine.vintage}</span>}
            </h2>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
              {wine.producer_name} · {wine.region_name}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 20, marginTop: -4 }}>×</button>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
          {[
            { label: "Stock", value: wine.bottle_count || 0, color: wine.bottle_count === 0 ? "#ef4444" : wine.bottle_count === 1 ? "#f97316" : ACCENT.green },
            { label: "Table", value: wine.table_price != null ? `€${wine.table_price}` : "—" },
            { label: "Buy", value: wine.buy_price != null ? `€${wine.buy_price}` : "—" },
            { label: "Margin", value: margin ? `${margin}%` : "—", color: margin >= 40 ? ACCENT.green : margin >= 20 ? "#eab308" : "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: 10, borderRadius: 10, background: "var(--color-background-secondary)", textAlign: "center", border: "1px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: color || "var(--color-text-primary)", marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => onEdit?.(wine)} className="btn btn-primary btn-sm">✏️ Edit</button>
          <button onClick={() => onAdjustStock?.(wine)} className="btn btn-secondary btn-sm">📦 Adjust Stock</button>
          <button onClick={() => onOpenBtg?.(wine)} className="btn btn-secondary btn-sm">🥂 Open for BTG</button>
        </div>

        {/* Tabs */}
        <div className="period-toggle" style={{ marginBottom: 16 }}>
          {tabs.map((t) => (
            <button key={t.key} className={activeTab === t.key ? "active" : ""} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="animate-in">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
              <div>
                <span style={{ color: "var(--color-text-tertiary)" }}>Grapes</span>
                <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>{wine.grapes || "—"}</div>
              </div>
              <div>
                <span style={{ color: "var(--color-text-tertiary)" }}>Format</span>
                <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>{formatLabel(wine.format)}</div>
              </div>
              <div>
                <span style={{ color: "var(--color-text-tertiary)" }}>Glass Type</span>
                <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>{glassLabel(wine.glass_type)}</div>
              </div>
              <div>
                <span style={{ color: "var(--color-text-tertiary)" }}>Location</span>
                <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>{wine.shelf_location || "—"}</div>
              </div>
              <div>
                <span style={{ color: "var(--color-text-tertiary)" }}>Takeaway</span>
                <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>
                  {wine.takeaway_available ? `Yes · €${wine.takeaway_price}` : "No"}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--color-text-tertiary)" }}>Markup</span>
                <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>{markup ? `${markup}×` : "—"}</div>
              </div>
              {wine.notes && (
                <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                  <span style={{ color: "var(--color-text-tertiary)" }}>Notes</span>
                  <div style={{ fontWeight: 400, fontStyle: "italic", color: "var(--color-text-primary)", marginTop: 2 }}>{wine.notes}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "stock" && (
          <div className="animate-in">
            {loadingStock ? (
              <div className="loading-center" style={{ minHeight: 120 }}><div className="spinner" /></div>
            ) : stockRows.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">🏪</div>
                <div style={{ fontSize: 12 }}>No inventory records for this wine</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stockRows.map((row) => {
                  const isEditing = editingStockId === row.id;
                  const qty = row.quantity || 0;
                  return (
                    <div key={row.id} className="card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                            📍 {row.location || "Unknown"}
                          </div>
                          {row.shelf_location && (
                            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                              Shelf: {row.shelf_location}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isEditing ? (
                            <>
                              <input
                                type="number" min="0" value={editStockQty}
                                onChange={(e) => setEditStockQty(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleStockSave(row)}
                                className="input" style={{ width: 70, textAlign: "right", padding: "4px 8px" }}
                                autoFocus
                              />
                              <button onClick={() => handleStockSave(row)} disabled={savingStock} className="btn btn-primary btn-sm">
                                {savingStock ? "..." : "✓"}
                              </button>
                              <button onClick={() => setEditingStockId(null)} className="btn btn-ghost btn-sm">×</button>
                            </>
                          ) : (
                            <>
                              <span style={{
                                fontSize: 20, fontWeight: 700,
                                color: qty === 0 ? "#ef4444" : qty < 3 ? "#f97316" : ACCENT.green,
                              }}>
                                {qty}
                              </span>
                              <button
                                onClick={() => { setEditingStockId(row.id); setEditStockQty(String(qty)); }}
                                className="btn btn-ghost btn-sm"
                              >✏️</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "right", marginTop: 4 }}>
                  Total across all locations: {stockRows.reduce((s, r) => s + (r.quantity || 0), 0)} bottles
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "pricing" && (
          <div className="animate-in">
            <PriceHistory wineId={wine.id} />
          </div>
        )}

        {activeTab === "movements" && (
          <div className="animate-in">
            {loadingMovements ? (
              <div className="loading-center" style={{ minHeight: 120 }}>
                <div className="spinner" />
              </div>
            ) : movements.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">📦</div>
                <div style={{ fontSize: 12 }}>No movements recorded for this wine</div>
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td style={{ color: "var(--color-text-secondary)", whiteSpace: "nowrap", fontSize: 11 }}>
                          {new Date(m.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: m.movement_type === "sale" ? CLR.blue.bg : m.movement_type === "restock" ? CLR.green.bg : CLR.amber.bg,
                            color: m.movement_type === "sale" ? CLR.blue.text : m.movement_type === "restock" ? CLR.green.text : CLR.amber.text,
                          }}>
                            {m.movement_type}
                          </span>
                        </td>
                        <td style={{
                          textAlign: "right", fontWeight: 600,
                          color: m.quantity_change > 0 ? CLR.green.text : CLR.red.text,
                        }}>
                          {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                        </td>
                        <td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{m.source || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "btg" && (
          <div className="animate-in">
            {loadingBtg ? (
              <div className="loading-center" style={{ minHeight: 120 }}>
                <div className="spinner" />
              </div>
            ) : btgSessions.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">🥂</div>
                <div style={{ fontSize: 12 }}>No BTG sessions for this wine</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {btgSessions.map((s) => {
                  const pct = s.glasses_target > 0 ? Math.min(100, (s.glasses_poured / s.glasses_target) * 100) : 0;
                  return (
                    <div key={s.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{s.session_date}</div>
                        <span className="badge badge-pill" style={{
                          background: s.status === "open" ? CLR.green.bg : CLR.gray.bg,
                          color: s.status === "open" ? CLR.green.text : CLR.gray.text,
                        }}>
                          {s.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                          {s.glasses_poured}/{s.glasses_target} glasses · €{s.price_per_glass}/glass
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT.green }}>
                          €{((s.glasses_poured || 0) * (s.price_per_glass || 0)).toFixed(0)} earned
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? ACCENT.green : pct >= 60 ? "#eab308" : BRAND,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
