import { useState, useMemo } from "react";
import { useInventory } from "../hooks/useWines.js";
import { supabase } from "../lib/supabaseClient.js";
import { CLR, BRAND, ACCENT } from "../theme.js";

export default function InventoryPage() {
  const { inventory, loading } = useInventory();
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Group by location ──────────────────────────────────────────────────
  const locations = useMemo(() => {
    const map = {};
    for (const inv of inventory) {
      const loc = inv.location || "Unknown";
      if (!map[loc]) map[loc] = { name: loc, items: [], totalBottles: 0, totalSkus: 0 };
      map[loc].items.push(inv);
      map[loc].totalBottles += inv.quantity || 0;
      map[loc].totalSkus++;
    }
    return Object.values(map).sort((a, b) => b.totalBottles - a.totalBottles);
  }, [inventory]);

  const allLocations = locations.map(l => l.name);

  // Filter
  const filteredLocations = useMemo(() => {
    let result = locations;
    if (locationFilter) result = result.filter(l => l.name === locationFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.map(loc => ({
        ...loc,
        items: loc.items.filter(inv =>
          (inv.wines?.name || "").toLowerCase().includes(s) ||
          (inv.shelf_location || "").toLowerCase().includes(s)
        ),
      })).filter(loc => loc.items.length > 0);
    }
    return result;
  }, [locations, locationFilter, search]);

  // ── Inline edit ────────────────────────────────────────────────────────
  const handleStartEdit = (inv) => {
    setEditingId(inv.id);
    setEditQty(String(inv.quantity || 0));
  };

  const handleSaveEdit = async (inv) => {
    const newQty = parseInt(editQty);
    if (isNaN(newQty) || newQty < 0) return;
    const diff = newQty - (inv.quantity || 0);
    if (diff === 0) { setEditingId(null); return; }

    setSaving(true);
    try {
      // Update inventory row
      await supabase.from("inventory").update({ quantity: newQty }).eq("id", inv.id);

      // Update legacy bottle_count
      const { data: wineRow } = await supabase.from("wines").select("bottle_count").eq("id", inv.wine_id).maybeSingle();
      if (wineRow) {
        await supabase.from("wines").update({
          bottle_count: Math.max(0, (wineRow.bottle_count || 0) + diff)
        }).eq("id", inv.wine_id);
      }

      // Log movement
      await supabase.from("inventory_movements").insert({
        wine_id: inv.wine_id,
        quantity_change: diff,
        movement_type: "adjustment",
        source: "inventory_page",
        notes: `Adjusted ${inv.location}: ${inv.quantity} → ${newQty}`,
      });

      // Update local state
      inv.quantity = newQty;
      setEditingId(null);
    } catch (e) {
      console.error("Inventory update failed:", e);
    }
    setSaving(false);
  };

  // ── Summary ────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalBottles = 0, totalSkus = 0, locationCount = locations.length;
    for (const loc of locations) { totalBottles += loc.totalBottles; totalSkus += loc.totalSkus; }
    return { totalBottles, totalSkus, locationCount };
  }, [locations]);

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><div className="skeleton skeleton-title" /></div></div>
        <div className="grid-auto" style={{ marginBottom: 36 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            {summary.totalBottles.toLocaleString()} bottles across {summary.locationCount} location{summary.locationCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-auto" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-card-label">Locations</div>
          <div className="stat-card-value">{summary.locationCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Bottles</div>
          <div className="stat-card-value" style={{ color: ACCENT.green }}>{summary.totalBottles.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total SKUs</div>
          <div className="stat-card-value">{summary.totalSkus.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wine or shelf..."
          className="input" style={{ flex: 1, minWidth: 160 }}
        />
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="select" style={{ width: "auto", minWidth: 140 }}>
          <option value="">All locations</option>
          {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Grouped tables */}
      {filteredLocations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏪</div>
          <div className="empty-state-text">No inventory data</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {filteredLocations.map((loc) => (
            <div key={loc.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>📍 {loc.name}</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 8 }}>
                    {loc.totalBottles} bottles · {loc.totalSkus} SKUs
                  </span>
                </div>
              </div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Wine</th>
                      <th>Type</th>
                      <th>Shelf</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "center", width: 80 }}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loc.items.sort((a, b) => (a.wines?.name || "").localeCompare(b.wines?.name || "")).map((inv) => {
                      const isEditing = editingId === inv.id;
                      return (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 500 }}>{inv.wines?.name || "—"}</td>
                          <td>
                            <span className="badge" style={{
                              background: (inv.wines?.wine_type === "Rosso" ? CLR.red.bg : inv.wines?.wine_type === "Bianco" ? CLR.amber.bg : CLR.blue.bg),
                              color: (inv.wines?.wine_type === "Rosso" ? CLR.red.text : inv.wines?.wine_type === "Bianco" ? CLR.amber.text : CLR.blue.text),
                            }}>
                              {inv.wines?.wine_type || "—"}
                            </span>
                          </td>
                          <td style={{ color: "var(--color-text-secondary)" }}>{inv.shelf_location || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            {isEditing ? (
                              <input
                                type="number" min="0" value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(inv)}
                                className="input" style={{ width: 70, textAlign: "right", padding: "4px 8px" }}
                                autoFocus
                              />
                            ) : (
                              <span style={{
                                fontWeight: 600,
                                color: inv.quantity === 0 ? "#ef4444" : inv.quantity < 3 ? "#f97316" : ACCENT.green,
                              }}>
                                {inv.quantity || 0}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button onClick={() => handleSaveEdit(inv)} disabled={saving} className="btn btn-primary btn-sm" style={{ padding: "3px 8px" }}>
                                  {saving ? "..." : "✓"}
                                </button>
                                <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }}>
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => handleStartEdit(inv)} className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }}>
                                ✏️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
