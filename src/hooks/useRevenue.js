import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Fetches revenue data from two sources:
 * 1. Bottle sales: inventory_movements (type=sale) joined with wine pricing
 * 2. BTG sessions: btg_margin_analysis with session-level revenue/cost
 *
 * Returns unified daily records with revenue, cost, profit.
 */
export function useRevenue() {
  const [data, setData] = useState({ sales: [], btg: [], loading: true, error: null });

  const load = useCallback(async () => {
    try {
      // Fetch sale movements with wine pricing
      const { data: salesRaw, error: e1 } = await supabase
        .from("inventory_movements")
        .select("id,wine_id,quantity_change,movement_type,created_at,wines(name,buy_price,table_price,wine_type)")
        .eq("movement_type", "sale")
        .order("created_at", { ascending: true });
      if (e1) throw e1;

      // Fetch BTG sessions
      const { data: btgRaw, error: e2 } = await supabase
        .from("btg_margin_analysis")
        .select("*");
      if (e2) throw e2;

      setData({ sales: salesRaw || [], btg: btgRaw || [], loading: false, error: null });
    } catch (e) {
      console.error("Revenue load failed:", e);
      setData(d => ({ ...d, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...data, reload: load };
}
