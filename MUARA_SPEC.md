# MASTER PROMPT FOR CODEX: MUARA SAAS PLATFORM (NEXT.JS + TAILWIND CSS + SUPABASE)

## 1. PROJECT OVERVIEW & PRODUCT SCOPE
Build the full-stack web application for **MUARA** (*Mekanisme Uji Asal dan Registri Akuntabel*), tagline **`#AsalJelasBersamaMUARA`**, designed for the Indonesian pulp, paper, and wood-chip supply chain, EUDR (*EU Deforestation Regulation*) due diligence readiness, smallholder/cooperative data onboarding, and supply chain financing pre-screening synergy with **BNI Ventures / BNI Group / hibank**[cite: 4, 27, 28, 30, 36, 59].

### Strict Product Boundaries (Avoid ERP Bloat)
- MUARA is **NOT** a full ERP system. Do **NOT** build full procurement purchasing workflows, factory wood payment disbursement modules, general warehouse inventory management, or mill production scheduling.
- MUARA ingests/imports existing supplier lists, land coordinates/polygons, and receiving logs (e.g., from Excel/CSV or ERP exports), checks origin risk, links supply records across:
  **Source Land / Smallholder (`land_plots`) -> Collector / Intermediary (`suppliers`) -> Shipment / Delivery (`delivery_lots`) -> Mill Receiving / Product Batch (`lot_plot_allocations` & export batch reference)**,
  and supports **targeted on-demand cooperative/local partner onboarding** (`cooperative_tasks`) for incomplete or flagged supplier data.
- Risk screening provides risk indicators, flags, and recommendations; purchasing decisions and legal compliance remain with the client company.

---

## 2. GRAPHIC STANDARDS MANUAL (GSM) & VISUAL IDENTITY
Follow the MUARA visual identity strictly across all pages, components, charts, and maps[cite: 59, 60]:

- **Brand Mark & Wordmark:**
  - Logomark: Circular concentric timber-ring motif transitioning from forest/lime green on the left to warm gold on the right, paired with two overlapping vibrant green leaves at the bottom-left[cite: 60].
  - Wordmark: Bold geometric sans-serif **`MUARA`** with subtitle **`Mekanisme Uji Asal & Registri Akuntabel`** and badge/hashtag **`#AsalJelasBersamaMUARA`**[cite: 59].
- **Color System (Define in CSS custom properties & `tailwind.config`):**
  - Primary Dark Forest Green: `#1B3B2B` (primary navigation sidebar/header, primary buttons, dark hero overlays)
  - Canopy Green: `#2D5A3C` (hover states, active tabs, secondary accents)
  - Vibrant Leaf Green: `#76B900` / `#84CC16` (highlights, progress indicators, `#AsalJelasBersamaMUARA` accents)
  - Timber Ring Gold: `#D4AF37` (charts, verified/bankable indicators, subtle borders)
  - Warm Ivory / Cream Surface: `#F8F9F4` (main application canvas background, inspired by the warm cream wordmark tone)[cite: 59]
  - Card Surface: `#FFFFFF` with subtle `#DCE3D9` borders
  - Primary Text: `#11241A` | Muted Text: `#52665A`
  - **Risk & Status Semantic Tokens:**
    - `GREEN` (Low Risk / Verified / EUDR Ready): bg `#DCFCE7`, text `#166534`, border `#86EFAC`
    - `YELLOW` (Medium Risk / Incomplete Data / Needs Onboarding): bg `#FEF9C3`, text `#854D0E`, border `#FDE047`
    - `RED` (High Risk / Overlap or Deforestation Flag / Blocked): bg `#FEE2E2`, text `#991B1B`, border `#FCA5A5`
- **Typography:**
  - Headings & UI: `Plus Jakarta Sans` and `Inter`
  - Lot IDs, GPS coordinates, document codes, and tonnages: `JetBrains Mono` (`tabular-nums`)
- **UI Aesthetic:**
  - Clean, crisp, data-dense enterprise SaaS layout tailored for desktop and tablet/iPad field use, avoiding bloated empty boxes or unrequested visual clutter.

---

## 3. TECH STACK & SUPABASE INTEGRATION
- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons, Recharts or clean custom SVG charts, and interactive GIS mapping (`leaflet` / `react-leaflet` with satellite/tile layers and GeoJSON polygon overlays).
- **Database & Backend:** **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`).
  - Include a clean Supabase client setup (`lib/supabase/client.ts` and `lib/supabase/server.ts`) using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Include a **Demo / Seed Fallback Mode** (`lib/mock-data.ts`) so that even before live Supabase credentials are connected—or when clicking **"Load / Reset Demo Data"**—the entire application works seamlessly with rich, realistic Indonesian pulp/wood-chip/cooperative data, and can also sync/seed directly into Supabase tables when configured.
  - Include Row-Level Security (RLS) policies and SQL schema in `supabase/migrations/001_init_muara.sql`.

---

## 4. SUPABASE DATABASE SCHEMA (`supabase/migrations/001_init_muara.sql`)
Create and include this SQL migration in the repository:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Organizations (Pulp/Paper/Wood Chip Mills & Partner Cooperatives)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK (org_type IN ('pulp_mill', 'wood_chip_mill', 'paper_mill', 'cooperative')),
  region TEXT,
  svlk_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tier-1 Suppliers (Collectors / Intermediaries / Smallholder Groups)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  cooperative_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  supplier_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  supplier_type TEXT NOT NULL CHECK (supplier_type IN ('pengepul', 'koperasi', 'petani_mandiri', 'hti_mitra')),
  location_label TEXT,
  risk_status TEXT NOT NULL DEFAULT 'yellow' CHECK (risk_status IN ('green', 'yellow', 'red')),
  risk_summary TEXT,
  documented_area_ha NUMERIC(10,2) NOT NULL DEFAULT 0,
  logical_quota_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  allocated_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  bni_scf_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Source Land Plots (Geospatial Polygons & Legality / Deforestation Screening)
CREATE TABLE IF NOT EXISTS land_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  plot_code TEXT UNIQUE NOT NULL,
  farmer_or_owner_name TEXT NOT NULL,
  village_district TEXT NOT NULL,
  land_doc_type TEXT NOT NULL, -- e.g., SHM, SKT, Perhutanan Sosial, Surat Keterangan Desa
  land_doc_ref TEXT,
  area_hectares NUMERIC(10,2) NOT NULL,
  annual_yield_capacity_tons NUMERIC(12,2) NOT NULL,
  polygon_geojson JSONB NOT NULL,
  protected_overlap BOOLEAN NOT NULL DEFAULT FALSE,
  peatland_overlap BOOLEAN NOT NULL DEFAULT FALSE,
  post_2020_deforestation_flag BOOLEAN NOT NULL DEFAULT FALSE,
  legal_harvest_cycle BOOLEAN NOT NULL DEFAULT TRUE, -- Distinguishes legal rotation harvest vs deforestation
  screening_status TEXT NOT NULL DEFAULT 'yellow' CHECK (screening_status IN ('green', 'yellow', 'red')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Delivery Lots (Incoming Shipments & Mill Receiving / Export Batch Link)
CREATE TABLE IF NOT EXISTS delivery_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  lot_number TEXT UNIQUE NOT NULL,
  mill_receiving_ref TEXT NOT NULL, -- e.g., GR / Tiket Timbangan Pabrik
  transport_doc_ref TEXT NOT NULL, -- e.g., Nota Angkutan / Dokumen Pengiriman
  wood_species TEXT NOT NULL DEFAULT 'Acacia mangium',
  shipment_weight_tons NUMERIC(12,2) NOT NULL,
  delivery_date DATE NOT NULL,
  export_product_group TEXT, -- Optional link to export batch/product group
  trace_status TEXT NOT NULL DEFAULT 'incomplete_origin' CHECK (trace_status IN ('eudr_ready', 'incomplete_origin', 'flagged_mismatch')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Lot-to-Plot Mixing & Quota Allocations (Prevents Unverified Mixing / Wood Laundering)
CREATE TABLE IF NOT EXISTS lot_plot_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES delivery_lots(id) ON DELETE CASCADE,
  plot_id UUID NOT NULL REFERENCES land_plots(id) ON DELETE RESTRICT,
  allocated_tons NUMERIC(12,2) NOT NULL,
  quota_check_passed BOOLEAN NOT NULL DEFAULT TRUE,
  validation_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Cooperative Onboarding Tasks (On-Demand Local Partner Support & BNI Pre-Screening)
CREATE TABLE IF NOT EXISTS cooperative_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  task_code TEXT UNIQUE NOT NULL,
  task_type TEXT NOT NULL, -- e.g., 'Pemetaan Poligon GPS', 'Verifikasi Dokumen Lahan', 'Rekonsiliasi Data Petani'
  target_plots INT NOT NULL DEFAULT 1,
  completed_valid_plots INT NOT NULL DEFAULT 0,
  task_fee_idr NUMERIC(14,2) NOT NULL DEFAULT 0, -- Paid for accurate/verified data completion, not forced green status
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted_review', 'verified_completed')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & permissive authenticated/anon policies for prototype demo
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE land_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_plot_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperative_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read/write for app prototype" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write for app prototype" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write for app prototype" ON land_plots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write for app prototype" ON delivery_lots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write for app prototype" ON lot_plot_allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write for app prototype" ON cooperative_tasks FOR ALL USING (true) WITH CHECK (true);