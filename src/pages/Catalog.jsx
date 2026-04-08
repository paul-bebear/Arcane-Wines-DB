import { useState, useEffect, useMemo } from "react";
import { usePaginatedWines } from "../hooks/usePaginatedWines.js";
import { parseNLQuery, buildChips } from "../lib/parseNLQuery.js";
import { supabase } from "../lib/supabaseClient.js";
import { glassLabel, formatLabel } from "../lib/displayMaps.js";
import TypeBadge from "../components/TypeBadge.jsx";
import WineForm from "../components/WineForm.jsx";
import WineDetail from "../components/WineDetail.jsx";
import QuickStock from "../components/QuickStock.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { CLR, BRAND, ACCENT } from "../theme.js";
import { i18n } from "../i18n.js";

function stockColor(n) {
  if (n === 0) return CLR.red;
  if (n < 3) return CLR.amber;
  return CLR.green;
}

export default function Catalog() {
  const {
    wines, loading, reload, page, setPage, totalPages, totalCount, pageSize,
    search, setSearch, typeFilter, setTypeFilter, regionFilter, setRegionFilter,
    producerFilter, setProducerFilter, maxPrice, setMaxPrice,
    reservedOnly, setReservedOnly, inStockOnly, setInStockOnly,
    sortBy, setSortBy,
  } = usePaginatedWines({ pageSize: 50 });

  const { role } = useAuth();
  const t = i18n.en;

  // Producers & regions for filter dropdowns + form
  const [producers2, setProducers2] = useState([]);
  const [regions2, setRegions2] = useState([]);
  const [types, setTypes] = useState([]);
  const [allProducerNames, setAllProducerNames] = useState([]);
  const [allRegionNames, setAllRegionNames] = useState([]);

  useEffect(() => {
    supabase.from("producers").select("id,name,country,comune").order("name").then(({ data }) => setProducers2(data || []));
    supabase.from("regions").select("id,region_name,country").order("region_name").then(({ data }) => setRegions2(data || []));
    // Fetch distinct values for filter dropdowns
    supabase.from("wine_catalog").select("wine_type").then(({ data }) => {
      const t = [...new Set((data || []).map(d => d.wine_type).filter(Boolean))].sort();
      setTypes(t);
    });
    supabase.from("wine_catalog").select("producer_name").then(({ data }) => {
      const p = [...new Set((data || []).map(d => d.producer_name).filter(Boolean))].sort();
      setAllProducerNames(p);
    });
    supabase.from("wine_catalog").select("region_name").then(({ data }) => {
      const r = [...new Set((data || []).map(d => d.region_name).filter(Boolean))].sort();
      setAllRegionNames(r);
    });
  }, []);

  // UI state
  const [editingWine, setEditingWine] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [detailWine, setDetailWine] = useState(null);
  const [stockWine, setStockWine] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // NL query
  const [nlInput, setNlInput] = useState("");
  const [nlResults, setNlResults] = useState(null);
  const [nlLoading, setNlLoading] = useState(false);

  const openAdd = () => { setEditingWine(null); setShowForm(true); };
  const openEdit = (w) => { setEditingWine(w); setShowForm(true); setDetailWine(null); };
  const closeForm = () => { setShowForm(false); setEditingWine(null); };
  const onSaved = () => { closeForm(); reload(); };

  const handleNlQuery = async () => {
    if (!nlInput.trim()) return;
    setNlLoading(true);
    setNlResults(null);
    try {
      const parsed = parseNLQuery(nlInput);
      const qp = [];
      qp.push(parsed.select ? `select=${encodeURIComponent(parsed.select)}` : "select=*");
      if (parsed.filters) parsed.filters.forEach((f) => qp.push(f));
      if (parsed.order) qp.push(`order=${parsed.order}`);
      if (parsed.limit) qp.push(`limit=${parsed.limit}`);

      const url = `${supabase.supabaseUrl}/rest/v1/${parsed.table}?${qp.join("&")}`;
      const res = await fetch(url, {
        headers: {
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${supabase.supabaseKey}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      setNlResults({ query: parsed, data: Array.isArray(data) ? data : [], chips: buildChips(parsed.filters, parsed.order) });
    } catch (e) {
      setNlResults({ query: {}, data: [], error: e.message, chips: [] });
    }
    setNlLoading(false);
  };

  // Pagination range
  const pageNumbers = useMemo(() => {
    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Catalog</h1>
          <p className="page-subtitle">
            {totalCount.toLocaleString()} wines · Page {page} of {totalPages || 1}
          </p>
        </div>
        {role === "owner" && (
          <button onClick={openAdd} className="btn btn-primary">+ Add Wine</button>
        )}
      </div>

      {/* ── NL query bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={nlInput}
          onChange={(e) => setNlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleNlQuery()}
          placeholder='Ask anything… e.g. "red wines under €50 from Piemonte"'
          className="input"
          style={{ flex: 1 }}
        />
        <button onClick={handleNlQuery} disabled={nlLoading} className="btn btn-primary">
          {nlLoading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Ask"}
        </button>
      </div>

      {/* ── NL results ──────────────────────────────────────────────────── */}
      {nlResults && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(nlResults.chips || []).map((c, i) => (
                <span key={i} className="badge badge-pill" style={{ background: BRAND + "22", color: BRAND, border: `1px solid ${BRAND}44` }}>{c}</span>
              ))}
            </div>
            <button onClick={() => setNlResults(null)} className="btn btn-ghost" style={{ fontSize: 16 }}>×</button>
          </div>
          {nlResults.error ? (
            <div style={{ color: "#991b1b", fontSize: 12 }}>{nlResults.error}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {nlResults.data.length} results from <code style={{ fontSize: 11 }}>{nlResults.query.table}</code>
              {nlResults.data.length > 0 && (
                <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
                  {nlResults.data.slice(0, 20).map((row, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between" }}>
                      <span>{row.wine_name || row.name || JSON.stringify(row).slice(0, 80)}</span>
                      {row.table_price != null && <span style={{ fontWeight: 600 }}>€{row.table_price}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Search + sort + filter ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t.search}
          className="input"
          style={{ flex: 1, minWidth: 160 }}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="select" style={{ width: "auto", minWidth: 140 }}>
          <option value="">{t.sortDefault}</option>
          <option value="price_asc">{t.sortPriceAsc}</option>
          <option value="price_desc">{t.sortPriceDesc}</option>
          <option value="name_asc">{t.sortNameAz}</option>
          <option value="vintage_desc">{t.sortVintageNew}</option>
          <option value="stock_asc">Stock: low first</option>
        </select>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${showFilters ? "btn-primary" : "btn-secondary"}`}
        >
          {t.filters}
        </button>
      </div>

      {showFilters && (
        <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, padding: 12 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select" style={{ width: "auto" }}>
            <option value="">{t.allTypes}</option>
            {types.map(ty => <option key={ty} value={ty}>{ty}</option>)}
          </select>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="select" style={{ width: "auto" }}>
            <option value="">{t.allRegions}</option>
            {allRegionNames.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={producerFilter} onChange={(e) => setProducerFilter(e.target.value)} className="select" style={{ width: "auto" }}>
            <option value="">{t.allProducers}</option>
            {allProducerNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={t.maxPrice} className="input" style={{ width: 100 }} />
          <label className="checkbox-label">
            <input type="checkbox" checked={reservedOnly} onChange={(e) => setReservedOnly(e.target.checked)} />
            {t.reservedOnly}
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            {t.inStockOnly}
          </label>
        </div>
      )}

      {/* ── Wine list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} className="animate-stagger">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : wines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">{t.noResults}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} className="animate-stagger">
          {wines.map((w) => {
            const sc = stockColor(w.bottle_count);
            return (
              <div
                key={w.id}
                className="wine-card"
                onClick={() => role === "owner" ? setDetailWine(w) : null}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
                    <TypeBadge type={w.wine_type} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {w.wine_name}{" "}
                        {w.vintage && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>{w.vintage}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {w.producer_name} · {w.region_name}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                    {/* Quick stock buttons (owner, on hover) */}
                    {role === "owner" && (
                      <div className="wine-card-actions" style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setStockWine(w); }}
                          className="btn btn-ghost btn-sm"
                          title="Quick stock adjustment"
                        >
                          📦
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(w); }}
                          className="btn btn-ghost btn-sm"
                          title="Edit wine"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {w.table_price != null ? `€${w.table_price}` : "—"}
                    </span>
                    {role === "owner" && w.buy_price != null && (
                      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                        (€{w.buy_price})
                      </span>
                    )}
                    <span className="badge" style={{ background: sc.bg, color: sc.text }}>
                      {w.bottle_count ?? 0}
                    </span>
                    {w.reserved_list && (
                      <span className="badge" style={{ background: CLR.red.bg, color: CLR.red.text }}>R</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage(1)}
            disabled={page === 1}
          >
            ««
          </button>
          <button
            className="pagination-btn"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            ‹
          </button>
          {pageNumbers[0] > 1 && <span className="pagination-info">…</span>}
          {pageNumbers.map((p) => (
            <button
              key={p}
              className={`pagination-btn${p === page ? " active" : ""}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="pagination-info">…</span>}
          <button
            className="pagination-btn"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            ›
          </button>
          <button
            className="pagination-btn"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
          >
            »»
          </button>
          <span className="pagination-info">
            {totalCount.toLocaleString()} wines
          </span>
        </div>
      )}

      {/* ── Wine detail slide-out ─────────────────────────────────────── */}
      {detailWine && (
        <WineDetail
          wine={detailWine}
          onClose={() => setDetailWine(null)}
          onEdit={(w) => { openEdit(w); setDetailWine(null); }}
          onAdjustStock={(w) => { setStockWine(w); setDetailWine(null); }}
          onOpenBtg={() => setDetailWine(null)}
        />
      )}

      {/* ── Quick stock modal ─────────────────────────────────────────── */}
      {stockWine && (
        <QuickStock
          wine={stockWine}
          onSave={() => { setStockWine(null); reload(); }}
          onCancel={() => setStockWine(null)}
        />
      )}

      {/* ── Wine form modal ──────────────────────────────────────────── */}
      {showForm && (
        <WineForm
          wine={editingWine}
          producers={producers2}
          regions={regions2}
          onSave={onSaved}
          onCancel={closeForm}
          onDelete={onSaved}
        />
      )}
    </div>
  );
}
