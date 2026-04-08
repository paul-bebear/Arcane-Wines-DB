import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Computes sales velocity, dead stock, and reorder suggestions
 * by analyzing inventory_movements (sales) against current stock levels.
 *
 * @param {Array} wines - Full wine list from useWines (wine_catalog)
 */
export function useSalesVelocity(wines) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all sale movements (we need the full history for velocity calc)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id,quantity_change,movement_type,created_at")
        .eq("movement_type", "sale")
        .order("created_at", { ascending: false })
        .limit(5000);
      setMovements(data || []);
    } catch (e) {
      console.error("Sales velocity load failed:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const analysis = useMemo(() => {
    if (loading || !wines.length) {
      return { deadStock: [], reorderSoon: [], fastMovers: [], velocityMap: {} };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Build per-wine velocity data
    const velocityMap = {};
    for (const m of movements) {
      const wid = m.wine_id;
      if (!velocityMap[wid]) {
        velocityMap[wid] = { totalSold: 0, last30: 0, last90: 0, lastSaleDate: null };
      }
      const qty = Math.abs(m.quantity_change);
      const date = new Date(m.created_at);

      velocityMap[wid].totalSold += qty;
      if (date >= thirtyDaysAgo) velocityMap[wid].last30 += qty;
      if (date >= ninetyDaysAgo) velocityMap[wid].last90 += qty;

      if (!velocityMap[wid].lastSaleDate || date > velocityMap[wid].lastSaleDate) {
        velocityMap[wid].lastSaleDate = date;
      }
    }

    // Classify each wine
    const deadStock = [];
    const reorderSoon = [];
    const fastMovers = [];

    for (const w of wines) {
      const v = velocityMap[w.id] || { totalSold: 0, last30: 0, last90: 0, lastSaleDate: null };
      const stock = w.bottle_count || 0;

      // Monthly velocity (over 90 days for smoother signal)
      const monthlyVelocity = v.last90 / 3;

      // Days of stock remaining
      const dailyVelocity = v.last90 / 90;
      const daysRemaining = dailyVelocity > 0 ? Math.round(stock / dailyVelocity) : stock > 0 ? Infinity : 0;

      const enriched = {
        ...w,
        totalSold: v.totalSold,
        last30Sales: v.last30,
        last90Sales: v.last90,
        monthlyVelocity: Math.round(monthlyVelocity * 10) / 10,
        daysRemaining,
        lastSaleDate: v.lastSaleDate,
        daysSinceLastSale: v.lastSaleDate
          ? Math.round((now - v.lastSaleDate) / (24 * 60 * 60 * 1000))
          : null,
      };

      // Dead stock: has stock, no sales in 30 days
      if (stock > 0 && v.last30 === 0) {
        deadStock.push(enriched);
      }

      // Reorder soon: selling well but running low (< 14 days of stock)
      if (stock > 0 && daysRemaining < 14 && daysRemaining > 0 && monthlyVelocity >= 1) {
        reorderSoon.push(enriched);
      }

      // Fast movers: high velocity (> 3 per month)
      if (monthlyVelocity >= 3) {
        fastMovers.push(enriched);
      }
    }

    // Sort by urgency
    deadStock.sort((a, b) => ((b.buy_price || 0) * (b.bottle_count || 0)) - ((a.buy_price || 0) * (a.bottle_count || 0)));
    reorderSoon.sort((a, b) => a.daysRemaining - b.daysRemaining);
    fastMovers.sort((a, b) => b.monthlyVelocity - a.monthlyVelocity);

    return {
      deadStock: deadStock.slice(0, 15),
      reorderSoon: reorderSoon.slice(0, 15),
      fastMovers: fastMovers.slice(0, 15),
      velocityMap,
    };
  }, [wines, movements, loading]);

  return { ...analysis, loading, reload: load };
}
