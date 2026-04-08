import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import WineSelector from "./WineSelector.jsx";

/**
 * BTG session management modal.
 * Modes: open (create new session), pour (add glass), close.
 */
export default function BtgSessionForm({ mode = "open", session, onSave, onCancel }) {
  // Open mode
  const [selectedWineId, setSelectedWineId] = useState(null);
  const [pricePerGlass, setPricePerGlass] = useState("");
  const [glassesTarget, setGlassesTarget] = useState("6");

  // Pour mode
  const [pourAmount, setPourAmount] = useState("125");
  const [priceCharged, setPriceCharged] = useState(session?.price_per_glass || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleOpen = async () => {
    if (!selectedWineId) { setError("Select a wine"); return; }
    if (!pricePerGlass || parseFloat(pricePerGlass) <= 0) { setError("Set price per glass"); return; }

    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.from("btg_sessions").insert({
        wine_id: selectedWineId,
        session_date: new Date().toISOString().slice(0, 10),
        price_per_glass: parseFloat(pricePerGlass),
        glasses_target: parseInt(glassesTarget) || 6,
        glasses_poured: 0,
        status: "open",
      });
      if (err) throw err;

      // Also create a movement record for the opened bottle
      await supabase.from("inventory_movements").insert({
        wine_id: selectedWineId,
        quantity_change: -1,
        movement_type: "sale",
        source: "btg",
        notes: "Bottle opened for BTG service",
      });

      // Decrement stock
      const { data: inv } = await supabase
        .from("inventory").select("id,quantity").eq("wine_id", selectedWineId).limit(1).maybeSingle();
      if (inv) {
        await supabase.from("inventory").update({ quantity: Math.max(0, inv.quantity - 1) }).eq("id", inv.id);
      }
      const { data: wineRow } = await supabase
        .from("wines").select("bottle_count").eq("id", selectedWineId).maybeSingle();
      if (wineRow) {
        await supabase.from("wines").update({ bottle_count: Math.max(0, (wineRow.bottle_count || 0) - 1) }).eq("id", selectedWineId);
      }

      onSave?.();
    } catch (e) {
      setError(e.message || "Failed to open session");
    }
    setSaving(false);
  };

  const handlePour = async () => {
    if (!session?.id) return;
    setSaving(true);
    setError(null);
    try {
      // Insert pour
      const { error: err } = await supabase.from("btg_pours").insert({
        session_id: session.id,
        pour_amount_ml: parseInt(pourAmount) || 125,
        price_charged: parseFloat(priceCharged) || session.price_per_glass,
      });
      if (err) throw err;

      // Increment glasses_poured
      await supabase.from("btg_sessions")
        .update({ glasses_poured: (session.glasses_poured || 0) + 1 })
        .eq("id", session.id);

      onSave?.();
    } catch (e) {
      setError(e.message || "Failed to record pour");
    }
    setSaving(false);
  };

  const handleClose = async () => {
    if (!session?.id) return;
    setSaving(true);
    try {
      await supabase.from("btg_sessions").update({ status: "closed" }).eq("id", session.id);
      onSave?.();
    } catch (e) {
      setError(e.message || "Failed to close session");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === "open" ? "🍷 Open Bottle for BTG" : mode === "pour" ? "🥂 Pour Glass" : "Close Session"}
          </h2>
          <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize: 18 }}>×</button>
        </div>

        {error && <div className="alert alert-critical" style={{ marginBottom: 12 }}>{error}</div>}

        {mode === "open" && (
          <>
            <div>
              <label className="label">Wine *</label>
              <WineSelector
                value={selectedWineId}
                onChange={(id) => setSelectedWineId(id)}
                placeholder="Search wine to open..."
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
              <div>
                <label className="label">Price Per Glass (€) *</label>
                <input type="number" step="0.50" className="input" value={pricePerGlass}
                  onChange={(e) => setPricePerGlass(e.target.value)} placeholder="e.g. 8.00" />
              </div>
              <div>
                <label className="label">Glasses Target</label>
                <input type="number" className="input" value={glassesTarget}
                  onChange={(e) => setGlassesTarget(e.target.value)} placeholder="6" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-tertiary)" }}>
              <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
              <button onClick={handleOpen} disabled={saving} className="btn btn-primary">
                {saving ? "Opening..." : "Open Bottle"}
              </button>
            </div>
          </>
        )}

        {mode === "pour" && session && (
          <>
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", marginBottom: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{session.wines?.name || "Wine"}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                Glasses poured: {session.glasses_poured || 0} / {session.glasses_target || "?"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
              <div>
                <label className="label">Pour Amount (ml)</label>
                <select className="select" value={pourAmount} onChange={(e) => setPourAmount(e.target.value)}>
                  <option value="100">100ml</option>
                  <option value="125">125ml (standard)</option>
                  <option value="150">150ml</option>
                  <option value="175">175ml (large)</option>
                </select>
              </div>
              <div>
                <label className="label">Price Charged (€)</label>
                <input type="number" step="0.50" className="input" value={priceCharged}
                  onChange={(e) => setPriceCharged(e.target.value)}
                  placeholder={`${session.price_per_glass}`} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-tertiary)" }}>
              <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
              <button onClick={handlePour} disabled={saving} className="btn btn-primary">
                {saving ? "Pouring..." : "Record Pour"}
              </button>
            </div>
          </>
        )}

        {mode === "close" && session && (
          <>
            <div style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "var(--color-text-primary)", marginBottom: 8 }}>
                Close the session for <strong>{session.wines?.name || "this wine"}</strong>?
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Glasses poured: {session.glasses_poured || 0} / {session.glasses_target || "?"}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border-tertiary)" }}>
              <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
              <button onClick={handleClose} disabled={saving} className="btn btn-danger">
                {saving ? "Closing..." : "Close Session"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
