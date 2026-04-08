import { useState, useMemo } from "react";
import { useMovements } from "../hooks/useWines.js";
import { CLR } from "../theme.js";

const PAGE_SIZE = 50;

function typeColor(mt) {
  if (mt === "sale")    return CLR.blue;
  if (mt === "restock") return CLR.green;
  return CLR.amber;
}

export default function Movements() {
  const { movements, loading } = useMovements();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let data = movements;
    if (typeFilter) data = data.filter(m => m.movement_type === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(m => (m.wines?.name || "").toLowerCase().includes(s) || (m.source || "").toLowerCase().includes(s));
    }
    return data;
  }, [movements, typeFilter, search]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const remaining = filtered.length - visible.length;
  const types = [...new Set(movements.map(m => m.movement_type).filter(Boolean))].sort();

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><div className="skeleton skeleton-title" /></div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton skeleton-text" style={{ height: 36 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Movements</h1>
          <p className="page-subtitle">{filtered.length.toLocaleString()} records{typeFilter ? ` · ${typeFilter}` : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search wine or source..."
          className="input"
          style={{ flex: 1, minWidth: 160 }}
        />
        <div className="period-toggle">
          <button className={typeFilter === "" ? "active" : ""} onClick={() => { setTypeFilter(""); setPage(1); }}>All</button>
          {types.map(ty => (
            <button key={ty} className={typeFilter === ty ? "active" : ""} onClick={() => { setTypeFilter(ty); setPage(1); }}>
              {ty}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-text">No movements match your filters</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  {["Date", "Wine", "Qty", "Type", "Source", "Receipt"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(m => {
                  const c = typeColor(m.movement_type);
                  return (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--color-text-secondary)" }}>
                        {new Date(m.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.wines?.name || "—"}</td>
                      <td style={{ fontWeight: 600, color: m.quantity_change > 0 ? CLR.green.text : CLR.red.text }}>
                        {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                      </td>
                      <td>
                        <span className="badge" style={{ background: c.bg, color: c.text }}>{m.movement_type}</span>
                      </td>
                      <td style={{ color: "var(--color-text-secondary)" }}>{m.source || "—"}</td>
                      <td style={{ color: "var(--color-text-tertiary)", fontFamily: "monospace", fontSize: 10 }}>{m.pos_receipt_id || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {remaining > 0 && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <button onClick={() => setPage(p => p + 1)} className="btn btn-secondary">
            Load more ({remaining.toLocaleString()} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
