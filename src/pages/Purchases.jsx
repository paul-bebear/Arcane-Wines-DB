import { useState, useMemo, useCallback } from "react";
import { usePurchases } from "../hooks/useWines.js";
import { supabase } from "../lib/supabaseClient.js";
import WineSelector from "../components/WineSelector.jsx";
import { CLR, BRAND, ACCENT } from "../theme.js";

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE RECORDING PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function Purchases() {
  const { purchases, loading, reload } = usePurchases();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalCost = 0, totalQty = 0, supplierMap = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let month30Cost = 0, month30Qty = 0;

    for (const p of purchases) {
      const cost = (p.quantity || 0) * (p.unit_cost || 0);
      totalCost += cost;
      totalQty += p.quantity || 0;

      if (new Date(p.purchase_date) >= thirtyDaysAgo) {
        month30Cost += cost;
        month30Qty += p.quantity || 0;
      }

      const sup = p.supplier || "Unknown";
      if (!supplierMap[sup]) supplierMap[sup] = { name: sup, cost: 0, qty: 0, count: 0 };
      supplierMap[sup].cost += cost;
      supplierMap[sup].qty += p.quantity || 0;
      supplierMap[sup].count++;
    }

    const avgUnitCost = totalQty > 0 ? totalCost / totalQty : 0;
    const suppliers = Object.values(supplierMap).sort((a, b) => b.cost - a.cost);

    return { totalCost, totalQty, avgUnitCost, month30Cost, month30Qty, suppliers };
  }, [purchases]);

  // ── Filtered + paginated ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return purchases;
    const s = search.toLowerCase();
    return purchases.filter(p =>
      (p.wines?.name || "").toLowerCase().includes(s) ||
      (p.supplier || "").toLowerCase().includes(s)
    );
  }, [purchases, search]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const remaining = filtered.length - visible.length;

  const fmt = (v) => `€${Math.round(v).toLocaleString("it-IT")}`;

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><div className="skeleton skeleton-title" /></div></div>
        <div className="grid-auto" style={{ marginBottom: 36 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchases</h1>
          <p className="page-subtitle">
            {purchases.length.toLocaleString()} records · {fmt(kpis.totalCost)} total spend
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          + Record Purchase
        </button>
      </div>

      {/* KPIs */}
      <div className="grid-auto" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Spend</div>
          <div className="stat-card-value">{fmt(kpis.totalCost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bottles Purchased</div>
          <div className="stat-card-value" style={{ color: ACCENT.green }}>{kpis.totalQty.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg Unit Cost</div>
          <div className="stat-card-value">€{kpis.avgUnitCost.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Last 30 Days</div>
          <div className="stat-card-value">{fmt(kpis.month30Cost)}</div>
          <div className="stat-card-sub">{kpis.month30Qty} bottles</div>
        </div>
      </div>

      {/* Supplier breakdown */}
      {kpis.suppliers.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-header">
            <div className="section-title">Supplier Breakdown</div>
            <div className="section-subtitle">Ranked by total spend</div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Bottles</th>
                  <th style={{ textAlign: "right" }}>Total Spend</th>
                  <th style={{ textAlign: "right" }}>Avg/Bottle</th>
                </tr>
              </thead>
              <tbody>
                {kpis.suppliers.map((s) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ textAlign: "right" }}>{s.count}</td>
                    <td style={{ textAlign: "right" }}>{s.qty}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(s.cost)}</td>
                    <td style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>€{s.qty > 0 ? (s.cost / s.qty).toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by wine or supplier..."
          className="input"
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Purchase list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <div className="empty-state-text">No purchases recorded yet</div>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">Record your first purchase</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Wine</th>
                <th>Supplier</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit Cost</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--color-text-secondary)" }}>{p.purchase_date}</td>
                  <td style={{ fontWeight: 500 }}>{p.wines?.name || "—"}</td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{p.supplier || "—"}</td>
                  <td style={{ textAlign: "right" }}>{p.quantity}</td>
                  <td style={{ textAlign: "right" }}>€{p.unit_cost?.toFixed(2)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>€{((p.quantity || 0) * (p.unit_cost || 0)).toFixed(2)}</td>
                  <td style={{ color: "var(--color-text-tertiary)", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <button onClick={() => setPage(p => p + 1)} className="btn btn-secondary">
            Load more ({remaining} remaining)
          </button>
        </div>
      )}

      {/* ── Add Purchase Modal ─────────────────────────────────────────── */}
      {showForm && (
        <PurchaseForm onSave={() => { setShowForm(false); reload(); }} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════

function PurchaseForm({ onSave, onCancel }) {
  const [wineId, setWineId] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totalCost = (parseInt(quantity) || 0) * (parseFloat(unitCost) || 0);

  const handleSave = async () => {
    if (!wineId) { setError("Select a wine"); return; }
    if (!quantity || parseInt(quantity) <= 0) { setError("Enter quantity"); return; }
    if (!unitCost || parseFloat(unitCost) <= 0) { setError("Enter unit cost"); return; }

    setSaving(true);
    setError(null);
    try {
      // Insert purchase
      const { error: err } = await supabase.from("purchases").insert({
        wine_id: wineId,
        quantity: parseInt(quantity),
        unit_cost: parseFloat(unitCost),
        total_cost: totalCost,
        supplier: supplier || null,
        purchase_date: date,
        notes: notes || null,
      });
      if (err) throw err;

      // Also update inventory + log movement
      const qty = parseInt(quantity);
      const { data: inv } = await supabase
        .from("inventory").select("id,quantity").eq("wine_id", wineId).limit(1).maybeSingle();
      if (inv) {
        await supabase.from("inventory").update({ quantity: inv.quantity + qty }).eq("id", inv.id);
      } else {
        await supabase.from("inventory").insert({ wine_id: wineId, quantity: qty, location: "Milan" });
      }

      // Update legacy bottle_count
      const { data: wineRow } = await supabase.from("wines").select("bottle_count").eq("id", wineId).maybeSingle();
      if (wineRow) {
        await supabase.from("wines").update({ bottle_count: (wineRow.bottle_count || 0) + qty }).eq("id", wineId);
      }

      await supabase.from("inventory_movements").insert({
        wine_id: wineId,
        quantity_change: qty,
        movement_type: "restock",
        source: supplier || "purchase",
        notes: notes || `Purchase: ${qty} bottles`,
      });

      onSave();
    } catch (e) {
      setError(e.message || "Failed to record purchase");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Record Purchase</h2>
          <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize: 18 }}>×</button>
        </div>

        {error && <div className="alert alert-critical" style={{ marginBottom: 12 }}>{error}</div>}

        <div>
          <label className="label">Wine *</label>
          <WineSelector
            value={wineId}
            onChange={(id) => setWineId(id)}
            placeholder="Search wine..."
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <div>
            <label className="label">Quantity *</label>
            <input type="number" className="input" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 6" />
          </div>
          <div>
            <label className="label">Unit Cost (€) *</label>
            <input type="number" step="0.01" className="input" value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)} placeholder="e.g. 8.50" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Supplier</label>
            <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g. Vinarius S.r.l." />
          </div>
          <div>
            <label className="label">Purchase Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Total</label>
            <div style={{ padding: "9px 12px", fontSize: 16, fontWeight: 700, color: totalCost > 0 ? BRAND : "var(--color-text-tertiary)" }}>
              €{totalCost.toFixed(2)}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..." />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-tertiary)" }}>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : "Record Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}
