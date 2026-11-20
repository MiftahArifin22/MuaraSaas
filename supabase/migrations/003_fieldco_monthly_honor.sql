-- Honor fieldco (koordinator lapangan koperasi) dibayar tetap per bulan, bukan per tugas.
-- Jalankan seluruh file di SQL Editor Supabase, setelah 001 dan 002. Uji di staging dahulu.
BEGIN;
SET LOCAL search_path = public;

-- 1. Fieldco: koordinator lapangan milik satu koperasi mitra.
CREATE TABLE IF NOT EXISTS fieldcos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  monthly_honor_idr NUMERIC(14,2) NOT NULL DEFAULT 16000000 CHECK (monthly_honor_idr >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Satu fieldco aktif per koperasi.
CREATE UNIQUE INDEX IF NOT EXISTS fieldcos_one_active_per_coop ON fieldcos(cooperative_id) WHERE active;

-- 2. Rekap honor per fieldco per bulan. Satu baris per bulan.
CREATE TABLE IF NOT EXISTS fieldco_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fieldco_id UUID NOT NULL REFERENCES fieldcos(id) ON DELETE CASCADE,
  period_month DATE NOT NULL CHECK (period_month = date_trunc('month', period_month)::date), -- tanggal 1 tiap bulan
  honor_idr NUMERIC(14,2) NOT NULL CHECK (honor_idr >= 0),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paid')),
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fieldco_id, period_month),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS fieldco_payroll_period_idx ON fieldco_payroll(period_month);

-- 3. Biaya per tugas tidak dipakai lagi. Kolom dibiarkan agar data lama aman.
COMMENT ON COLUMN cooperative_tasks.task_fee_idr IS 'Tidak dipakai. Honor dibayar tetap per bulan lewat fieldco_payroll.';

-- 4. RLS: sama seperti cooperative_tasks, hanya anggota organisasi koperasi.
ALTER TABLE fieldcos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fieldcos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fieldcos TO authenticated;
DROP POLICY IF EXISTS organization_access ON fieldcos;
CREATE POLICY organization_access ON fieldcos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = fieldcos.cooperative_id AND m.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = fieldcos.cooperative_id AND m.user_id = (SELECT auth.uid())));

ALTER TABLE fieldco_payroll ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fieldco_payroll FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fieldco_payroll TO authenticated;
DROP POLICY IF EXISTS organization_access ON fieldco_payroll;
CREATE POLICY organization_access ON fieldco_payroll FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM fieldcos f JOIN organization_members m ON m.organization_id = f.cooperative_id WHERE f.id = fieldco_payroll.fieldco_id AND m.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM fieldcos f JOIN organization_members m ON m.organization_id = f.cooperative_id WHERE f.id = fieldco_payroll.fieldco_id AND m.user_id = (SELECT auth.uid())));

-- 5. Data contoh: fieldco tiap koperasi yang sudah ada (nama fiktif) dan honor Okt-Nov 2026.
INSERT INTO fieldcos (cooperative_id, full_name)
SELECT o.id, CASE o.name WHEN 'Koperasi Rimba Muara' THEN 'Andi Prasetyo' ELSE 'Siti Nurhaliza' END
FROM organizations o
WHERE o.org_type = 'cooperative' AND o.name IN ('Koperasi Rimba Muara', 'Koperasi Tunas Batanghari')
  AND NOT EXISTS (SELECT 1 FROM fieldcos f WHERE f.cooperative_id = o.id AND f.active);

INSERT INTO fieldco_payroll (fieldco_id, period_month, honor_idr, status, paid_at)
SELECT f.id, v.period_month, f.monthly_honor_idr, v.status, v.paid_at
FROM fieldcos f
CROSS JOIN (VALUES
  (DATE '2026-10-01', 'paid',    TIMESTAMPTZ '2026-11-01 03:00:00+00'),
  (DATE '2026-11-01', 'running', NULL::timestamptz)
) AS v(period_month, status, paid_at)
ON CONFLICT (fieldco_id, period_month) DO NOTHING;

COMMIT;
