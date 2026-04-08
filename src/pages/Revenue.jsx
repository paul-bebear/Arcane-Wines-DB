import { useMemo, useState } from "react";
import { useRevenue } from "../hooks/useRevenue.js";
import { usePurchases } from "../hooks/useWines.js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { BRAND, ACCENT, CLR } from "../theme.js";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const TYPE_PALETTE = {
  Rosso:          "#dc2626",
  Bianco:         "#ca8a04",
  Rosato:         "#db2777",
  Bollicine:      "#0284c7",
  Orange:         "#ea580c",
  Dolce:          "#9333ea",
  Passito:        "#7c3aed",
  "Birra/Cidre":  "#16a34a",
  "Zero Alcohol": "#0d9488",
  Unknown:        "#6b7280",
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#eab308", "#8b5cf6", "#ef4444"];

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "var(--color-background-secondary)", borderRadius: 14,
      border: "1px solid var(--color-border-tertiary)", padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <Card style={{ textAlign: "center", padding: "16px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--color-text-primary)", fontFamily: "'Playfair Display', serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

function MiniTable({ columns, rows, maxHeight }) {
  return (
    <div style={{ maxHeight: maxHeight || 320, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left", padding: "6px 8px", borderBottom: "2px solid var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", position: "sticky", top: 0, background: "var(--color-background-secondary)" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "6px 8px", borderBottom: "1px solid var(--color-border-tertiary)", color: c.color?.(r) || "var(--color-text-primary)", fontWeight: c.bold ? 600 : 400, textAlign: c.align || "left", fontSize: 12, whiteSpace: "nowrap" }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function toDay(dateStr) {
  return dateStr?.slice(0, 10) || "unknown";
}

function toWeek(dateStr) {
  const d = new Date(dateStr);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function toMonth(dateStr) {
  return dateStr?.slice(0, 7) || "unknown";
}

function periodKey(dateStr, period) {
  if (period === "daily") return toDay(dateStr);
  if (period === "weekly") return toWeek(dateStr);
  return toMonth(dateStr);
}

function formatPeriodLabel(key, period) {
  if (period === "daily") {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }
  if (period === "weekly") return key; // 2024-W03
  // monthly
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Revenue() {
  const { sales, btg, loading, error } = useRevenue();
  const { purchases, loading: purchLoading } = usePurchases();
  const [period, setPeriod] = useState("monthly");

  // ─── Compute unified time-series data ─────────────────────────────────
  const { timeSeries, totals, topWines, channelSplit, typeBreakdown } = useMemo(() => {
    if (loading) return { timeSeries: [], totals: {}, topWines: [], channelSplit: [], typeBreakdown: [] };

    const buckets = {};
    let totalRevenue = 0, totalCost = 0, totalBottles = 0, totalGlasses = 0;
    const wineMap = {};
    const typeMap = {};
    let bottleSalesRevenue = 0, btgRevenue = 0;

    // ── Process bottle sales ──
    for (const s of sales) {
      const qty = Math.abs(s.quantity_change);
      const tablePrice = s.wines?.table_price || 0;
      const buyPrice = s.wines?.buy_price || 0;
      const rev = qty * tablePrice;
      const cost = qty * buyPrice;
      const pk = periodKey(s.created_at, period);

      if (!buckets[pk]) buckets[pk] = { key: pk, bottleRevenue: 0, btgRevenue: 0, bottleCost: 0, btgCost: 0, bottles: 0, glasses: 0 };
      buckets[pk].bottleRevenue += rev;
      buckets[pk].bottleCost += cost;
      buckets[pk].bottles += qty;

      totalRevenue += rev;
      totalCost += cost;
      totalBottles += qty;
      bottleSalesRevenue += rev;

      // Track per wine
      const wname = s.wines?.name || "Unknown";
      if (!wineMap[wname]) wineMap[wname] = { name: wname, revenue: 0, cost: 0, qty: 0, type: s.wines?.wine_type || "Unknown" };
      wineMap[wname].revenue += rev;
      wineMap[wname].cost += cost;
      wineMap[wname].qty += qty;

      // Track per type
      const wtype = s.wines?.wine_type || "Unknown";
      if (!typeMap[wtype]) typeMap[wtype] = { type: wtype, revenue: 0, cost: 0 };
      typeMap[wtype].revenue += rev;
      typeMap[wtype].cost += cost;
    }

    // ── Process BTG sessions ──
    for (const b of btg) {
      const rev = b.total_btg_revenue || 0;
      const cost = b.bottle_cost || 0;
      const pk = periodKey(b.session_date, period);
      const glasses = b.glasses_poured || 0;

      if (!buckets[pk]) buckets[pk] = { key: pk, bottleRevenue: 0, btgRevenue: 0, bottleCost: 0, btgCost: 0, bottles: 0, glasses: 0 };
      buckets[pk].btgRevenue += rev;
      buckets[pk].btgCost += cost;
      buckets[pk].glasses += glasses;

      totalRevenue += rev;
      totalCost += cost;
      totalGlasses += glasses;
      btgRevenue += rev;
    }

    // Build sorted time series
    const timeSeries = Object.values(buckets)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => ({
        ...b,
        label: formatPeriodLabel(b.key, period),
        revenue: b.bottleRevenue + b.btgRevenue,
        cost: b.bottleCost + b.btgCost,
        profit: (b.bottleRevenue + b.btgRevenue) - (b.bottleCost + b.btgCost),
      }));

    const totalProfit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

    const topWines = Object.values(wineMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15)
      .map(w => ({ ...w, profit: w.revenue - w.cost, margin: w.revenue > 0 ? (((w.revenue - w.cost) / w.revenue) * 100).toFixed(1) : 0 }));

    const channelSplit = [
      { name: "Bottle Sales", value: Math.round(bottleSalesRevenue) },
      { name: "By the Glass", value: Math.round(btgRevenue) },
    ].filter(c => c.value > 0);

    const typeBreakdown = Object.values(typeMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(t => ({ ...t, profit: t.revenue - t.cost }));

    return {
      timeSeries,
      totals: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalProfit,
        marginPct,
        bottles: totalBottles,
        glasses: totalGlasses,
        transactions: sales.length + btg.length,
      },
      topWines,
      channelSplit,
      typeBreakdown,
    };
  }, [sales, btg, loading, period]);

  // ─── Volume trend (bottles sold over time) ──────────────────────────
  const volumeTrend = useMemo(() => {
    if (!timeSeries.length) return [];
    return timeSeries.map(t => ({
      label: t.label,
      bottles: t.bottles,
      glasses: t.glasses,
      total: t.bottles + t.glasses,
    }));
  }, [timeSeries]);

  // ─── COGS from purchases table ────────────────────────────────────
  const cogsData = useMemo(() => {
    if (purchLoading || !purchases.length) return { total: 0, byPeriod: [], byWine: [] };

    const periodMap = {};
    const wineMap = {};
    let total = 0;

    for (const p of purchases) {
      const cost = p.quantity * p.unit_cost;
      total += cost;

      const pk = periodKey(p.purchase_date, period);
      if (!periodMap[pk]) periodMap[pk] = { key: pk, cost: 0, quantity: 0 };
      periodMap[pk].cost += cost;
      periodMap[pk].quantity += p.quantity;

      const wname = p.wines?.name || "Unknown";
      if (!wineMap[wname]) wineMap[wname] = { name: wname, cost: 0, quantity: 0, type: p.wines?.wine_type || "" };
      wineMap[wname].cost += cost;
      wineMap[wname].quantity += p.quantity;
    }

    return {
      total,
      byPeriod: Object.values(periodMap)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(b => ({ ...b, label: formatPeriodLabel(b.key, period) })),
      byWine: Object.values(wineMap).sort((a, b) => b.cost - a.cost).slice(0, 10),
    };
  }, [purchases, purchLoading, period]);


  if (loading) {
    return (
      <div>
        <div className="page-header"><div><div className="skeleton skeleton-title" /></div></div>
        <div className="grid-auto" style={{ marginBottom: 36 }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: 40, textAlign: "center", color: CLR.red.text }}>Error: {error}</div>;
  }

  const empty = sales.length === 0 && btg.length === 0;

  const fmt = (v) => `€${Math.round(v).toLocaleString("it-IT")}`;

  return (
    <div>
      {/* ── Header + Period Toggle ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue & Profit</h1>
          <p className="page-subtitle">Bottle sales + By the Glass sessions</p>
        </div>
        <div className="period-toggle">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={period === p.key ? "active" : ""}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-text">
            No revenue data yet. Sales and BTG sessions will appear here.
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI Row ──────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
            <StatCard label="Total Revenue" value={fmt(totals.revenue)} color={ACCENT.green} />
            <StatCard label="Total Cost" value={fmt(totals.cost)} color="var(--color-text-secondary)" />
            <StatCard label="Gross Profit" value={fmt(totals.profit)} color={totals.profit >= 0 ? ACCENT.green : CLR.red.text} />
            <StatCard label="Margin" value={`${totals.marginPct}%`} color={totals.marginPct >= 30 ? ACCENT.green : CLR.amber.text} />
            <StatCard label="Bottles Sold" value={totals.bottles.toLocaleString()} />
            <StatCard label="Glasses Poured" value={totals.glasses.toLocaleString()} />
          </div>

          {/* ── Revenue & Profit Over Time ────────────────────────── */}
          <Section title="Revenue & Profit Over Time" subtitle={`${period === "daily" ? "Day" : period === "weekly" ? "Week" : "Month"} by ${period === "daily" ? "day" : period === "weekly" ? "week" : "month"}`}>
            <Card>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={timeSeries} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={ACCENT.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} tickFormatter={v => `€${v}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, fontSize: 12 }}
                    formatter={(v, name) => [`€${Math.round(v).toLocaleString("it-IT")}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={BRAND} fill="url(#revGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke={ACCENT.green} fill="url(#profitGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Section>

          {/* ── Revenue Split: Bottles vs BTG ─────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            <Section title="Revenue by Channel" subtitle="Bottle sales vs By the Glass">
              <Card style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {channelSplit.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={channelSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                        {channelSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, fontSize: 12 }}
                        formatter={(v) => `€${v.toLocaleString("it-IT")}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: 40, color: "var(--color-text-tertiary)", fontSize: 12 }}>No data</div>
                )}
              </Card>
            </Section>

            <Section title="Revenue by Wine Type" subtitle="Gross revenue per category">
              <Card>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={typeBreakdown} layout="vertical" margin={{ left: 70, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} tickFormatter={v => `€${v}`} />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} width={65} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, fontSize: 12 }}
                      formatter={(v, name) => [`€${Math.round(v).toLocaleString("it-IT")}`, name]}
                    />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                      {typeBreakdown.map((t, i) => <Cell key={i} fill={TYPE_PALETTE[t.type] || "#6b7280"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Section>
          </div>

          {/* ── Bottle vs BTG stacked bar over time ───────────────── */}
          <Section title="Channel Mix Over Time" subtitle="Bottle sales vs BTG revenue stacked">
            <Card>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={timeSeries} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} tickFormatter={v => `€${v}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, fontSize: 12 }}
                    formatter={(v, name) => [`€${Math.round(v).toLocaleString("it-IT")}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="bottleRevenue" name="Bottles" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="btgRevenue" name="BTG" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Section>

          {/* ── Volume Trend ─────────────────────────────────────── */}
          {volumeTrend.length > 0 && (
            <Section title="Volume Trend" subtitle="Change in bottles sold + glasses poured over time">
              <Card>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={volumeTrend} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="bottles" name="Bottles" stackId="vol" fill="#6366f1" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="glasses" name="Glasses" stackId="vol" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Section>
          )}

          {/* ── COGS (from purchases) ────────────────────────────── */}
          {!purchLoading && cogsData.total > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              <Section title="COGS Over Time" subtitle="Total cost of goods purchased per period">
                <Card>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cogsData.byPeriod} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} tickFormatter={v => `€${v}`} />
                      <Tooltip
                        contentStyle={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, fontSize: 12 }}
                        formatter={(v) => [`€${Math.round(v).toLocaleString("it-IT")}`]}
                      />
                      <Bar dataKey="cost" name="COGS" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Section>

              <Section title="Top Purchases by Cost" subtitle="Where your buying budget goes">
                <Card>
                  <MiniTable
                    columns={[
                      { key: "name", label: "Wine", bold: true },
                      { key: "type", label: "Type", render: (r) => (
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: (TYPE_PALETTE[r.type] || "#6b7280") + "18", color: TYPE_PALETTE[r.type] || "#6b7280" }}>
                          {r.type}
                        </span>
                      )},
                      { key: "quantity", label: "Qty", align: "right" },
                      { key: "cost", label: "Total Cost", align: "right", bold: true, color: () => CLR.red.text, render: (r) => fmt(r.cost) },
                    ]}
                    rows={cogsData.byWine}
                    maxHeight={260}
                  />
                </Card>
              </Section>
            </div>
          )}

          {!purchLoading && cogsData.total > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
              <StatCard label="Total COGS" value={fmt(cogsData.total)} color={CLR.red.text} />
              <StatCard label="Gross Profit" value={fmt(totals.revenue - cogsData.total)} color={totals.revenue - cogsData.total >= 0 ? ACCENT.green : CLR.red.text} />
              <StatCard label="True Margin" value={totals.revenue > 0 ? `${(((totals.revenue - cogsData.total) / totals.revenue) * 100).toFixed(1)}%` : "—"} />
            </div>
          )}

          {/* ── Top Wines by Revenue ──────────────────────────────── */}
          <Section title="Top Wines by Revenue" subtitle="Best sellers ranked by total revenue">
            <Card>
              <MiniTable
                columns={[
                  { key: "rank", label: "#", render: (_, i) => i + 1, align: "center" },
                  { key: "name", label: "Wine", bold: true },
                  { key: "type", label: "Type", render: (r) => (
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: (TYPE_PALETTE[r.type] || "#6b7280") + "18", color: TYPE_PALETTE[r.type] || "#6b7280" }}>
                      {r.type}
                    </span>
                  )},
                  { key: "qty", label: "Qty Sold", align: "right" },
                  { key: "revenue", label: "Revenue", align: "right", render: (r) => fmt(r.revenue), color: () => ACCENT.green },
                  { key: "cost", label: "Cost", align: "right", render: (r) => fmt(r.cost) },
                  { key: "profit", label: "Profit", align: "right", render: (r) => fmt(r.profit), color: (r) => r.profit >= 0 ? ACCENT.green : CLR.red.text },
                  { key: "margin", label: "Margin", align: "right", render: (r) => `${r.margin}%`, color: (r) => parseFloat(r.margin) >= 40 ? ACCENT.green : parseFloat(r.margin) >= 20 ? CLR.amber.text : CLR.red.text },
                ]}
                rows={topWines.map((w, i) => ({ ...w, rank: i + 1 }))}
                maxHeight={400}
              />
            </Card>
          </Section>
        </>
      )}
    </div>
  );
}
