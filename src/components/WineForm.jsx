import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { BRAND } from "../theme.js";

const WINE_TYPES = [
  "Rosso", "Bianco", "Rosato", "Bollicine", "Orange",
  "Dolce", "Passito", "Birra/Cidre", "Zero Alcohol",
];

const GLASS_TYPES = [
  "Calice grande Bordeaux",
  "Calice medio",
  "Calice medio bianco",
  "Calice grande Borgogna",
];

const FORMATS = [
  "0.375L", "0.5L", "0.75L", "1L", "1.5L", "3L", "6L",
];

const FIELD = "input";
const LABEL = "label";


export default function WineForm({ wine, producers, regions, onSave, onCancel, onDelete }) {
  const isNew = !wine;

  const [form, setForm] = useState({
    name: "",
    wine_type: "Rosso",
    producer_id: "",
    region_id: "",
    vintage: "",
    grapes: "",
    buy_price: "",
    table_price: "",
    takeaway_available: false,
    takeaway_price: "",
    reserved_list: false,
    format: "0.75L",
    bottle_count: "",
    shelf_location: "",
    glass_type: "Calice medio bianco",
    notes: "",
    location: "Milan",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Populate form when editing
  useEffect(() => {
    if (wine) {
      // Find producer_id and region_id from names (wine_catalog view doesn't expose IDs)
      const prod = producers.find(p => p.name === wine.producer_name);
      const reg = regions.find(r => r.region_name === wine.region_name);

      setForm({
        name: wine.wine_name || "",
        wine_type: wine.wine_type || "Rosso",
        producer_id: prod?.id || "",
        region_id: reg?.id || "",
        vintage: wine.vintage ?? "",
        grapes: wine.grapes || "",
        buy_price: wine.buy_price ?? "",
        table_price: wine.table_price ?? "",
        takeaway_available: wine.takeaway_available || false,
        takeaway_price: wine.takeaway_price ?? "",
        reserved_list: wine.reserved_list || false,
        format: wine.format || "0.75L",
        bottle_count: wine.bottle_count ?? "",
        shelf_location: wine.shelf_location || "",
        glass_type: wine.glass_type || "Calice medio bianco",
        notes: wine.notes || "",
        location: wine.location || "Milan",
      });
    }
  }, [wine, producers, regions]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Wine name is required"); return; }
    if (!form.producer_id) { setError("Producer is required"); return; }
    if (!form.region_id) { setError("Region is required"); return; }

    setSaving(true);
    setError(null);

    // ── Normalized records for each table ──
    const wineRecord = {
      name: form.name.trim(),
      wine_type: form.wine_type,
      producer_id: form.producer_id,
      region_id: form.region_id,
      vintage: form.vintage ? parseInt(form.vintage) : null,
      grapes: form.grapes.trim() || null,
      format: form.format,
      glass_type: form.glass_type,
      notes: form.notes.trim() || null,
      reserved_list: form.reserved_list,
      // Keep legacy columns in sync (safety net for btg_margin_analysis etc.)
      buy_price: form.buy_price !== "" ? parseFloat(form.buy_price) : null,
      table_price: form.table_price !== "" ? parseFloat(form.table_price) : null,
      takeaway_available: form.takeaway_available,
      takeaway_price: form.takeaway_price !== "" ? parseFloat(form.takeaway_price) : null,
      bottle_count: form.bottle_count !== "" ? parseInt(form.bottle_count) : 0,
      shelf_location: form.shelf_location.trim() || null,
      location: form.location.trim() || "Milan",
    };

    const priceRecord = {
      buy_price: form.buy_price !== "" ? parseFloat(form.buy_price) : null,
      table_price: form.table_price !== "" ? parseFloat(form.table_price) : null,
      takeaway_price: form.takeaway_price !== "" ? parseFloat(form.takeaway_price) : null,
      takeaway_available: form.takeaway_available,
      effective_date: new Date().toISOString().slice(0, 10),
    };

    const invRecord = {
      location: form.location.trim() || "Milan",
      shelf_location: form.shelf_location.trim() || null,
      quantity: form.bottle_count !== "" ? parseInt(form.bottle_count) : 0,
      census_date: new Date().toISOString().slice(0, 10),
    };

    try {
      if (isNew) {
        // 1. Insert wine identity → get ID
        const { data: newWine, error: e1 } = await supabase
          .from("wines").insert(wineRecord).select("id").single();
        if (e1) throw e1;

        // 2. Insert versioned pricing
        const { error: e2 } = await supabase
          .from("wine_prices").insert({ wine_id: newWine.id, ...priceRecord });
        if (e2) throw e2;

        // 3. Insert inventory
        const { error: e3 } = await supabase
          .from("inventory").insert({ wine_id: newWine.id, ...invRecord });
        if (e3) throw e3;
      } else {
        // 1. Update wine identity + legacy columns
        const { error: e1 } = await supabase
          .from("wines").update(wineRecord).eq("id", wine.id);
        if (e1) throw e1;

        // 2. Insert new pricing row (versioned history)
        const { error: e2 } = await supabase
          .from("wine_prices").insert({ wine_id: wine.id, ...priceRecord });
        if (e2) throw e2;

        // 3. Upsert inventory
        const { data: existingInv } = await supabase
          .from("inventory").select("id").eq("wine_id", wine.id).limit(1).maybeSingle();

        if (existingInv) {
          const { error: e3 } = await supabase
            .from("inventory").update(invRecord).eq("id", existingInv.id);
          if (e3) throw e3;
        } else {
          const { error: e3 } = await supabase
            .from("inventory").insert({ wine_id: wine.id, ...invRecord });
          if (e3) throw e3;
        }
      }
      onSave();
    } catch (e) {
      console.error("Save failed:", e);
      setError(e.message || "Save failed — check RLS policies");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!wine?.id) return;
    if (!confirm(`Delete "${wine.wine_name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from("wines").delete().eq("id", wine.id);
      if (err) throw err;
      onDelete?.();
    } catch (e) {
      setError(e.message || "Delete failed");
    }
    setSaving(false);
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520, maxHeight: "90vh", overflowY: "auto",
          background: "var(--color-background-secondary)",
          borderRadius: 16, border: "1px solid var(--color-border-tertiary)",
          padding: "24px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", margin: 0, color: "var(--color-text-primary)" }}>
            {isNew ? "Add Wine" : "Edit Wine"}
          </h2>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-text-tertiary)" }}>×</button>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, background: "#fee2e2", color: "#991b1b", marginBottom: 8 }}>
            {error}
          </div>
        )}

        {/* ── Form fields ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL}>Wine Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Type *</label>
            <select value={form.wine_type} onChange={e => set("wine_type", e.target.value)} style={FIELD}>
              {WINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Vintage</label>
            <input type="number" value={form.vintage} onChange={e => set("vintage", e.target.value)} placeholder="e.g. 2022" style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Producer *</label>
            <select value={form.producer_id} onChange={e => set("producer_id", e.target.value)} style={FIELD}>
              <option value="">Select...</option>
              {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Region *</label>
            <select value={form.region_id} onChange={e => set("region_id", e.target.value)} style={FIELD}>
              <option value="">Select...</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.region_name}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL}>Grapes</label>
            <input value={form.grapes} onChange={e => set("grapes", e.target.value)} placeholder="e.g. nebbiolo, barbera" style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Buy Price (€)</label>
            <input type="number" step="0.01" value={form.buy_price} onChange={e => set("buy_price", e.target.value)} style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Table Price (€)</label>
            <input type="number" step="0.01" value={form.table_price} onChange={e => set("table_price", e.target.value)} style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Format</label>
            <select value={form.format} onChange={e => set("format", e.target.value)} style={FIELD}>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Bottle Count</label>
            <input type="number" value={form.bottle_count} onChange={e => set("bottle_count", e.target.value)} style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Glass Type</label>
            <select value={form.glass_type} onChange={e => set("glass_type", e.target.value)} style={FIELD}>
              {GLASS_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Shelf Location</label>
            <input value={form.shelf_location} onChange={e => set("shelf_location", e.target.value)} placeholder="e.g. CS2-4" style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>Storage City</label>
            <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Milan" style={FIELD} />
          </div>

          <div>
            <label style={LABEL}>
              <input type="checkbox" checked={form.takeaway_available} onChange={e => set("takeaway_available", e.target.checked)} style={{ marginRight: 6 }} />
              Takeaway Available
            </label>
          </div>

          {form.takeaway_available && (
            <div>
              <label style={LABEL}>Takeaway Price (€)</label>
              <input type="number" step="0.01" value={form.takeaway_price} onChange={e => set("takeaway_price", e.target.value)} style={FIELD} />
            </div>
          )}

          <div>
            <label style={LABEL}>
              <input type="checkbox" checked={form.reserved_list} onChange={e => set("reserved_list", e.target.checked)} style={{ marginRight: 6 }} />
              Reserved List
            </label>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...FIELD, resize: "vertical" }} />
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-tertiary)" }}>
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#fee2e2", color: "#991b1b", border: "none" }}
              >
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancel}
              style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-tertiary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: BRAND, color: "#fff", border: "none", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving..." : isNew ? "Add Wine" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
