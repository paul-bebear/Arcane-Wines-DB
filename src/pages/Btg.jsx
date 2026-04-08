import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";
import BtgSessionForm from "../components/BtgSessionForm.jsx";
import { CLR, ACCENT, BRAND } from "../theme.js";

export default function Btg() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "open" | "closed"
  const [modal, setModal] = useState(null); // { mode, session }

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("btg_sessions")
      .select("id,wine_id,session_date,price_per_glass,glasses_target,glasses_poured,status,wines(name,wine_type,buy_price)")
      .order("session_date", { ascending: false });

    if (filter === "open") query = query.eq("status", "open");
    if (filter === "closed") query = query.eq("status", "closed");

    const { data } = await query.limit(100);
    setSessions(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onModalSave = () => {
    setModal(null);
    load();
  };

  const openCount = sessions.filter(s => s.status === "open").length;

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><div className="skeleton skeleton-title" /></div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">By the Glass</h1>
          <p className="page-subtitle">
            {sessions.length} sessions · {openCount} currently open
          </p>
        </div>
        <button onClick={() => setModal({ mode: "open" })} className="btn btn-primary">
          🍷 Open Bottle
        </button>
      </div>

      {/* Filter */}
      <div className="period-toggle" style={{ marginBottom: 20, display: "inline-flex" }}>
        {["all", "open", "closed"].map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "open" ? "Open" : "Closed"}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🥂</div>
          <div className="empty-state-text">No BTG sessions yet</div>
          <button onClick={() => setModal({ mode: "open" })} className="btn btn-primary">Open your first bottle</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} className="animate-stagger">
          {sessions.map((s) => {
            const isOpen = s.status === "open";
            const pct = s.glasses_target > 0 ? Math.min(100, (s.glasses_poured / s.glasses_target) * 100) : 0;
            const bottleCost = s.wines?.buy_price || 0;
            const revenue = (s.glasses_poured || 0) * (s.price_per_glass || 0);
            const profit = revenue - bottleCost;
            const revColor = profit >= 0 ? ACCENT.green : "#ef4444";

            // Spoilage warning
            const hoursSinceOpen = isOpen
              ? (Date.now() - new Date(s.session_date).getTime()) / (1000 * 60 * 60)
              : 0;
            const stale = isOpen && hoursSinceOpen > 48;

            return (
              <div key={s.id} className="card" style={{
                padding: 16,
                borderColor: stale ? "#fca5a5" : isOpen ? CLR.green.text + "44" : "var(--color-border-tertiary)",
              }}>
                {stale && (
                  <div style={{
                    padding: "4px 10px", borderRadius: 6, background: "#fee2e2",
                    color: "#991b1b", fontSize: 10, fontWeight: 600, marginBottom: 8,
                  }}>
                    ⚠ Open for {Math.round(hoursSinceOpen)}h — spoilage risk
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {s.wines?.name || "Unknown"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {s.session_date} · €{s.price_per_glass}/glass
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge badge-pill" style={{
                      background: isOpen ? CLR.green.bg : CLR.gray.bg,
                      color: isOpen ? CLR.green.text : CLR.gray.text,
                    }}>
                      {s.status}
                    </span>
                    {isOpen && (
                      <>
                        <button
                          onClick={() => setModal({ mode: "pour", session: s })}
                          className="btn btn-primary btn-sm"
                        >
                          🥂 Pour
                        </button>
                        <button
                          onClick={() => setModal({ mode: "close", session: s })}
                          className="btn btn-secondary btn-sm"
                        >
                          Close
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "var(--color-text-secondary)" }}>
                    <span>{s.glasses_poured || 0} / {s.glasses_target || "?"} glasses</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? ACCENT.green : pct >= 60 ? "#eab308" : BRAND,
                    }} />
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 6 }}>
                  {[
                    { label: "Cost", value: `€${bottleCost}`, color: "var(--color-text-primary)" },
                    { label: "Revenue", value: `€${revenue.toFixed(0)}`, color: revColor },
                    { label: "Profit", value: `€${profit.toFixed(0)}`, color: revColor },
                    { label: "ROI", value: bottleCost > 0 ? `${((revenue / bottleCost) * 100).toFixed(0)}%` : "—", color: revenue >= bottleCost ? ACCENT.green : "#ef4444" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: 8, borderRadius: 8, background: "var(--color-background-primary)", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <BtgSessionForm
          mode={modal.mode}
          session={modal.session}
          onSave={onModalSave}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
