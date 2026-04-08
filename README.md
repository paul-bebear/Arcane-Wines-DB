# Arcane Wines — Inventory & BI System

A full-stack inventory management and business intelligence application for a wine bar. Built in React + Vite, backed by Supabase (Postgres + Auth). Owner-facing BI dashboard, staff-facing catalog lookup, natural language search, and CRUD wine management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Routing | React Router 6 |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (PostgreSQL via PostgREST) |
| ORM | @supabase/supabase-js v2 |
| Charts | Recharts 2 |
| Styling | Inline JSX styles + CSS custom properties (no CSS framework) |

---

## Running Locally

```bash
npm install
npm run dev
```

The Supabase URL and anon key are hardcoded in `src/lib/supabaseClient.js` as fallbacks. You can override them with a `.env` file:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Auth & Roles

Authentication is handled by Supabase Auth. The role is stored in `user_metadata.role`.

| Role | Set via | Access |
|---|---|---|
| `owner` | Supabase SQL: `UPDATE auth.users SET raw_user_meta_data = '{"role":"owner"}'` | All routes |
| `staff` | Default (any user without explicit metadata) | Catalog only |

Role enforcement is at two levels:
- **Nav**: owner-only items hidden from staff in the sidebar (`Layout.jsx`)
- **Routes**: `OwnerOnly` wrapper in `main.jsx` redirects staff to `/catalog` if they try to access owner routes directly

**Owner routes**: `/` (Dashboard), `/movements`, `/btg`, `/revenue`
**Staff routes**: `/catalog` only

Staff cannot see `buy_price` in the Catalog (hidden in `Catalog.jsx`). Staff cannot see Add/Edit buttons.

---

## Project Structure

```
src/
├── main.jsx              # App entry: BrowserRouter, AuthProvider, route definitions
├── theme.js              # Design tokens: BRAND colour, CLR palette, ACCENT values
├── i18n.js               # EN/IT label strings (partial, for future localisation)
│
├── lib/
│   ├── supabaseClient.js # Creates and exports the Supabase client singleton
│   ├── AuthContext.jsx   # Auth context: session, role, signIn/signOut
│   ├── parseNLQuery.js   # Client-side NL → PostgREST filter parser (no API call)
│   └── displayMaps.js    # Display label helpers
│
├── hooks/
│   ├── useWines.js       # useWines, useMovements, useBtg, useOpenBottles,
│   │                     # usePurchases, useInventory
│   └── useRevenue.js     # Fetches sale movements + BTG sessions for Revenue page
│
├── components/
│   ├── Layout.jsx        # Sidebar nav, dark mode toggle, collapse, sign out
│   ├── WineForm.jsx      # Add/Edit/Delete modal — writes to wines + wine_prices + inventory
│   ├── StatCard.jsx      # KPI card component
│   └── TypeBadge.jsx     # Coloured wine type badge
│
└── pages/
    ├── Login.jsx         # Email/password login + sign up
    ├── Dashboard.jsx     # Owner BI: KPIs, margins, portfolio, stock health,
    │                     # capital, losing money alert, open bottles, most requested
    ├── Catalog.jsx       # Wine list: NL search, filter/sort, expandable cards, CRUD
    ├── Movements.jsx     # Inventory movement log (owner only)
    ├── Btg.jsx           # By-the-glass session tracker (owner only)
    └── Revenue.jsx       # Revenue & profit: time series, channel split, COGS,
                          # volume trends, top wines (owner only)
```

---

## Database Schema

### Core Tables

**`wines`** — Wine identity. One row per SKU.
Fields: `id`, `producer_id`, `region_id`, `wine_type`, `name`, `vintage`, `grapes`, `format`, `glass_type`, `notes`, `reserved_list`, `pos_product_id`, `pos_external_id`, `created_at`, `updated_at`

> Legacy columns still present as a safety net for `btg_margin_analysis`: `buy_price`, `table_price`, `takeaway_price`, `takeaway_available`, `bottle_count`, `shelf_location`, `location`, `census_date`. These are kept in sync by `WineForm` on every save but the canonical source of truth is now `wine_prices` and `inventory`.

**`wine_prices`** — Versioned pricing. New row inserted every time prices change. Current price = most recent `effective_date`.
Fields: `id`, `wine_id`, `buy_price`, `table_price`, `takeaway_price`, `takeaway_available`, `effective_date`, `created_at`

**`inventory`** — Stock per location. One row per wine per storage location.
Fields: `id`, `wine_id`, `location`, `shelf_location`, `quantity`, `census_date`, `updated_at`

**`purchases`** — Purchase order history for COGS tracking.
Fields: `id`, `wine_id`, `quantity`, `unit_cost`, `total_cost`, `supplier`, `purchase_date`, `notes`, `created_at`

**`producers`** — Producer/winery reference data.
Fields: `id`, `name`, `country`, `region`, `comune`, `notes`, `created_at`

**`regions`** — Wine region reference data.
Fields: `id`, `country`, `region_name`, `created_at`

### Operational Tables

**`inventory_movements`** — Audit log of stock changes (sales, restocks, adjustments).
Fields: `id`, `wine_id`, `quantity_change`, `movement_type`, `source`, `pos_receipt_id`, `notes`, `created_at`

**`btg_sessions`** — By-the-glass bottle sessions.
Fields: `id`, `wine_id`, `session_date`, `price_per_glass`, `glasses_target`, `glasses_poured`, `status`, `created_at`

**`btg_pours`** — Individual glass pours linked to a session.
Fields: `id`, `session_id`, `pour_amount_ml`, `price_charged`, `pos_receipt_id`, `created_at`

**`pos_sync_log`** — POS system integration event log.
Fields: `id`, `wine_id`, `event_type`, `pos_receipt_id`, `raw_payload`, `sync_status`, `error_message`, `created_at`

### Views

**`wine_catalog`** — Primary read view used by almost all frontend queries. Joins `wines` + `producers` + `regions` + current `wine_prices` (latest `effective_date` via LATERAL join) + aggregated `inventory` (total quantity, comma-separated locations and shelf codes across all locations).

**`btg_margin_analysis`** — Joins `btg_sessions` + `wines` + `producers` + aggregated `btg_pours` revenue. Exposes: `session_id`, `wine_name`, `producer_name`, `session_date`, `status`, `bottle_cost`, `bottle_sell_price`, `price_per_glass`, `glasses_target`, `glasses_poured`, `total_btg_revenue`, `btg_margin`.

### RLS

Row Level Security is enabled on all tables. All policies are `TO authenticated USING (true)` — any logged-in user can read/write. There is no row-level owner scoping; access separation is handled at the application layer by role.

---

## Key Design Decisions

**Why `wine_catalog` is a view, not a table**: The catalog joins wine identity, current pricing, and aggregated inventory. Keeping these as separate normalised tables (with a view on top) means pricing history is preserved when buy/table prices change, and a wine can have stock in multiple cities without duplicating the wine record.

**Why old columns are kept on `wines`**: `btg_margin_analysis` reads `buy_price` and `table_price` directly from `wines`. Dropping these columns would break BTG margin calculations. `WineForm` writes to both `wines` (legacy) and `wine_prices`/`inventory` (canonical) on every save to keep them in sync. Once `btg_margin_analysis` is updated to join `wine_prices`, the legacy columns can be dropped with:
```sql
ALTER TABLE wines DROP COLUMN IF EXISTS buy_price;
ALTER TABLE wines DROP COLUMN IF EXISTS table_price;
ALTER TABLE wines DROP COLUMN IF EXISTS takeaway_price;
ALTER TABLE wines DROP COLUMN IF EXISTS takeaway_available;
ALTER TABLE wines DROP COLUMN IF EXISTS bottle_count;
ALTER TABLE wines DROP COLUMN IF EXISTS shelf_location;
ALTER TABLE wines DROP COLUMN IF EXISTS location;
ALTER TABLE wines DROP COLUMN IF EXISTS census_date;
```

**NL Query parser (`parseNLQuery.js`)**: Runs entirely client-side, zero latency. Converts plain-text input ("cheap white under €40 from Piemonte") into PostgREST filter arrays against `wine_catalog`. Supports English + Italian. Routes to `btg_margin_analysis` or `inventory_movements` if the query mentions BTG/movement keywords. Does not use an LLM.

**Dark mode**: Toggled by setting `data-theme="dark"` on `document.body`. CSS custom properties in `index.html` switch the entire palette. State is not persisted (resets on reload).

---

## Wine Types

9 types used throughout the system (stored as full text in `wine_type`):

`Rosso` · `Bianco` · `Rosato` · `Bollicine` · `Orange` · `Dolce` · `Passito` · `Birra/Cidre` · `Zero Alcohol`

---

## Glass Types (confirmed with Fabio, the data manager)

Stored as full Italian names in `glass_type`:
- `Calice grande Bordeaux` (B)
- `Calice medio bianco` (S/U)
- `Calice medio` (universal)
- `Calice grande Borgogna` (V)

---

## Dashboard BI Sections (owner only)

1. **KPI Row** — Total SKUs, bottles, inventory cost, revenue potential, potential profit, avg margin, avg markup, last-bottle count
2. **Losing Money Alert** — Appears only when any wine has `table_price < buy_price`. Red-bordered table with per-bottle loss amount.
3. **Margin Intelligence** — Distribution histogram, buy vs table price scatter (coloured by type), best/worst margin tables
4. **Portfolio Composition** — Bottles by type donut, price tier spread, by region, vintage depth
5. **Stock Health** — Health status donut, markup by type, last-bottle list, deep stock list
6. **Capital Analysis** — Capital locked by type, by region, top holdings table
7. **Open Bottles** — Currently open BTG sessions with glasses poured vs target
8. **Most Requested** — Wines ranked by total bottles sold from movement history

---

## Revenue Page BI Sections (owner only)

Period toggle: Daily / Weekly / Monthly — all charts update.

1. **KPI Row** — Total revenue, cost, gross profit, margin %, bottles sold, glasses poured
2. **Revenue & Profit Over Time** — Dual area chart
3. **Revenue by Channel** — Bottle sales vs BTG donut
4. **Revenue by Wine Type** — Horizontal bar
5. **Channel Mix Over Time** — Stacked bar (bottles + BTG)
6. **Volume Trend** — Bottles sold + glasses poured over time
7. **COGS Over Time** — From `purchases` table (empty until purchases are recorded)
8. **Top Purchases by Cost** — Where buying budget goes
9. **Top Wines by Revenue** — Ranked table with qty, revenue, cost, profit, margin

---

## Pending / Known Issues

- **`btg_margin_analysis` reads legacy `wines.buy_price`** — not the versioned `wine_prices` table. Margin calculations are correct only as long as legacy columns stay in sync (they do via `WineForm`).
- **Purchase recording UI** — The `purchases` table and COGS infrastructure exist but there is no UI form for recording purchases yet. COGS charts on Revenue page will remain empty until data is added via Supabase directly or a future UI.
- **Multi-location inventory UI** — `inventory` supports multiple rows per wine (different cities), but `WineForm` only edits the first row. A dedicated Inventory page with per-location editing is a logical next step.
- **Price history UI** — `wine_prices` stores a new row on every price change, but there is no UI to browse pricing history. The data is there; a chart in the wine detail view would surface it.
- **Staff account creation** — New staff accounts can be created via Supabase Auth UI or SQL. No self-service signup flow exists (by design — the bar owner controls access).

---

## SQL Reference Files

```
sql/
└── migration-normalize.sql   # Schema normalisation: creates wine_prices, inventory,
                               # purchases tables; migrates data from wines; recreates
                               # wine_catalog view; sets RLS policies; drops ownership column
```

The `import.sql` at the project root contains the initial data import (49 wines, 14 producers, 8 regions) from the owner's spreadsheet.
