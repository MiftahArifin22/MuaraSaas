-- Jalankan seluruh file di SQL Editor Supabase.
BEGIN;
SET LOCAL search_path = public;



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
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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
  shipment_weight_tons NUMERIC(12,2) NOT NULL CHECK (shipment_weight_tons > 0),
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
  allocated_tons NUMERIC(12,2) NOT NULL CHECK (allocated_tons > 0),
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

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id)
);

-- Anggota yang ditambahkan lewat SQL Editor dapat mengelola data organisasinya.
ALTER TABLE public.land_plots ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.cooperative_tasks ADD COLUMN IF NOT EXISTS plot_id UUID REFERENCES public.land_plots(id) ON DELETE RESTRICT;
ALTER TABLE public.cooperative_tasks ADD COLUMN IF NOT EXISTS field_result JSONB;
ALTER TABLE public.cooperative_tasks ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE public.cooperative_tasks DROP CONSTRAINT IF EXISTS cooperative_tasks_status_check;
ALTER TABLE public.cooperative_tasks ADD CONSTRAINT cooperative_tasks_status_check CHECK (status IN ('assigned', 'in_progress', 'submitted_review', 'revision_requested', 'verified_completed'));

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_members FROM anon, authenticated;
GRANT SELECT ON public.organization_members TO authenticated;
DROP POLICY IF EXISTS own_memberships ON public.organization_members;
CREATE POLICY own_memberships ON public.organization_members FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS suppliers_org_idx ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS plots_supplier_idx ON public.land_plots(supplier_id);
CREATE INDEX IF NOT EXISTS lots_org_date_idx ON public.delivery_lots(organization_id, delivery_date);
CREATE INDEX IF NOT EXISTS allocations_plot_idx ON public.lot_plot_allocations(plot_id);
CREATE INDEX IF NOT EXISTS allocations_lot_idx ON public.lot_plot_allocations(lot_id);
CREATE INDEX IF NOT EXISTS tasks_supplier_idx ON public.cooperative_tasks(supplier_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
DROP POLICY IF EXISTS "Allow read/write for app prototype" ON public.organizations;
DROP POLICY IF EXISTS organization_access ON public.organizations;
CREATE POLICY organization_access ON public.organizations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = organizations.id AND m.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = organizations.id AND m.user_id = (SELECT auth.uid())));

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppliers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
DROP POLICY IF EXISTS "Allow read/write for app prototype" ON public.suppliers;
DROP POLICY IF EXISTS organization_access ON public.suppliers;
CREATE POLICY organization_access ON public.suppliers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = suppliers.organization_id AND m.user_id = (SELECT auth.uid())) AND (suppliers.cooperative_id IS NULL OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = suppliers.cooperative_id AND m.user_id = (SELECT auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = suppliers.organization_id AND m.user_id = (SELECT auth.uid())) AND (suppliers.cooperative_id IS NULL OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = suppliers.cooperative_id AND m.user_id = (SELECT auth.uid()))));

ALTER TABLE public.land_plots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.land_plots FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_plots TO authenticated;
DROP POLICY IF EXISTS "Allow read/write for app prototype" ON public.land_plots;
DROP POLICY IF EXISTS organization_access ON public.land_plots;
CREATE POLICY organization_access ON public.land_plots FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = land_plots.supplier_id AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = s.organization_id AND m.user_id = (SELECT auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = land_plots.supplier_id AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = s.organization_id AND m.user_id = (SELECT auth.uid()))));

ALTER TABLE public.delivery_lots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_lots FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_lots TO authenticated;
DROP POLICY IF EXISTS "Allow read/write for app prototype" ON public.delivery_lots;
DROP POLICY IF EXISTS organization_access ON public.delivery_lots;
CREATE POLICY organization_access ON public.delivery_lots FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = delivery_lots.organization_id AND m.user_id = (SELECT auth.uid())) AND (delivery_lots.supplier_id IS NULL OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = delivery_lots.supplier_id AND s.organization_id = delivery_lots.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = delivery_lots.organization_id AND m.user_id = (SELECT auth.uid())) AND (delivery_lots.supplier_id IS NULL OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = delivery_lots.supplier_id AND s.organization_id = delivery_lots.organization_id)));

ALTER TABLE public.lot_plot_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lot_plot_allocations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lot_plot_allocations TO authenticated;
DROP POLICY IF EXISTS "Allow read/write for app prototype" ON public.lot_plot_allocations;
DROP POLICY IF EXISTS organization_access ON public.lot_plot_allocations;
CREATE POLICY organization_access ON public.lot_plot_allocations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.delivery_lots l JOIN public.land_plots p ON p.id = lot_plot_allocations.plot_id JOIN public.suppliers s ON s.id = p.supplier_id WHERE l.id = lot_plot_allocations.lot_id AND l.organization_id = s.organization_id AND l.supplier_id = s.id AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = l.organization_id AND m.user_id = (SELECT auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_lots l JOIN public.land_plots p ON p.id = lot_plot_allocations.plot_id JOIN public.suppliers s ON s.id = p.supplier_id WHERE l.id = lot_plot_allocations.lot_id AND l.organization_id = s.organization_id AND l.supplier_id = s.id AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = l.organization_id AND m.user_id = (SELECT auth.uid()))));

ALTER TABLE public.cooperative_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cooperative_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cooperative_tasks TO authenticated;
DROP POLICY IF EXISTS "Allow read/write for app prototype" ON public.cooperative_tasks;
DROP POLICY IF EXISTS organization_access ON public.cooperative_tasks;
CREATE POLICY organization_access ON public.cooperative_tasks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = cooperative_tasks.supplier_id AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = s.organization_id AND m.user_id = (SELECT auth.uid()))) AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = cooperative_tasks.cooperative_id AND m.user_id = (SELECT auth.uid())) AND (cooperative_tasks.plot_id IS NULL OR EXISTS (SELECT 1 FROM public.land_plots p WHERE p.id = cooperative_tasks.plot_id AND p.supplier_id = cooperative_tasks.supplier_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = cooperative_tasks.supplier_id AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = s.organization_id AND m.user_id = (SELECT auth.uid()))) AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = cooperative_tasks.cooperative_id AND m.user_id = (SELECT auth.uid())) AND (cooperative_tasks.plot_id IS NULL OR EXISTS (SELECT 1 FROM public.land_plots p WHERE p.id = cooperative_tasks.plot_id AND p.supplier_id = cooperative_tasks.supplier_id)));

COMMIT;
