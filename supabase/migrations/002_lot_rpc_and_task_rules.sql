-- 002: Aturan penyimpanan lot dan transisi tugas mitra di sisi database.
-- Jalankan setelah 001_init_muara.sql. Migration ini TIDAK mengubah atau menghapus data yang ada.
-- Status: belum dijalankan pada proyek Supabase remote. Uji di proyek staging terlebih dahulu.

BEGIN;
SET LOCAL search_path = public;

-- Dasar kapasitas lahan agar pemeriksaan kapasitas dapat ditelusuri.
ALTER TABLE public.land_plots ADD COLUMN IF NOT EXISTS capacity_basis TEXT;
ALTER TABLE public.land_plots ADD COLUMN IF NOT EXISTS capacity_recorded_on DATE;

-- Lingkup, riwayat, dan kendala tugas mitra.
ALTER TABLE public.cooperative_tasks ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE public.cooperative_tasks ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.cooperative_tasks ADD COLUMN IF NOT EXISTS obstacles JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Satu lahan hanya boleh memiliki satu tugas aktif (mencegah penugasan ganda).
CREATE UNIQUE INDEX IF NOT EXISTS cooperative_tasks_one_active_per_plot
  ON public.cooperative_tasks (plot_id)
  WHERE plot_id IS NOT NULL AND status <> 'verified_completed';

-- Transisi status yang diizinkan:
-- Ditugaskan → Dikerjakan → Dikirim untuk ditinjau → Perlu perbaikan / Hasil diterima.
CREATE OR REPLACE FUNCTION public.check_cooperative_task_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'assigned' AND NEW.status IN ('in_progress', 'submitted_review'))
    OR (OLD.status = 'in_progress' AND NEW.status = 'submitted_review')
    OR (OLD.status = 'revision_requested' AND NEW.status IN ('in_progress', 'submitted_review'))
    OR (OLD.status = 'submitted_review' AND NEW.status IN ('revision_requested', 'verified_completed'))
  ) THEN
    RAISE EXCEPTION 'Perubahan status tugas dari % ke % tidak diizinkan.', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'revision_requested' AND coalesce(trim(NEW.review_note), '') = '' THEN
    RAISE EXCEPTION 'Catatan pemeriksa wajib diisi saat meminta perbaikan.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cooperative_task_transition ON public.cooperative_tasks;
CREATE TRIGGER cooperative_task_transition
  BEFORE UPDATE OF status ON public.cooperative_tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_cooperative_task_transition();

-- Menyimpan lot beserta seluruh alokasinya dalam satu transaksi.
-- Bila satu validasi gagal, tidak ada perubahan yang tersimpan.
-- SECURITY INVOKER: kebijakan RLS organisasi dari 001 tetap berlaku untuk pemanggil.
CREATE OR REPLACE FUNCTION public.save_delivery_lot(p_lot JSONB, p_allocations JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lot_id UUID;
  v_weight NUMERIC(12, 2);
  v_rows INT;
  v_plots INT;
  v_total NUMERIC(14, 2);
BEGIN
  v_weight := (p_lot ->> 'shipment_weight_tons')::NUMERIC;
  IF v_weight IS NULL OR v_weight <= 0 THEN
    RAISE EXCEPTION 'Berat kiriman harus lebih dari 0 ton.' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'Tambahkan minimal satu lahan sumber.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_allocations) a
    WHERE a ->> 'plot_id' IS NULL OR coalesce((a ->> 'allocated_tons')::NUMERIC, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'Setiap alokasi wajib memiliki lahan dan tonase lebih dari 0 ton.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*), count(DISTINCT a ->> 'plot_id'), sum(round((a ->> 'allocated_tons')::NUMERIC, 2))
    INTO v_rows, v_plots, v_total
    FROM jsonb_array_elements(p_allocations) a;
  IF v_rows <> v_plots THEN
    RAISE EXCEPTION 'Lahan sumber yang sama dipilih lebih dari sekali.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_total <> round(v_weight, 2) THEN
    RAISE EXCEPTION 'Total alokasi % ton harus sama dengan berat kiriman % ton.', v_total, v_weight USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.delivery_lots (
    organization_id, supplier_id, lot_number, mill_receiving_ref, transport_doc_ref,
    wood_species, shipment_weight_tons, delivery_date, export_product_group
  ) VALUES (
    (p_lot ->> 'organization_id')::UUID,
    (p_lot ->> 'supplier_id')::UUID,
    p_lot ->> 'lot_number',
    coalesce(p_lot ->> 'mill_receiving_ref', ''),
    coalesce(p_lot ->> 'transport_doc_ref', ''),
    coalesce(nullif(p_lot ->> 'wood_species', ''), 'Acacia mangium'),
    v_weight,
    (p_lot ->> 'delivery_date')::DATE,
    nullif(p_lot ->> 'export_product_group', '')
  )
  ON CONFLICT (lot_number) DO UPDATE SET
    supplier_id = EXCLUDED.supplier_id,
    mill_receiving_ref = EXCLUDED.mill_receiving_ref,
    transport_doc_ref = EXCLUDED.transport_doc_ref,
    wood_species = EXCLUDED.wood_species,
    shipment_weight_tons = EXCLUDED.shipment_weight_tons,
    delivery_date = EXCLUDED.delivery_date,
    export_product_group = EXCLUDED.export_product_group
  WHERE public.delivery_lots.organization_id = EXCLUDED.organization_id
  RETURNING id INTO v_lot_id;

  IF v_lot_id IS NULL THEN
    RAISE EXCEPTION 'Nomor lot sudah dipakai organisasi lain.' USING ERRCODE = 'unique_violation';
  END IF;

  DELETE FROM public.lot_plot_allocations WHERE lot_id = v_lot_id;
  INSERT INTO public.lot_plot_allocations (lot_id, plot_id, allocated_tons)
  SELECT v_lot_id, (a ->> 'plot_id')::UUID, round((a ->> 'allocated_tons')::NUMERIC, 2)
  FROM jsonb_array_elements(p_allocations) a;

  RETURN v_lot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_delivery_lot(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_delivery_lot(JSONB, JSONB) TO authenticated;

COMMIT;
