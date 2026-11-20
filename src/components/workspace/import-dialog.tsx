"use client";

import { Download, FileUp, RotateCcw } from "lucide-react";
import { useState } from "react";
import { importPlots } from "@/lib/demo-actions";
import { updateDemo } from "@/lib/demo-store";
import { importColumns, previewImport, sampleCsv, sampleJson, type PreviewRow } from "@/lib/import";
import type { DemoData } from "@/lib/mock-data";
import { Dialog, downloadFile, ErrorNotice, timestamp } from "./ui";

const maxBytes = 2 * 1024 * 1024;

export function ImportDialog({ data, onDismiss, onImported }: { data: DemoData; onDismiss: () => void; onImported: (count: number, supplierId?: string) => void }) {
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const valid = rows?.filter((row) => row.value) ?? [];
  const invalid = rows?.filter((row) => !row.value) ?? [];

  function preview(text: string, name: string) {
    setError("");
    try {
      setRows(previewImport(text, name, data));
    } catch (failure) {
      setRows(null);
      setError(failure instanceof Error ? failure.message : "File tidak dapat dibaca.");
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > maxBytes) { setError("Ukuran file maksimal 2 MB. Pecah data menjadi beberapa file."); return; }
    if (!/\.(csv|json)$/i.test(file.name)) { setError("Gunakan file berformat .csv atau .json."); return; }
    setReading(true);
    try {
      const text = await file.text();
      setSource(text);
      setFileName(file.name);
      preview(text, file.name);
    } catch {
      setError("File tidak dapat dibaca. Coba simpan ulang sebagai CSV UTF-8.");
    } finally {
      setReading(false);
    }
  }

  function save() {
    try {
      updateDemo((current) => importPlots(current, valid.map((row) => row.value!), timestamp()));
      onImported(valid.length, valid[0]?.value?.supplier.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impor gagal. Tidak ada data yang disimpan.");
    }
  }

  return (
    <Dialog wide title="Impor data lahan" onDismiss={onDismiss} description="Unggah daftar lahan (CSV atau JSON). Data dicek dulu sebelum disimpan.">
      <div className="import-steps">
        <section className="import-format" aria-labelledby="format-title">
          <h3 id="format-title">1. Siapkan file</h3>
          <p>Satu baris per lahan. Paling mudah: unduh contoh lalu isi.</p>
          <details className="geometry-details"><summary>Lihat kolom</summary><ul className="column-list">{importColumns.map((column) => <li key={column.key}><code>{column.key}</code><span>{column.label}</span></li>)}</ul></details>
          <div className="actions">
            <button type="button" className="button button-secondary button-small" onClick={() => downloadFile("contoh-impor-lahan.csv", `﻿${sampleCsv()}`, "text/csv;charset=utf-8")}><Download size={15} /> Contoh CSV</button>
            <button type="button" className="button button-secondary button-small" onClick={() => downloadFile("contoh-impor-lahan.json", sampleJson(), "application/json")}><Download size={15} /> Contoh JSON</button>
            <button type="button" className="button button-secondary button-small" onClick={() => { const text = sampleCsv(); setSource(text); setFileName("contoh.csv"); preview(text, "contoh.csv"); }}>Coba dengan contoh</button>
          </div>
        </section>

        <section aria-labelledby="upload-title" className="form-stack">
          <h3 id="upload-title">2. Pilih file</h3>
          <label className="file-drop">
            <FileUp size={20} aria-hidden="true" />
            <span><strong>{reading ? "Membaca file…" : fileName || "Pilih file .csv atau .json"}</strong><small>Maks. 2 MB</small></span>
            <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => readFile(event.target.files?.[0])} />
          </label>
          <label>Atau tempel isinya<textarea className="mono" rows={4} value={source} onChange={(event) => { setSource(event.target.value); setRows(null); }} placeholder="kode_pemasok,nama_pemasok,..." /></label>
          <div className="actions"><button type="button" className="button button-secondary" disabled={!source.trim()} onClick={() => preview(source, fileName || "tempel.csv")}>Periksa data</button>{rows && <button type="button" className="button button-secondary button-small" onClick={() => { setRows(null); setSource(""); setFileName(""); setError(""); }}><RotateCcw size={15} /> Mulai ulang</button>}</div>
        </section>
      </div>

      <ErrorNotice message={error} />

      {rows && (
        <section className="import-preview" aria-labelledby="preview-title" aria-live="polite">
          <div className="panel-heading"><div><h3 id="preview-title">3. Hasil pengecekan</h3><p><strong className="text-ok">{valid.length} baris valid</strong> · <strong className={invalid.length ? "text-bad" : undefined}>{invalid.length} baris gagal</strong> dari {rows.length} baris</p></div></div>
          <div className="table-wrap preview-table"><table className="data-table">
            <thead><tr><th>Baris</th><th>Kode lahan</th><th>Pemilik</th><th>Hasil</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.line} className={row.value ? undefined : "error-row"}>
                <td className="mono">{row.line}</td><td className="mono">{row.code}</td><td>{row.owner}</td>
                <td>{row.value ? <span className="text-ok">Siap disimpan{row.value.newSupplier ? " · pemasok baru" : ""}</span> : <ul className="row-errors">{row.errors.map((item) => <li key={item}>{item}</li>)}</ul>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {invalid.length > 0 && valid.length > 0 && <p className="field-hint">Baris yang gagal tidak disimpan.</p>}
        </section>
      )}

      <div className="actions dialog-actions">
        <button type="button" className="button button-secondary" onClick={onDismiss}>Batal</button>
        <button type="button" className="button button-primary" disabled={!valid.length} onClick={save}>Simpan {valid.length || ""} lahan valid</button>
      </div>
    </Dialog>
  );
}
