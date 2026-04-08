import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import WineSelector from "./WineSelector.jsx";

/**
 * Quick stock adjustment modal.
 * Supports: adjust (+/-), receive delivery (writes to purchases + inventory + movements).
 */
export default function QuickStock({ wine, onSave, onCancel }) {
  const [mode, setMode] = useState("adjust"); // "adjust" | "receive"
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("adjustment"); // adjustment | census | breakage | gift
  const [supplier, setSupplier] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // For when no wine is passed, allow selection
  const [selectedWineId, setSelectedWineId] = useState(wine?.id || null);
  const [selectedWine, setSelectedWine] = useState(wine || null);

  const targetWineId = wine?.id || selectedWineId;
  const targetWineName = wine?.wine_name || selectedWine?.wine_name || "wine";

  const handleSave = async () => {
    if (!targetWineId) { setError("Select a wine first"); return; }
    if (!quantity || parseInt(quantity) === 0) { setError("Enter a quantity"); return; }

    setSaving(true);
    setError(null);

    try {
      const qty = parseInt(quantity);

      if (mode === "receive") {
        if (qty <= 0) { setError("Receive quantity must be positive"); setSaving(false); return; }

        // 1. Update inventory quantity
        const { data: existingInv } = await supabase
          .from("inventory")
          .select("id,quantity")
          .eq("wine_id", targetWineId)
          .limit(1)
          .maybeSingle();

        if (existingInv) {
          await supabase
            .from("inventory")
            .update({ quantity: existingInv.quantity + qty })
            .eq("id", existingInv.id);
        } else {
          await supabase
            .from("inventory")
            .insert({ wine_id: targetWineId, quantity: qty, location: "Milan" });
        }

        // 2. Update legacy bottle_count on wines
        const { data: wineRow } = await supabase
          .from("wines")
          .select("bottle_count")
          .eq("id", targetWineId)
          .maybeSingle();
        if (wineRow) {
          await supabase.from("wines")
            .update({ bottle_count: (wineRow.bottle_count || 0) + qty })
            .eq("id", targetWineId);
        }

        // 3. Log movement
        await supabase.from("inventory_movements").insert({
          wine_id: targetWineId,
          quantity_change: qty,
          movement_type: "restock",
          source: supplier || "manual",
          notes: notes || `Received ${qty} bottles`,
        });

        // 4. Record purchase if cost provided
        if (unitCost && parseFloat(unitCost) > 0) {
          await supabase.from("purchases").insert({
            wine_id: targetWineId,
            quantity: qty,
            unit_cost: parseFloat(unitCost),
            total_cost: qty * parseFloat(unitCost),
            supplier: supplier || null,
            purchase_date: new Date().toISOString().slice(0, 10),
            notes: notes || null,
          });
        }
      } else {
        // Simple adjustment (can be negative for breakage/gift etc.)
        const adjustQty = qty; // positive = add, negative = remove

        // Update inventory
        const { data: existingInv } = await supabase
          .from("inventory")
          .select("id,quantity")
          .eq("wine_id", targetWineId)
          .limit(1)
          .maybeSingle();

        if (existingInv) {
          const newQty = Math.max(0, existingInv.quantity + adjustQty);
          await supabase.from("inventory").update({ quantity: newQty }).eq("id", existingInv.id);
        } else if (adjustQty > 0) {
          await supabase.from("inventory").insert({ wine_id: targetWineId, quantity: adjustQty, location: "Milan" });
        }

        // Update legacy bottle_count
        const { data: wineRow } = await supabase
          .from("wines")
          .select("bottle_count")
          .eq("id", targetWineId)
          .maybeSingle();
        if (wineRow) {
          await supabase.from("wines")
            .update({ bottle_count: Math.max(0, (wineRow.bottle_count || 0) + adjustQty) })
            .eq("id", targetWineId);
        }

        // Log movement
        await supabase.from("inventory_movements").insert({
          wine_id: targetWineId,
          quantity_change: adjustQty,
          movement_type: reason === "breakage" || reason === "gift" ? "adjustment" : "adjustment",
          source: "manual",
          notes: notes || `${reason}: ${adjustQty > 0 ? "+" : ""}${adjustQty} bottles`,
        });
      }

      onSave?.();
    } catch (e) {
      console.error("Quick stock failed:", e);
      setError(e.message || "Failed to update stock");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === "receive" ? "Receive Delivery" : "Adjust Stock"}
          </h2>
          <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize: 18 }}>×</button>
        </div>

        {/* Mode toggle */}
        <div className="period-toggle" style={{ marginBottom: 16 }}>
          <button className={mode === "adjust" ? "active" : ""} onClick={() => setMode("adjust")}>
            Adjust
          </button>
          <button className={mode === "receive" ? "active" : ""} onClick={() => setMode("receive")}>
            Receive Delivery
          </button>
        </div>

        {error && <div className="alert alert-critical" style={{ marginBottom: 12 }}>{error}</div>}

        {/* Wine selector (if not pre-selected) */}
        {!wine && (
          <div>
            <label className="label">Wine *</label>
            <WineSelector
              value={selectedWineId}
              onChange={(id, w) => { setSelectedWineId(id); setSelectedWine(w); }}
              placeholder="Search wine to adjust..."
            />
          </div>
        )}
        {wine && (
          <div style={{ padding: "8px 12px", borderRadius: 10, background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", marginBottom: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{wine.wine_name}</span>
            <span style={{ color: "var(--color-text-tertiary)", marginLeft: 6 }}>
              ({wine.bottle_count || 0} in stock)
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: mode === "receive" ? "1fr 1fr" : "1fr 1fr", gap: "0 14px" }}>
          <div>
            <label className="label">
              {mode === "receive" ? "Quantity Received *" : "Quantity Change *"}
            </label>
            <input
              type="number"
              className="input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={mode === "receive" ? "e.g. 6" : "e.g. -1 or +3"}
            />
          </div>

          {mode === "adjust" && (
            <div>
              <label className="label">Reason</label>
              <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="adjustment">Adjustment</option>
                <option value="census">Census correction</option>
                <option value="breakage">Breakage</option>
                <option value="gift">Gift / comp</option>
              </select>
            </div>
          )}

          {mode === "receive" && (
            <>
              <div>
                <label className="label">Unit Cost (€)</label>
                <input type="number" step="0.01" className="input" value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)} placeholder="e.g. 8.50" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Supplier</label>
                <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Vinarius S.r.l." />
              </div>
            </>
          )}

          {unitCost && quantity && mode === "receive" && (
            <div style={{ gridColumn: "1 / -1", padding: "8px 12px", borderRadius: 8, background: "var(--color-nav-active)", fontSize: 12, marginTop: 4 }}>
              Total cost: <strong>€{(parseFloat(unitCost) * parseInt(quantity || 0)).toFixed(2)}</strong>
            </div>
          )}

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Notes</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="Optional notes..." />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-tertiary)" }}>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : mode === "receive" ? "Record Delivery" : "Apply Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
