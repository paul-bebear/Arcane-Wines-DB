import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";

export function useWines() {
  const [wines, setWines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("wine_catalog")
        .select("*");
      if (err) throw err;
      setWines(data || []);
    } catch (e) {
      console.error("Failed to load wines:", e);
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { wines, loading, error, reload: load };
}

export function useMovements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("id,wine_id,quantity_change,movement_type,source,pos_receipt_id,notes,created_at,wines(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setMovements(data || []);
      setLoading(false);
    })();
  }, []);

  return { movements, loading };
}

export function useBtg() {
  const [btgData, setBtgData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("btg_margin_analysis")
        .select("*");
      setBtgData(data || []);
      setLoading(false);
    })();
  }, []);

  return { btgData, loading };
}

/** Open BTG sessions (bottles currently open) */
export function useOpenBottles() {
  const [openBottles, setOpenBottles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("btg_sessions")
        .select("id,wine_id,session_date,price_per_glass,glasses_target,glasses_poured,status,wines(name,wine_type)")
        .eq("status", "open")
        .order("session_date", { ascending: false });
      setOpenBottles(data || []);
      setLoading(false);
    })();
  }, []);

  return { openBottles, loading };
}

/** Purchase history for COGS tracking */
export function usePurchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchases")
      .select("*,wines(name,wine_type)")
      .order("purchase_date", { ascending: false })
      .limit(500);
    setPurchases(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { purchases, loading, reload: load };
}

/** Inventory by location (detailed view from normalized table) */
export function useInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("inventory")
        .select("*,wines(name,wine_type)")
        .order("location", { ascending: true });
      setInventory(data || []);
      setLoading(false);
    })();
  }, []);

  return { inventory, loading };
}
