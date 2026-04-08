import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";
import TypeBadge from "./TypeBadge.jsx";

/**
 * Searchable autocomplete wine picker.
 * Replaces plain <select> dropdowns for wine selection.
 * Debounces input → Supabase ilike query → shows top results.
 */
export default function WineSelector({ value, onChange, placeholder, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Display label for selected wine
  const [selectedLabel, setSelectedLabel] = useState("");

  // Load selected wine name on mount/value change
  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("wine_catalog")
        .select("wine_name,producer_name,wine_type")
        .eq("id", value)
        .limit(1)
        .maybeSingle();
      if (data) {
        setSelectedLabel(`${data.wine_name} — ${data.producer_name}`);
      }
    })();
  }, [value]);

  // Search wines
  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const s = `%${q}%`;
      const { data } = await supabase
        .from("wine_catalog")
        .select("id,wine_name,producer_name,wine_type,vintage,table_price,bottle_count")
        .or(`wine_name.ilike.${s},producer_name.ilike.${s},grapes.ilike.${s}`)
        .order("wine_name", { ascending: true })
        .limit(12);
      setResults(data || []);
    } catch (e) {
      console.error("Wine search failed:", e);
    }
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (wine) => {
    onChange(wine.id, wine);
    setSelectedLabel(`${wine.wine_name} — ${wine.producer_name}`);
    setQuery("");
    setOpen(false);
    setHighlighted(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null, null);
    setSelectedLabel("");
    setQuery("");
    setResults([]);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      {/* Selected display */}
      {value && !open ? (
        <div
          onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); } }}
          className="input"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{selectedLabel}</span>
          {!disabled && (
            <button
              onClick={handleClear}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-text-tertiary)", fontSize: 14, padding: "0 2px",
              }}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <input
          ref={inputRef}
          className="input"
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(-1); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search wines..."}
          disabled={disabled}
          autoComplete="off"
        />
      )}

      {/* Dropdown */}
      {open && (query.length >= 2 || results.length > 0) && (
        <div className="autocomplete-dropdown">
          {loading && (
            <div className="autocomplete-empty">
              <div className="spinner" style={{ width: 16, height: 16, margin: "0 auto" }} />
            </div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="autocomplete-empty">No wines found</div>
          )}
          {!loading && results.map((w, i) => (
            <div
              key={w.id}
              className={`autocomplete-option${i === highlighted ? " highlighted" : ""}`}
              onClick={() => handleSelect(w)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <TypeBadge type={w.wine_type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.wine_name}
                  {w.vintage && <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)", marginLeft: 4 }}>{w.vintage}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                  {w.producer_name}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {w.table_price != null && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>€{w.table_price}</div>
                )}
                <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{w.bottle_count || 0} btl</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
