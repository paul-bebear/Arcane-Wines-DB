import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient.js";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Server-side paginated wine fetching from wine_catalog.
 * Pushes search, filter, and sort to Supabase queries.
 */
export function usePaginatedWines(opts = {}) {
  const pageSize = opts.pageSize || DEFAULT_PAGE_SIZE;

  const [wines, setWines] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [producerFilter, setProducerFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [reservedOnly, setReservedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("");

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 when search changes
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, regionFilter, producerFilter, maxPrice, reservedOnly, inStockOnly, sortBy]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query
      let query = supabase
        .from("wine_catalog")
        .select("*", { count: "exact" });

      // Search — use ilike on multiple fields
      if (debouncedSearch) {
        const s = `%${debouncedSearch}%`;
        query = query.or(
          `wine_name.ilike.${s},producer_name.ilike.${s},grapes.ilike.${s},region_name.ilike.${s},notes.ilike.${s}`
        );
      }

      // Filters
      if (typeFilter) query = query.eq("wine_type", typeFilter);
      if (regionFilter) query = query.eq("region_name", regionFilter);
      if (producerFilter) query = query.eq("producer_name", producerFilter);
      if (maxPrice) query = query.lte("table_price", parseFloat(maxPrice));
      if (reservedOnly) query = query.eq("reserved_list", true);
      if (inStockOnly) query = query.gt("bottle_count", 0);

      // Sort
      if (sortBy === "price_asc") query = query.order("table_price", { ascending: true, nullsFirst: false });
      else if (sortBy === "price_desc") query = query.order("table_price", { ascending: false, nullsFirst: true });
      else if (sortBy === "name_asc") query = query.order("wine_name", { ascending: true });
      else if (sortBy === "vintage_desc") query = query.order("vintage", { ascending: false, nullsFirst: true });
      else if (sortBy === "stock_asc") query = query.order("bottle_count", { ascending: true });
      else query = query.order("wine_name", { ascending: true }); // default sort

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error: err, count } = await query;
      if (err) throw err;

      setWines(data || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error("Paginated wines load failed:", e);
      setError(e.message);
    }
    setLoading(false);
  }, [page, pageSize, debouncedSearch, typeFilter, regionFilter, producerFilter, maxPrice, reservedOnly, inStockOnly, sortBy]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    wines,
    loading,
    error,
    reload: load,
    // Pagination
    page,
    setPage,
    totalPages,
    totalCount,
    pageSize,
    // Filters
    search, setSearch,
    typeFilter, setTypeFilter,
    regionFilter, setRegionFilter,
    producerFilter, setProducerFilter,
    maxPrice, setMaxPrice,
    reservedOnly, setReservedOnly,
    inStockOnly, setInStockOnly,
    sortBy, setSortBy,
  };
}
