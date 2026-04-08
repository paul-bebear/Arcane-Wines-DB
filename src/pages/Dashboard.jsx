import { useMemo, useState } from "react";
import { useWines, useOpenBottles, useMovements } from "../hooks/useWines.js";
import { useSalesVelocity } from "../hooks/useSalesVelocity.js";
import { useRevenue } from "../hooks/useRevenue.js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
} from "recharts";
import StatCard from "../components/StatCard.jsx";
import AlertPanel from "../components/AlertPanel.jsx";
import { BRAND, ACCENT, CLR } from "../theme.js";

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_PALETTE = {
  Rosso: "#dc2626", Bianco: "#ca8a04", Rosato: "#db2777",
  Bollicine: "#0284c7", Orange: "#ea580c", Dolce: "#9333ea",
  Passito: "#7c3aed", "Birra/Cidre": "#16a34a", "Zero Alcohol": "#0d9488",
  Unknown: "#6b7280",
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div className="section-header">
        <div className="section-title">{title}</div>
        {subtitle && <div className="section-subtitle">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniTable({ columns, rows, maxHeight }) {
  return (
    <div style={{ maxHeight: maxHeight || 320, overflowY: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={{
                  color: c.color?.(row) || undefined,
                  fontWeight: c.bold ? 600 : 400,
                  textAlign: c.align || "left",
                }}>
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return `€${Number(n).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n) {
  if (n == null || isNaN(n)) return "—";
  return `${Number(n).toFixed(1)}%`;
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip" style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: "8px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight: 600, marginBottom: 3, color: "var(--color-text-primary)" }}>
        {label || payload[0]?.name || payload[0]?.payload?.name}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "var(--color-text-secondary)" }}>
          {p.name}: {p.name === "Capital" ? fmt(p.value) : p.value?.toLocaleString("it-IT")}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { wines, loading } = useWines();
  const { openBottles, loading: btgLoading } = useOpenBottles();
  const { movements, loading: movLoading } = useMovements();
  const { deadStock, reorderSoon, fastMovers, loading: velLoading } = useSalesVelocity(wines);
  const { sales, btg, loading: revLoading } = useRevenue();
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let inventoryCost = 0, revenuePotential = 0, totalBottles = 0;
    const margins = [];

    for (const w of wines) {
      const b = w.bottle_count || 0;
      totalBottles += b;
      if (w.buy_price != null && b > 0) inventoryCost += w.buy_price * b;
      if (w.table_price != null && b > 0) revenuePotential += w.table_price * b;
      if (w.buy_price > 0 && w.table_price > 0) {
        margins.push(((w.table_price - w.buy_price) / w.table_price) * 100);
      }
    }

    const avgMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null;
    const avgMarkup = margins.length > 0
      ? wines.filter(w => w.buy_price > 0 && w.table_price > 0)
        .reduce((s, w) => s + w.table_price / w.buy_price, 0) / margins.length
      : null;

    return {
      totalWines: wines.length, totalBottles, inventoryCost, revenuePotential,
      potentialProfit: revenuePotential - inventoryCost,
      avgMargin, avgMarkup,
      lastBottle: wines.filter(w => w.bottle_count === 1).length,
      outOfStock: wines.filter(w => w.bottle_count === 0).length,
    };
  }, [wines]);

  // ── Realized Profit ──────────────────────────────────────────────────────
  const realized = useMemo(() => {
    if (revLoading) return null;
    let revenue = 0, cost = 0;
    for (const s of sales) {
      const qty = Math.abs(s.quantity_change);
      revenue += qty * (s.wines?.table_price || 0);
      cost += qty * (s.wines?.buy_price || 0);
    }
    for (const b of btg) {
      revenue += b.total_btg_revenue || 0;
      cost += b.bottle_cost || 0;
    }
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue * 100) : 0;
    return { revenue, cost, profit, margin };
  }, [sales, btg, revLoading]);

  // ── Margin Distribution ──────────────────────────────────────────────────
  const marginDistribution = useMemo(() => {
    const buckets = [
      { name: "<30%", min: -Infinity, max: 30, count: 0 },
      { name: "30-40%", min: 30, max: 40, count: 0 },
      { name: "40-50%", min: 40, max: 50, count: 0 },
      { name: "50-60%", min: 50, max: 60, count: 0 },
      { name: "60-70%", min: 60, max: 70, count: 0 },
      { name: "70-80%", min: 70, max: 80, count: 0 },
      { name: ">80%", min: 80, max: Infinity, count: 0 },
    ];
    for (const w of wines) {
      if (w.buy_price > 0 && w.table_price > 0) {
        const m = ((w.table_price - w.buy_price) / w.table_price) * 100;
        const b = buckets.find(b => m >= b.min && m < b.max);
        if (b) b.count++;
      }
    }
    return buckets;
  }, [wines]);

  // ── Top/Worst Margins ────────────────────────────────────────────────────
  const marginWines = useMemo(() => {
    const priced = wines
      .filter(w => w.buy_price > 0 && w.table_price > 0)
      .map(w => ({ ...w, marginPct: ((w.table_price - w.buy_price) / w.table_price) * 100 }));
    const sorted = [...priced].sort((a, b) => b.marginPct - a.marginPct);
    return { top: sorted.slice(0, 10), worst: [...priced].sort((a, b) => a.marginPct - b.marginPct).slice(0, 8) };
  }, [wines]);

  // ── Scatter (sampled to top 200 by value) ────────────────────────────────
  const scatterData = useMemo(() =>
    wines
      .filter(w => w.buy_price > 0 && w.table_price > 0)
      .sort((a, b) => (b.table_price * (b.bottle_count || 1)) - (a.table_price * (a.bottle_count || 1)))
      .slice(0, 200)
      .map(w => ({
        x: w.buy_price, y: w.table_price, name: w.wine_name,
        producer: w.producer_name, type: w.wine_type, z: w.bottle_count || 1,
      })),
  [wines]);

  // ── Portfolio Composition ────────────────────────────────────────────────
  const typeData = useMemo(() => {
    const map = {};
    for (const w of wines) {
      const t = w.wine_type || "Unknown";
      if (!map[t]) map[t] = { name: t, skus: 0, bottles: 0, value: 0, cost: 0 };
      map[t].skus++;
      map[t].bottles += w.bottle_count || 0;
      if (w.table_price && w.bottle_count) map[t].value += w.table_price * w.bottle_count;
      if (w.buy_price && w.bottle_count) map[t].cost += w.buy_price * w.bottle_count;
    }
    return Object.values(map).sort((a, b) => b.bottles - a.bottles);
  }, [wines]);

  const regionData = useMemo(() => {
    const map = {};
    for (const w of wines) {
      const r = w.region_name || "Unknown";
      if (!map[r]) map[r] = { name: r, bottles: 0, skus: 0, cost: 0 };
      map[r].bottles += w.bottle_count || 0;
      map[r].skus++;
      if (w.buy_price && w.bottle_count) map[r].cost += w.buy_price * w.bottle_count;
    }
    return Object.values(map).sort((a, b) => b.bottles - a.bottles).slice(0, 12);
  }, [wines]);

  const priceTiers = useMemo(() => {
    const buckets = [
      { name: "€0-25", min: 0, max: 25, count: 0, bottles: 0 },
      { name: "€26-50", min: 26, max: 50, count: 0, bottles: 0 },
      { name: "€51-80", min: 51, max: 80, count: 0, bottles: 0 },
      { name: "€81-120", min: 81, max: 120, count: 0, bottles: 0 },
      { name: "€121-200", min: 121, max: 200, count: 0, bottles: 0 },
      { name: "€200+", min: 201, max: Infinity, count: 0, bottles: 0 },
    ];
    for (const w of wines) {
      if (w.table_price == null) continue;
      const b = buckets.find(b => w.table_price >= b.min && w.table_price <= b.max);
      if (b) { b.count++; b.bottles += w.bottle_count || 0; }
    }
    return buckets;
  }, [wines]);

  // ── Stock Health ─────────────────────────────────────────────────────────
  const stockHealth = useMemo(() => {
    let outOfStock = 0, lastBottle = 0, low = 0, healthy = 0, overstock = 0;
    for (const w of wines) {
      const b = w.bottle_count || 0;
      if (b === 0) outOfStock++;
      else if (b === 1) lastBottle++;
      else if (b < 3) low++;
      else if (b >= 10) overstock++;
      else healthy++;
    }
    return [
      { name: "Out of stock", value: outOfStock, fill: "#ef4444" },
      { name: "Last bottle", value: lastBottle, fill: "#f97316" },
      { name: "Low (2)", value: low, fill: "#eab308" },
      { name: "Healthy (3-9)", value: healthy, fill: "#22c55e" },
      { name: "Deep stock (10+)", value: overstock, fill: "#3b82f6" },
    ].filter(d => d.value > 0);
  }, [wines]);

  // ── Capital ──────────────────────────────────────────────────────────────
  const capitalByType = useMemo(() =>
    typeData.filter(t => t.cost > 0).sort((a, b) => b.cost - a.cost), [typeData]);

  const topCapital = useMemo(() =>
    wines
      .filter(w => w.buy_price > 0 && w.bottle_count > 0)
      .map(w => ({ ...w, stockValue: w.buy_price * w.bottle_count }))
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10),
  [wines]);

  // ── Losing Money ─────────────────────────────────────────────────────────
  const losingMoney = useMemo(() =>
    wines
      .filter(w => w.buy_price > 0 && w.table_price > 0 && w.table_price < w.buy_price)
      .map(w => ({ ...w, loss: w.buy_price - w.table_price }))
      .sort((a, b) => b.loss - a.loss),
  [wines]);

  // ── Most Requested ───────────────────────────────────────────────────────
  const mostRequested = useMemo(() => {
    if (!movements.length) return [];
    const map = {};
    for (const m of movements) {
      if (m.movement_type !== "sale") continue;
      const wid = m.wine_id;
      if (!map[wid]) map[wid] = { wine_id: wid, name: m.wines?.name || "Unknown", totalSold: 0, txCount: 0 };
      map[wid].totalSold += Math.abs(m.quantity_change);
      map[wid].txCount++;
    }
    return Object.values(map).sort((a, b) => b.totalSold - a.totalSold).slice(0, 10);
  }, [movements]);

  // ── Open Bottles ─────────────────────────────────────────────────────────
  const openBottleStats = useMemo(() => {
    if (!openBottles.length) return { count: 0, items: [] };
    return {
      count: openBottles.length,
      items: openBottles.map(b => ({
        name: b.wines?.name || "Unknown", type: b.wines?.wine_type || "",
        date: b.session_date, poured: b.glasses_poured || 0,
        target: b.glasses_target || "?", pricePerGlass: b.price_per_glass,
      })),
    };
  }, [openBottles]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="skeleton skeleton-title" style={{ marginBottom: 8 }} />
            <div className="skeleton skeleton-text" style={{ width: 180 }} />
          </div>
        </div>
        <div className="grid-auto" style={{ marginBottom: 36 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-stat" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 60 }} className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Business intelligence for your cellar · {wines.length.toLocaleString()} wines
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* OPERATIONAL ALERTS                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AlertPanel
        wines={wines}
        openBottles={openBottles}
        deadStock={deadStock}
        reorderSoon={reorderSoon}
        collapsed={alertsCollapsed}
        onToggle={() => setAlertsCollapsed(c => !c)}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* KPI ROW — Potential                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Portfolio Overview
      </div>
      <div className="grid-auto" style={{ marginBottom: 20 }}>
        <StatCard label="Total SKUs" value={kpis.totalWines.toLocaleString()} />
        <StatCard label="Total Bottles" value={kpis.totalBottles.toLocaleString()} accent={ACCENT.green} />
        <StatCard label="Inventory Cost" value={fmt(kpis.inventoryCost)} />
        <StatCard label="Revenue Potential" value={fmt(kpis.revenuePotential)} accent={ACCENT.green} />
        <StatCard label="Potential Profit" value={fmt(kpis.potentialProfit)} accent={BRAND} />
        <StatCard label="Avg Margin" value={pct(kpis.avgMargin)} accent={BRAND} />
        <StatCard label="Avg Markup" value={kpis.avgMarkup ? `${kpis.avgMarkup.toFixed(1)}×` : "—"} />
        <StatCard label="Last Bottle" value={kpis.lastBottle} accent={ACCENT.orange} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* KPI ROW — Realized                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {realized && (realized.revenue > 0 || realized.cost > 0) && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Realized Performance
          </div>
          <div className="grid-auto" style={{ marginBottom: 36 }}>
            <StatCard label="Actual Revenue" value={fmt(realized.revenue)} accent={ACCENT.green} />
            <StatCard label="Actual Cost" value={fmt(realized.cost)} />
            <StatCard label="Actual Profit" value={fmt(realized.profit)} accent={realized.profit >= 0 ? ACCENT.green : "#ef4444"} />
            <StatCard label="Actual Margin" value={pct(realized.margin)} accent={realized.margin >= 30 ? ACCENT.green : "#eab308"} />
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LOSING MONEY ALERT                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {losingMoney.length > 0 && (
        <Section title={`⚠ Losing Money on ${losingMoney.length} Wine${losingMoney.length > 1 ? "s" : ""}`} subtitle="Table price below buy price — needs repricing">
          <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid #fca5a5" }}>
            <MiniTable
              maxHeight={240}
              columns={[
                { key: "wine_name", label: "Wine", render: (r) => <><span style={{ fontWeight: 500 }}>{r.wine_name}</span> <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{r.producer_name}</span></> },
                { key: "buy_price", label: "Buy", align: "right", render: (r) => fmt(r.buy_price) },
                { key: "table_price", label: "Table", align: "right", render: (r) => fmt(r.table_price) },
                { key: "loss", label: "Loss/Btl", align: "right", bold: true, color: () => "#ef4444", render: (r) => `-€${r.loss.toFixed(0)}` },
                { key: "bottle_count", label: "Stock", align: "right", render: (r) => r.bottle_count || 0 },
              ]}
              rows={losingMoney}
            />
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SALES VELOCITY & REORDER INTELLIGENCE                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!velLoading && (reorderSoon.length > 0 || deadStock.length > 0) && (
        <div className="grid-2">
          {reorderSoon.length > 0 && (
            <Section title="🔄 Reorder Soon" subtitle="High velocity + low stock — will run out soon">
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <MiniTable
                  maxHeight={280}
                  columns={[
                    { key: "wine_name", label: "Wine", bold: true },
                    { key: "daysRemaining", label: "Days Left", align: "right", bold: true, color: (r) => r.daysRemaining < 7 ? "#ef4444" : "#eab308" },
                    { key: "monthlyVelocity", label: "Sold/Mo", align: "right" },
                    { key: "bottle_count", label: "Stock", align: "right" },
                  ]}
                  rows={reorderSoon}
                />
              </div>
            </Section>
          )}
          {deadStock.length > 0 && (
            <Section title="💤 Dead Stock" subtitle="No sales in 30 days — capital sitting idle">
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <MiniTable
                  maxHeight={280}
                  columns={[
                    { key: "wine_name", label: "Wine", bold: true },
                    { key: "bottle_count", label: "Stock", align: "right" },
                    { key: "buy_price", label: "Buy €", align: "right", render: (r) => r.buy_price ? fmt(r.buy_price) : "—" },
                    { key: "daysSinceLastSale", label: "Last Sale", align: "right", render: (r) => r.daysSinceLastSale != null ? `${r.daysSinceLastSale}d ago` : "Never" },
                  ]}
                  rows={deadStock}
                />
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MARGIN INTELLIGENCE                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid-2">
        <Section title="Margin Distribution" subtitle="How consistently are you marking up?">
          <div className="card" style={{ padding: "16px 10px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={marginDistribution}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="Wines" radius={[4, 4, 0, 0]}>
                  {marginDistribution.map((_, i) => (
                    <Cell key={i} fill={i < 2 ? "#ef4444" : i < 4 ? "#eab308" : ACCENT.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Pricing Discipline" subtitle={`Buy vs table price — top ${scatterData.length} wines by value`}>
          <div className="card" style={{ padding: "16px 10px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                <XAxis type="number" dataKey="x" name="Buy €" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <YAxis type="number" dataKey="y" name="Table €" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <ZAxis type="number" dataKey="z" range={[30, 200]} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="chart-tooltip" style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{d.producer}</div>
                      <div>Buy: {fmt(d.x)} → Table: {fmt(d.y)}</div>
                      <div style={{ fontWeight: 600, color: ACCENT.green }}>Markup: {(d.y / d.x).toFixed(1)}×</div>
                    </div>
                  );
                }} />
                <Scatter data={scatterData}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={TYPE_PALETTE[d.type] || "#6b7280"} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <div className="grid-2">
        <Section title="Best Margins" subtitle="Your highest-performing wines">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <MiniTable maxHeight={300} columns={[
              { key: "wine_name", label: "Wine", render: (r) => <><span style={{ fontWeight: 500 }}>{r.wine_name}</span> <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{r.producer_name}</span></> },
              { key: "buy_price", label: "Buy", align: "right", render: (r) => fmt(r.buy_price) },
              { key: "table_price", label: "Table", align: "right", render: (r) => fmt(r.table_price) },
              { key: "marginPct", label: "Margin", align: "right", bold: true, color: () => ACCENT.green, render: (r) => pct(r.marginPct) },
            ]} rows={marginWines.top} />
          </div>
        </Section>
        <Section title="Worst Margins" subtitle="Review these — reprice or drop">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <MiniTable maxHeight={300} columns={[
              { key: "wine_name", label: "Wine", render: (r) => <><span style={{ fontWeight: 500 }}>{r.wine_name}</span> <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{r.producer_name}</span></> },
              { key: "buy_price", label: "Buy", align: "right", render: (r) => fmt(r.buy_price) },
              { key: "table_price", label: "Table", align: "right", render: (r) => fmt(r.table_price) },
              { key: "marginPct", label: "Margin", align: "right", bold: true, color: (r) => r.marginPct < 30 ? "#ef4444" : "#eab308", render: (r) => pct(r.marginPct) },
            ]} rows={marginWines.worst} />
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PORTFOLIO COMPOSITION                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid-2">
        <Section title="Bottles by Type" subtitle="Your cellar's DNA">
          <div className="card" style={{ padding: "16px 10px" }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={typeData} dataKey="bottles" nameKey="name" cx="50%" cy="50%"
                  outerRadius={90} innerRadius={50} paddingAngle={2}
                  label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                  labelLine={false} style={{ fontSize: 10 }}>
                  {typeData.map(d => <Cell key={d.name} fill={TYPE_PALETTE[d.name] || "#6b7280"} />)}
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Price Tier Spread" subtitle="Where do your wines sit for guests?">
          <div className="card" style={{ padding: "16px 10px" }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priceTiers}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="SKUs" fill={BRAND} radius={[4, 4, 0, 0]} />
                <Bar dataKey="bottles" name="Bottles" fill={BRAND + "66"} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <div className="grid-2">
        <Section title="By Region" subtitle="Geographic diversity">
          <div className="card" style={{ padding: "16px 10px" }}>
            <ResponsiveContainer width="100%" height={Math.max(180, regionData.length * 28)}>
              <BarChart data={regionData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="bottles" name="Bottles" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Stock Health" subtitle="Inventory status breakdown">
          <div className="card" style={{ padding: "16px 10px" }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stockHealth} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={80} innerRadius={40} paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false} style={{ fontSize: 10 }}>
                  {stockHealth.map(d => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CAPITAL ANALYSIS                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Section title="Capital by Type" subtitle="Where your money is locked up">
        <div className="card" style={{ padding: "16px 10px" }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={capitalByType} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} tickFormatter={v => `€${v}`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="cost" name="Capital" radius={[0, 4, 4, 0]}>
                {capitalByType.map(d => <Cell key={d.name} fill={TYPE_PALETTE[d.name] || "#6b7280"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Top Capital Holdings" subtitle="Individual wines tying up the most cash">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <MiniTable columns={[
            { key: "rank", label: "#", render: (_, i) => i + 1, align: "center" },
            { key: "wine_name", label: "Wine", render: (r) => <><span style={{ fontWeight: 500 }}>{r.wine_name}</span> <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{r.producer_name}</span></> },
            { key: "bottle_count", label: "Btls", align: "right" },
            { key: "buy_price", label: "Unit Cost", align: "right", render: (r) => fmt(r.buy_price) },
            { key: "stockValue", label: "Total Locked", align: "right", bold: true, color: () => BRAND, render: (r) => fmt(r.stockValue) },
          ]} rows={topCapital} />
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* OPEN BOTTLES & MOST REQUESTED                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!btgLoading && openBottleStats.count > 0 && (
        <Section title={`Open Bottles (${openBottleStats.count})`} subtitle="Currently open BTG sessions">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <MiniTable maxHeight={320} columns={[
              { key: "name", label: "Wine", bold: true },
              { key: "date", label: "Opened" },
              { key: "poured", label: "Glasses", align: "right", render: (r) => `${r.poured}/${r.target}` },
              { key: "pricePerGlass", label: "€/Glass", align: "right", render: (r) => r.pricePerGlass ? `€${r.pricePerGlass}` : "—" },
            ]} rows={openBottleStats.items} />
          </div>
        </Section>
      )}

      {!movLoading && mostRequested.length > 0 && (
        <Section title="Most Requested Wines" subtitle="Ranked by bottles sold — from movement history">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <MiniTable maxHeight={360} columns={[
              { key: "rank", label: "#", render: (_, i) => i + 1, align: "center" },
              { key: "name", label: "Wine", bold: true },
              { key: "totalSold", label: "Bottles Sold", align: "right", bold: true, color: () => ACCENT.green },
              { key: "txCount", label: "Transactions", align: "right" },
            ]} rows={mostRequested} />
          </div>
        </Section>
      )}
    </div>
  );
}
