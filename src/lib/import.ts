import Papa from "papaparse";
import { z } from "zod";
import type { ImportedRow } from "./demo-actions";
import type { DemoData } from "./mock-data";
import { parseGeometry } from "./screening";

export const importColumns = [
  { key: "kode_pemasok", label: "Kode pemasok", example: "PS-005" },
  { key: "nama_pemasok", label: "Nama pemasok (wajib bila pemasok baru)", example: "CV Rimba Baru" },
  { key: "jenis_pemasok", label: "Jenis pemasok", example: "Pengepul" },
  { key: "kode_lahan", label: "Kode lahan unik", example: "LH-101" },
  { key: "pemilik", label: "Nama pemilik", example: "Agus Salim" },
  { key: "desa", label: "Desa/kecamatan", example: "Pematang Jering" },
  { key: "jenis_dokumen", label: "Jenis dokumen lahan", example: "SKT" },
  { key: "nomor_dokumen", label: "Nomor dokumen (boleh kosong)", example: "SKT-DEMO-101" },
  { key: "luas_ha", label: "Luas (ha)", example: "12,5" },
  { key: "kapasitas_ton_tahun", label: "Kapasitas (ton/tahun)", example: "40" },
  { key: "dasar_kapasitas", label: "Dasar kapasitas", example: "Inventarisasi tegakan 2026" },
  { key: "geometri", label: "Poligon GeoJSON", example: '{"type":"Polygon","coordinates":[[[103.78,-1.69],[103.784,-1.69],[103.784,-1.687],[103.78,-1.687],[103.78,-1.69]]]}' },
] as const;

const sampleRows = [
  { kode_pemasok: "PS-001", nama_pemasok: "", jenis_pemasok: "", kode_lahan: "LH-101", pemilik: "Agus Salim", desa: "Pematang Jering", jenis_dokumen: "SKT", nomor_dokumen: "SKT-DEMO-101", luas_ha: "12,5", kapasitas_ton_tahun: "40", dasar_kapasitas: "Inventarisasi tegakan 2026", geometri: '{"type":"Polygon","coordinates":[[[103.78,-1.69],[103.784,-1.69],[103.784,-1.687],[103.78,-1.687],[103.78,-1.69]]]}' },
  { kode_pemasok: "PS-005", nama_pemasok: "CV Rimba Baru", jenis_pemasok: "Pengepul", kode_lahan: "LH-102", pemilik: "Lestari Ayu", desa: "Sungai Gelam", jenis_dokumen: "SHM", nomor_dokumen: "", luas_ha: "8", kapasitas_ton_tahun: "25", dasar_kapasitas: "Perkiraan pemasok", geometri: '{"type":"Polygon","coordinates":[[[103.84,-1.665],[103.844,-1.665],[103.844,-1.662],[103.84,-1.662],[103.84,-1.665]]]}' },
];

export function sampleCsv() {
  return Papa.unparse(sampleRows, { columns: importColumns.map(({ key }) => key) });
}

export function sampleJson() {
  return JSON.stringify(sampleRows, null, 2);
}

function decimal(label: string, max: number) {
  return z.string().trim().min(1, `${label} wajib diisi.`)
    .transform((value) => Number(value.replace(/\s/g, "").replace(",", ".")))
    .refine((value) => Number.isFinite(value) && value > 0, `${label} harus angka lebih dari 0.`)
    .refine((value) => value <= max, `${label} maksimal ${max.toLocaleString("id-ID")}.`);
}

const text = (label: string, max: number) => z.string().trim().min(1, `${label} wajib diisi.`).max(max, `${label} maksimal ${max} karakter.`);
const code = (label: string) => z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, `${label} hanya huruf kapital, angka, atau tanda hubung.`);

const rowSchema = z.object({
  kode_pemasok: code("Kode pemasok"),
  nama_pemasok: z.string().trim().max(100, "Nama pemasok maksimal 100 karakter.").default(""),
  jenis_pemasok: z.string().trim().max(40).default(""),
  kode_lahan: code("Kode lahan"),
  pemilik: text("Nama pemilik", 100),
  desa: text("Desa", 80),
  jenis_dokumen: text("Jenis dokumen", 80),
  nomor_dokumen: z.string().trim().max(100, "Nomor dokumen maksimal 100 karakter.").default(""),
  luas_ha: decimal("Luas", 100_000),
  kapasitas_ton_tahun: decimal("Kapasitas", 1_000_000),
  dasar_kapasitas: text("Dasar kapasitas", 160),
  geometri: z.string().trim().min(1, "Poligon GeoJSON wajib diisi."),
});

export type PreviewRow = { line: number; code: string; owner: string; errors: string[]; value?: ImportedRow };

const maxRows = 500;

function readRecords(source: string, fileName: string): { records: Record<string, unknown>[]; firstLine: number } {
  const trimmed = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!trimmed) throw new Error("File kosong. Gunakan contoh format sebagai acuan.");
  if (fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("[")) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch { throw new Error("JSON tidak valid. Pastikan isi file berupa array objek seperti contoh format."); }
    if (!Array.isArray(parsed)) throw new Error("JSON harus berupa array objek, satu objek per lahan.");
    return { records: parsed.map((item) => (item && typeof item === "object" ? item : {}) as Record<string, unknown>), firstLine: 1 };
  }
  const result = Papa.parse<Record<string, string>>(trimmed, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim().toLowerCase() });
  const missing = importColumns.filter(({ key }) => !result.meta.fields?.includes(key)).map(({ key }) => key);
  if (missing.length) throw new Error(`Kolom belum ada: ${missing.join(", ")}. Unduh contoh CSV untuk melihat urutan kolom.`);
  return { records: result.data, firstLine: 2 };
}

export function previewImport(source: string, fileName: string, data: DemoData): PreviewRow[] {
  const { records, firstLine } = readRecords(source, fileName);
  if (records.length > maxRows) throw new Error(`Maksimal ${maxRows} baris per impor. File berisi ${records.length} baris.`);
  const seenPlots = new Set(data.plots.map((plot) => plot.id));
  const newSuppliers = new Map<string, string>();

  return records.map((record, index) => {
    const line = index + firstLine;
    const input = Object.fromEntries(importColumns.map(({ key }) => [key, record[key] == null ? "" : String(record[key])]));
    const parsed = rowSchema.safeParse(input);
    const preview: PreviewRow = { line, code: String(input.kode_lahan ?? "").trim() || "—", owner: String(input.pemilik ?? "").trim() || "—", errors: [] };
    if (!parsed.success) {
      preview.errors = [...new Set(parsed.error.issues.map((issue) => issue.message))];
      return preview;
    }
    const row = parsed.data;
    let geometry;
    try { geometry = parseGeometry(row.geometri); } catch (failure) { preview.errors.push(`Poligon: ${failure instanceof Error ? failure.message : "tidak valid."}`); }
    if (seenPlots.has(row.kode_lahan)) preview.errors.push(`Kode lahan ${row.kode_lahan} sudah terdaftar atau muncul dua kali.`);
    const existing = data.suppliers.find((supplier) => supplier.id === row.kode_pemasok);
    const pendingName = newSuppliers.get(row.kode_pemasok);
    if (!existing && !pendingName && !row.nama_pemasok) preview.errors.push(`Pemasok ${row.kode_pemasok} belum terdaftar. Isi nama_pemasok untuk menambahkannya.`);
    if (preview.errors.length || !geometry) return preview;

    seenPlots.add(row.kode_lahan);
    if (!existing && !pendingName) newSuppliers.set(row.kode_pemasok, row.nama_pemasok);
    const supplier = existing ?? {
      id: row.kode_pemasok, name: pendingName ?? row.nama_pemasok, type: row.jenis_pemasok || "Pemasok",
      location: row.desa, cooperativeId: data.cooperatives[0]?.id ?? "",
    };
    preview.value = {
      newSupplier: !existing,
      supplier,
      plot: {
        id: row.kode_lahan, supplierId: supplier.id, owner: row.pemilik, village: row.desa,
        documentType: row.jenis_dokumen, documentRef: row.nomor_dokumen, areaHa: row.luas_ha,
        annualCapacity: row.kapasitas_ton_tahun, capacityBasis: row.dasar_kapasitas, capacityDate: "",
        geometry, reviewed: false,
      },
    };
    return preview;
  });
}
