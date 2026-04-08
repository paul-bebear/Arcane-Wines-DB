-- ══════════════════════════════════════════════════════════════════════════
-- ARCANE WINES — Schema Normalization Migration
-- Separates pricing, inventory, and purchases from wines table
-- Run in Supabase SQL Editor (postgres role)
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CREATE NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── wine_prices: versioned pricing (new row each time prices change) ────
CREATE TABLE IF NOT EXISTS wine_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  buy_price NUMERIC,
  table_price NUMERIC,
  takeaway_price NUMERIC,
  takeaway_available BOOLEAN DEFAULT false,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wine_prices_wine_id ON wine_prices(wine_id);
CREATE INDEX IF NOT EXISTS idx_wine_prices_lookup ON wine_prices(wine_id, effective_date DESC);

-- ─── inventory: stock per location ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT 'Milan',
  shelf_location TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  census_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_wine_id ON inventory(wine_id);

-- ─── purchases: order/cost tracking for COGS ────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  supplier TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_wine_id ON purchases(wine_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. MIGRATE EXISTING DATA FROM wines TABLE
-- ═══════════════════════════════════════════════════════════════════════════

-- Pricing: one initial record per wine from current data
INSERT INTO wine_prices (wine_id, buy_price, table_price, takeaway_price, takeaway_available, effective_date)
SELECT id, buy_price, table_price, takeaway_price, takeaway_available,
       COALESCE(census_date, CURRENT_DATE)
FROM wines
WHERE NOT EXISTS (SELECT 1 FROM wine_prices wp WHERE wp.wine_id = wines.id);

-- Inventory: one record per wine from current data
INSERT INTO inventory (wine_id, location, shelf_location, quantity, census_date)
SELECT id, COALESCE(location, 'Milan'), shelf_location, COALESCE(bottle_count, 0), census_date
FROM wines
WHERE NOT EXISTS (SELECT 1 FROM inventory inv WHERE inv.wine_id = wines.id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RECREATE wine_catalog VIEW (sources from new tables)
-- ═══════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS wine_catalog;

CREATE VIEW wine_catalog AS
SELECT
  w.id,
  w.wine_type,
  p.name          AS producer_name,
  p.country,
  r.region_name,
  p.comune,
  w.name          AS wine_name,
  w.vintage,
  w.grapes,
  w.format,
  w.glass_type,
  w.notes,
  w.reserved_list,
  -- Current pricing (latest effective_date per wine)
  cp.buy_price,
  cp.table_price,
  cp.takeaway_price,
  cp.takeaway_available,
  -- Aggregated inventory across all locations
  COALESCE(inv.total_qty, 0)::int4 AS bottle_count,
  inv.locations    AS location,
  inv.shelves      AS shelf_location
FROM wines w
JOIN producers p ON w.producer_id = p.id
JOIN regions r   ON w.region_id   = r.id
LEFT JOIN LATERAL (
  SELECT buy_price, table_price, takeaway_price, takeaway_available
  FROM wine_prices
  WHERE wine_id = w.id
  ORDER BY effective_date DESC
  LIMIT 1
) cp ON true
LEFT JOIN (
  SELECT
    wine_id,
    SUM(quantity)        AS total_qty,
    STRING_AGG(DISTINCT location, ', ' ORDER BY location) AS locations,
    STRING_AGG(DISTINCT shelf_location, ', ' ORDER BY shelf_location)
      FILTER (WHERE shelf_location IS NOT NULL) AS shelves
  FROM inventory
  GROUP BY wine_id
) inv ON inv.wine_id = w.id;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS POLICIES FOR NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE wine_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases   ENABLE ROW LEVEL SECURITY;

-- wine_prices
CREATE POLICY "Auth read wine_prices"   ON wine_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert wine_prices" ON wine_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update wine_prices" ON wine_prices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete wine_prices" ON wine_prices FOR DELETE TO authenticated USING (true);

-- inventory
CREATE POLICY "Auth read inventory"   ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert inventory" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update inventory" ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete inventory" ON inventory FOR DELETE TO authenticated USING (true);

-- purchases
CREATE POLICY "Auth read purchases"   ON purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert purchases" ON purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update purchases" ON purchases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete purchases" ON purchases FOR DELETE TO authenticated USING (true);

-- Also ensure wines/producers/regions policies exist
DROP POLICY IF EXISTS "Authenticated users can read wines"     ON wines;
DROP POLICY IF EXISTS "Authenticated users can insert wines"   ON wines;
DROP POLICY IF EXISTS "Authenticated users can update wines"   ON wines;
DROP POLICY IF EXISTS "Authenticated users can delete wines"   ON wines;
DROP POLICY IF EXISTS "Authenticated users can read producers" ON producers;
DROP POLICY IF EXISTS "Authenticated users can read regions"   ON regions;
DROP POLICY IF EXISTS "Authenticated users can read movements" ON inventory_movements;

CREATE POLICY "Authenticated users can read wines"
  ON wines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wines"
  ON wines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wines"
  ON wines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete wines"
  ON wines FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can read producers"
  ON producers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read regions"
  ON regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read movements"
  ON inventory_movements FOR SELECT TO authenticated USING (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DROP ownership COLUMN (always 'store', unused)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE wines DROP COLUMN IF EXISTS ownership;


-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: Old pricing/inventory columns are kept on wines table for now.
-- They remain as a safety net — btg_margin_analysis and other views may
-- reference them. Once everything is verified, run:
--
--   ALTER TABLE wines DROP COLUMN IF EXISTS buy_price;
--   ALTER TABLE wines DROP COLUMN IF EXISTS table_price;
--   ALTER TABLE wines DROP COLUMN IF EXISTS takeaway_price;
--   ALTER TABLE wines DROP COLUMN IF EXISTS takeaway_available;
--   ALTER TABLE wines DROP COLUMN IF EXISTS bottle_count;
--   ALTER TABLE wines DROP COLUMN IF EXISTS shelf_location;
--   ALTER TABLE wines DROP COLUMN IF EXISTS location;
--   ALTER TABLE wines DROP COLUMN IF EXISTS census_date;
--
-- ═══════════════════════════════════════════════════════════════════════════

COMMIT;
