import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { supabase } from "../lib/supabaseClient.js";

export default function Spreadsheet() {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWines = async () => {
    setLoading(true);
    // Fetch all wines for the spreadsheet
    const { data, error } = await supabase
      .from("wine_catalog")
      .select("*")
      .order("wine_name");
      
    if (error) {
      console.error("Error fetching spreadsheet data:", error);
    } else {
      setRowData(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWines();
  }, []);

  const [colDefs] = useState([
    { field: "wine_name", headerName: "Wine Name", editable: true, minWidth: 200, filter: true },
    { field: "wine_type", headerName: "Type", editable: true, width: 120, filter: true },
    { field: "producer_name", headerName: "Producer", editable: false, filter: true },
    { field: "region_name", headerName: "Region", editable: false, filter: true },
    { field: "vintage", headerName: "Vintage", editable: true, width: 100, filter: "agNumberColumnFilter" },
    { field: "grapes", headerName: "Grapes", editable: true, filter: true },
    { field: "format", headerName: "Format", editable: true, width: 100 },
    { field: "buy_price", headerName: "Buy Price (€)", editable: true, width: 130, valueFormatter: p => p.value ? `€${p.value}` : '', filter: "agNumberColumnFilter" },
    { field: "table_price", headerName: "Table Price (€)", editable: true, width: 140, valueFormatter: p => p.value ? `€${p.value}` : '', filter: "agNumberColumnFilter" },
    { field: "bottle_count", headerName: "Stock Qty", editable: true, width: 120, filter: "agNumberColumnFilter", 
      cellStyle: params => {
        if (params.value === 0) return { color: '#ef4444', fontWeight: 'bold' };
        if (params.value < 3) return { color: '#f97316', fontWeight: 'bold' };
        return { color: '#10b981', fontWeight: 'bold' };
      }
    },
    { field: "takeaway_available", headerName: "Takeaway", editable: true, width: 110, cellEditor: "agCheckboxCellEditor" },
    { field: "takeaway_price", headerName: "Takeaway (€)", editable: true, width: 140, valueFormatter: p => p.value ? `€${p.value}` : '', filter: "agNumberColumnFilter" },
    { field: "reserved_list", headerName: "Reserved", editable: true, width: 100, cellEditor: "agCheckboxCellEditor" },
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    flex: 1,
  }), []);

  const onCellValueChanged = useCallback(async (event) => {
    const { colDef, oldValue, newValue, data } = event;
    const field = colDef.field;
    if (oldValue === newValue) return;

    try {
      if (field === "bottle_count") {
        // Special business logic for stock adjustments
        const newQty = parseInt(newValue);
        if (isNaN(newQty) || newQty < 0) {
          event.node.setDataValue(field, oldValue); // revert
          return;
        }
        const diff = newQty - (oldValue || 0);

        // 1. Update legacy wines table check
        await supabase.from("wines").update({ bottle_count: newQty }).eq("id", data.id);
        
        // 2. Adjust inventory row (we'll just safely upside 'Milan' for ease of spreadsheet)
        const { data: inv } = await supabase.from("inventory").select("id, quantity").eq("wine_id", data.id).limit(1).maybeSingle();
        if (inv) {
          await supabase.from("inventory").update({ quantity: (inv.quantity || 0) + diff }).eq("id", inv.id);
        } else {
          await supabase.from("inventory").insert({ wine_id: data.id, quantity: newQty, location: "Milan" });
        }

        // 3. Insert movement log
        await supabase.from("inventory_movements").insert({
          wine_id: data.id,
          quantity_change: diff,
          movement_type: "adjustment",
          source: "spreadsheet",
          notes: `Spreadsheet edit: ${oldValue || 0} → ${newQty}`,
        });
      } else {
        // Standard field update for the wines table
        const updatePayload = { [field]: newValue };
        // We ensure numeric fields stay numeric
        if (["vintage"].includes(field)) updatePayload[field] = newValue ? parseInt(newValue) : null;
        if (["buy_price", "table_price", "takeaway_price"].includes(field)) updatePayload[field] = newValue ? parseFloat(newValue) : null;

        const { error } = await supabase.from("wines").update(updatePayload).eq("id", data.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error("Failed to save cell edit:", e);
      event.node.setDataValue(field, oldValue); // revert on error
      alert("Failed to save: " + e.message);
    }
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="page-title">Spreadsheet DB</h1></div>
        </div>
        <div className="loading-center"><div className="spinner" /><span>Loading full dataset...</span></div>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ height: "calc(100vh - 40px)", display: "flex", flexDirection: "column" }}>
      <div className="page-header" style={{ flexShrink: 0, marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Spreadsheet DB</h1>
          <p className="page-subtitle">Raw dataset view. Inline edits automatically save and log movements.</p>
        </div>
      </div>
      
      <div className="ag-theme-alpine-dark" style={{ flexGrow: 1, width: "100%", borderRadius: 12, overflow: "hidden" }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          animateRows={true}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          cacheQuickFilter={true}
        />
      </div>
    </div>
  );
}
