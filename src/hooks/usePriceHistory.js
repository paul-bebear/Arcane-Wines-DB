import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Fetches versioned price history for a specific wine.
 * Returns rows from wine_prices ordered by effective_date.
 */
export function usePriceHistory(wineId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!wineId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("wine_prices")
        .select("id,wine_id,buy_price,table_price,takeaway_price,takeaway_available,effective_date,created_at")
        .eq("wine_id", wineId)
        .order("effective_date", { ascending: true });
      if (err) throw err;
      setHistory(data || []);
    } catch (e) {
      console.error("Price history load failed:", e);
      setError(e.message);
    }
    setLoading(false);
  }, [wineId]);

  useEffect(() => {
    load();
  }, [load]);

  return { history, loading, error, reload: load };
}
