# MUARA — Mekanisme Uji Asal dan Registri Akuntabel

Workspace demo untuk perusahaan pulp, kertas, dan serpih kayu: pemeriksaan pemasok berdasarkan risiko,
penelusuran bukti asal setiap pasokan, dan pendampingan pemasok melalui mitra koperasi.

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npm test             # tes logika lot, transisi tugas, dan impor
npm run build && npm start
```

## Mode

- **Demo lokal** — bila `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` kosong,
  `/dashboard` terbuka tanpa login.
- **Supabase** — bila keduanya diisi di `.env.local`, workspace memerlukan login akun yang terdaftar
  di `organization_members` (lihat `supabase/bootstrap_workspace.sql`).

Pada kedua mode, data workspace adalah data fiktif yang disimpan di `localStorage` browser
(kunci `muara-demo-v2`) dan dapat dikembalikan lewat **Reset data demo**.

## Supabase

- `supabase/migrations/001_init_muara.sql` — skema dan RLS per organisasi.
- `supabase/migrations/002_lot_rpc_and_task_rules.sql` — fungsi `save_delivery_lot` (lot dan alokasi
  dalam satu transaksi), aturan transisi status tugas, dan pencegahan tugas aktif ganda per lahan.
  Belum dijalankan pada proyek remote. Uji di staging terlebih dahulu.
- Gunakan hanya publishable/anon key di `.env.local`. Jangan menaruh service role key di variabel `NEXT_PUBLIC_*`.
