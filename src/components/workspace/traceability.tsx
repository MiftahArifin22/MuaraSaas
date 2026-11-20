"use client";

import { ArrowDown, ArrowRight, Building2, CheckCircle2, Download, Factory, FlaskConical, LandPlot, Package, Pencil, Plus, Printer, Search, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useState, type FormEvent } from "react";
import { lotInputErrors, saveLot, type LotInput } from "@/lib/demo-actions";
import { updateDemo, useDemo } from "@/lib/demo-store";
import type { DemoData, Lot } from "@/lib/mock-data";
import { formatDate, formatDateTime, formatNumber, issueCategoryLabels, jakartaDate, riskLabels, validateLot, type IssueCategory, type LotValidation } from "@/lib/screening";
import { Dialog, downloadJson, EmptyState, ErrorNotice, PageHeading, RiskBadge, SuccessNotice, timestamp, useParamSelection } from "./ui";

const unlinkedProduct = "Belum tertaut ke kelompok produk";
type Filter = "all" | "perlu" | "green";
const filters: { value: Filter; label: string }[] = [{ value: "all", label: "Semua" }, { value: "perlu", label: "Perlu ditinjau" }, { value: "green", label: "Lolos" }];
const categoryOrder: IssueCategory[] = ["berat", "risiko", "kapasitas", "pemasok", "bukti"];

type Row = { key: number; plotId: string; amount: string };
type Draft = Omit<LotInput, "weight" | "allocations"> & { weight: string };

function nextLotId(data: DemoData, date: string) {
  const prefix = `LOT-${date.slice(2, 4)}${date.slice(5, 7)}-`;
  const sequence = Math.max(0, ...data.lots.filter((lot) => lot.id.startsWith(prefix)).map((lot) => Number(lot.id.slice(prefix.length)) || 0)) + 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

function toNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));
}

function LotEditor({ lot, data, today, onDismiss, onSaved }: { lot?: Lot; data: DemoData; today: string; onDismiss: () => void; onSaved: (id: string) => void }) {
  const isNew = !lot;
  const [draft, setDraft] = useState<Draft>(() => lot
    ? { ...lot, weight: String(lot.weight) }
    : { id: nextLotId(data, today), supplierId: data.suppliers[0]?.id ?? "", receivingRef: "", transportRef: "", species: "Acacia mangium", date: today, exportGroup: "", weight: "" });
  const [rows, setRows] = useState<Row[]>(() => lot ? lot.allocations.map(({ plotId, tons }, key) => ({ key, plotId, amount: String(tons) })) : [{ key: 0, plotId: "", amount: "" }]);
  const [nextKey, setNextKey] = useState(rows.length);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const input: LotInput = { ...draft, weight: toNumber(draft.weight), allocations: rows.map(({ plotId, amount }) => ({ plotId, tons: toNumber(amount) })) };
  const preview = validateLot({ ...input, allocations: input.allocations.filter(({ tons }) => Number.isFinite(tons)) }, { ...data, lots: isNew ? data.lots : data.lots.filter((item) => item.id !== lot.id) });
  const inputErrors = lotInputErrors({ ...input, id: input.id.trim().toUpperCase() }, data, isNew);
  const total = input.allocations.reduce((sum, { tons }) => sum + (Number.isFinite(tons) ? tons : 0), 0);
  const ownPlots = data.plots.filter((plot) => plot.supplierId === draft.supplierId);
  const otherPlots = data.plots.filter((plot) => plot.supplierId !== draft.supplierId);
  const set = (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [field]: event.target.value });
  const setRow = (key: number, change: Partial<Row>) => setRows(rows.map((row) => row.key === key ? { ...row, ...change } : row));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (inputErrors.length) { setError("Perbaiki isian di atas dulu."); return; }
    try {
      updateDemo((current) => saveLot(current, input, isNew, timestamp()));
      onSaved(input.id.trim().toUpperCase());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Lot tidak tersimpan. Coba kembali.");
    }
  }

  return (
    <Dialog wide title={isNew ? "Catat penerimaan pasokan" : `Ubah data ${lot.id}`} onDismiss={onDismiss} description="Isi data kiriman, lalu bagi beratnya ke lahan asal kayu.">
      <form className="form-stack" onSubmit={save} noValidate>
        <fieldset className="form-section">
          <legend>Data kiriman</legend>
          <div className="form-grid three">
            <label>Nomor lot<input className="mono" value={draft.id} onChange={set("id")} readOnly={!isNew} required maxLength={40} /></label>
            <label>Pemasok<select value={draft.supplierId} onChange={set("supplierId")} required>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label>Tanggal terima<input type="date" value={draft.date} onChange={set("date")} required /></label>
            <label>Berat kiriman (ton)<input type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.weight} onChange={set("weight")} required placeholder="0,00" /></label>
            <label>Ref. penerimaan pabrik<input className="mono" value={draft.receivingRef} onChange={set("receivingRef")} maxLength={60} placeholder="GR / tiket timbang" /></label>
            <label>Dokumen angkutan<input className="mono" value={draft.transportRef} onChange={set("transportRef")} maxLength={60} placeholder="Nota angkutan" /></label>
            <label>Jenis kayu<input value={draft.species} onChange={set("species")} maxLength={60} /></label>
            <label>Kelompok produk <small>Opsional</small><input className="mono" value={draft.exportGroup} onChange={set("exportGroup")} maxLength={60} placeholder={unlinkedProduct} /></label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Asal kayu</legend>
          {rows.map((row, index) => (
            <div className="allocation-input" key={row.key}>
              <label>Lahan {index + 1}<select value={row.plotId} onChange={(event) => setRow(row.key, { plotId: event.target.value })}>
                <option value="">Pilih lahan</option>
                <optgroup label="Lahan pemasok ini">{ownPlots.map((plot) => <option value={plot.id} key={plot.id}>{plot.id} · {plot.owner} · {formatNumber(plot.annualCapacity)} t/th</option>)}</optgroup>
                {otherPlots.length > 0 && <optgroup label="Lahan pemasok lain">{otherPlots.map((plot) => <option value={plot.id} key={plot.id}>{plot.id} · {plot.owner}</option>)}</optgroup>}
              </select></label>
              <label>Tonase<span className="input-unit"><input type="number" inputMode="decimal" min="0.01" step="0.01" value={row.amount} onChange={(event) => setRow(row.key, { amount: event.target.value })} placeholder="0,00" /><span>ton</span></span></label>
              <button type="button" className="icon-button" aria-label={`Hapus lahan ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((item) => item.key !== row.key))}><Trash2 size={18} /></button>
            </div>
          ))}
          <div className="allocation-summary">
            <button type="button" className="button button-secondary button-small" onClick={() => { setRows([...rows, { key: nextKey, plotId: "", amount: "" }]); setNextKey(nextKey + 1); }}><Plus size={16} /> Tambah lahan</button>
            <span className={`mono allocation-meter${Math.round(total * 100) === Math.round(toNumber(draft.weight) * 100) ? " meter-ok" : ""}`}>{formatNumber(total)} / {Number.isFinite(toNumber(draft.weight)) ? formatNumber(toNumber(draft.weight)) : "–"} ton</span>
          </div>
        </fieldset>

        {attempted && inputErrors.length > 0 && <ul className="validation-list" aria-label="Isian yang perlu diperbaiki">{inputErrors.map((message) => <li key={message} className="validation-red"><span aria-hidden="true" />{message}</li>)}</ul>}
        {!inputErrors.length && (
          <div className="preview-box" aria-live="polite">
            <div className="preview-head"><strong>Hasil pengecekan</strong><RiskBadge risk={preview.risk} /></div>
            {preview.issues.length ? <ul className="issue-list">{preview.issues.map(({ message }, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul> : <p>Tidak ada temuan.</p>}
            {preview.risk !== "green" && <p className="field-hint">Lot tetap bisa disimpan. Temuannya akan tercatat.</p>}
          </div>
        )}
        <ErrorNotice message={error} />
        <div className="actions dialog-actions"><button type="button" className="button button-secondary" onClick={onDismiss}>Batal</button><button type="submit" className="button button-primary">{isNew ? "Simpan lot" : "Simpan perubahan"}</button></div>
      </form>
    </Dialog>
  );
}

function Arrow() {
  return <li className="chain-arrow" aria-hidden="true"><ArrowRight className="arrow-wide" size={18} /><ArrowDown className="arrow-narrow" size={18} /></li>;
}

function SupplyChain({ lot, validation, data }: { lot: Lot; validation: LotValidation; data: DemoData }) {
  const supplier = data.suppliers.find((item) => item.id === lot.supplierId);
  return (
    <ol className="supply-chain" aria-label="Rantai asal pasokan">
      <li className="chain-step chain-sources">
        <span className="chain-label"><LandPlot size={15} aria-hidden="true" /> Lahan sumber</span>
        {validation.sources.length ? validation.sources.map((source) => (
          <Link key={source.plotId || "kosong"} href={source.plot ? `/dashboard/due-diligence?pemasok=${source.plot.supplierId}&lahan=${source.plotId}` : "/dashboard/due-diligence"} className={`chain-node node-${source.screening?.risk ?? "yellow"}`}>
            <strong className="mono">{source.plotId || "Belum dipilih"}</strong>
            <span>{source.plot?.owner ?? "Tidak terdaftar"} · <b className="mono">{formatNumber(source.tons)} t</b></span>
            <small>{source.screening ? riskLabels[source.screening.risk] : "Belum tercatat"}{source.overCapacity ? " · melebihi kapasitas" : ""}</small>
          </Link>
        )) : <span className="chain-node node-yellow"><strong>Belum ada</strong><small>Alokasikan lahan sumber</small></span>}
      </li>
      <Arrow />
      <li className="chain-step">
        <span className="chain-label"><Building2 size={15} aria-hidden="true" /> Pemasok/perantara</span>
        <span className="chain-node"><strong>{supplier?.name ?? "Belum terdaftar"}</strong><small className="mono">{lot.supplierId}</small></span>
      </li>
      <Arrow />
      <li className="chain-step">
        <span className="chain-label"><Truck size={15} aria-hidden="true" /> Pengiriman</span>
        <span className={`chain-node${lot.transportRef ? "" : " node-yellow"}`}><strong className="mono">{lot.transportRef || "Dokumen angkutan kosong"}</strong><small>{lot.species || "Jenis kayu belum diisi"}</small></span>
      </li>
      <Arrow />
      <li className="chain-step">
        <span className="chain-label"><Factory size={15} aria-hidden="true" /> Penerimaan pabrik</span>
        <span className={`chain-node${lot.receivingRef ? "" : " node-yellow"}`}><strong className="mono">{lot.receivingRef || "Ref. penerimaan kosong"}</strong><small>{formatNumber(lot.weight)} ton · {formatDate(lot.date)}</small></span>
      </li>
      <Arrow />
      <li className="chain-step">
        <span className="chain-label"><Package size={15} aria-hidden="true" /> Kelompok produk</span>
        <span className={`chain-node${validation.productLinked ? "" : " node-muted"}`}><strong className={validation.productLinked ? "mono" : undefined}>{validation.productLinked ? lot.exportGroup : unlinkedProduct}</strong><small>{validation.productLinked ? "Tertaut" : "Belum ada data produksi"}</small></span>
      </li>
    </ol>
  );
}

function exportLot(lot: Lot, validation: LotValidation, data: DemoData) {
  const supplier = data.suppliers.find((item) => item.id === lot.supplierId);
  return {
    keterangan: "Data demo MUARA. Hasil pemeriksaan awal berdasarkan aturan aplikasi dan layer contoh, bukan analisis resmi.",
    dibuat_pada: timestamp(),
    lot: { nomor: lot.id, tanggal_terima: lot.date, berat_ton: lot.weight, jenis_kayu: lot.species },
    referensi_bukti: { penerimaan_pabrik: lot.receivingRef || null, dokumen_angkutan: lot.transportRef || null, pabrik: data.mill.name, referensi_pabrik: data.mill.reference },
    pemasok: supplier ? { kode: supplier.id, nama: supplier.name, jenis: supplier.type } : null,
    kelompok_produk: validation.productLinked ? lot.exportGroup : unlinkedProduct,
    sumber: validation.sources.map((source) => ({
      lahan: source.plotId, pemilik: source.plot?.owner ?? null, desa: source.plot?.village ?? null,
      dokumen: source.plot ? `${source.plot.documentType} ${source.plot.documentRef}`.trim() : null,
      alokasi_ton: source.tons, kapasitas_ton_per_tahun: source.plot?.annualCapacity ?? null,
      dasar_kapasitas: source.plot?.capacityBasis ?? null, tanggal_kapasitas: source.plot?.capacityDate ?? null,
      dipakai_lot_lain_ton: source.usedByOthers, lot_lain: source.otherLots, periode: validation.period,
      status_lahan: source.screening ? riskLabels[source.screening.risk] : "Belum tercatat",
    })),
    total_alokasi_ton: validation.total,
    hasil_pemeriksaan: riskLabels[validation.risk],
    temuan: validation.issues.map(({ category, risk, message }) => ({ kategori: issueCategoryLabels[category], tingkat: risk === "red" ? "Perlu investigasi" : "Perlu dilengkapi", alasan: message })),
    informasi_kurang: [...validation.missing, ...(validation.productLinked ? [] : [unlinkedProduct])],
  };
}

export function Traceability() {
  const { data } = useDemo();
  const params = useSearchParams();
  const statusParam = params.get("status");
  const [lotId, setLotId] = useParamSelection(params.get("lot"));
  const [filter, setFilter] = useParamSelection<Filter>(statusParam === "perlu" || statusParam === "green" ? statusParam : null);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ mode: "new"; today: string } | { mode: "edit" } | null>(null);
  const [feedback, setFeedback] = useState("");
  const activeFilter = filter ?? "all";
  const term = search.trim().toLocaleLowerCase("id-ID");

  const results = data.lots.map((lot) => ({ lot, validation: validateLot(lot, data), supplier: data.suppliers.find((item) => item.id === lot.supplierId) }));
  const visible = results.filter(({ lot, validation, supplier }) => (activeFilter === "all" || (activeFilter === "perlu" ? validation.risk !== "green" : validation.risk === "green"))
    && `${lot.id} ${supplier?.name ?? ""} ${lot.receivingRef} ${lot.transportRef}`.toLocaleLowerCase("id-ID").includes(term));
  const current = results.find((item) => item.lot.id === lotId) ?? visible[0] ?? results[0];

  if (!current) {
    return (
      <>
        <PageHeading title="Penelusuran pasokan" actions={<button type="button" className="button button-primary" onClick={() => setEditor({ mode: "new", today: jakartaDate(timestamp()) })}><Plus size={17} /> Catat penerimaan</button>}>Hubungkan setiap pasokan dengan lahan sumbernya.</PageHeading>
        <EmptyState title="Belum ada pasokan tercatat">Catat penerimaan pertama untuk mulai menelusuri asal kayu.</EmptyState>
        {editor?.mode === "new" && <LotEditor data={data} today={editor.today} onDismiss={() => setEditor(null)} onSaved={(id) => { setEditor(null); setLotId(id); setFeedback(`Lot ${id} tersimpan.`); }} />}
      </>
    );
  }

  const { lot, validation, supplier } = current;
  const shortfall = lot.weight - validation.total;
  const grouped = categoryOrder.map((category) => ({ category, items: validation.issues.filter((issue) => issue.category === category) })).filter(({ items }) => items.length);

  return (
    <>
      <PageHeading title="Penelusuran pasokan" actions={<>
        <button type="button" className="button button-secondary" onClick={() => window.print()}><Printer size={17} /> Cetak lot</button>
        <button type="button" className="button button-secondary" onClick={() => downloadJson(`muara-${lot.id}-demo`, exportLot(lot, validation, data))}><Download size={17} /> Unduh JSON</button>
        <button type="button" className="button button-primary" onClick={() => { setEditor({ mode: "new", today: jakartaDate(timestamp()) }); setFeedback(""); }}><Plus size={17} /> Catat penerimaan</button>
      </>}>
        Lihat asal kayu di setiap lot.
      </PageHeading>
      <p className="inline-notice notice-info no-print"><FlaskConical size={18} aria-hidden="true" /><span><strong>Data contoh.</strong> Cek kapasitas hanya tanda untuk ditinjau, bukan bukti tunggal asal kayu.</span></p>
      {feedback && <div className="no-print"><SuccessNotice onDismiss={() => setFeedback("")}>{feedback}</SuccessNotice></div>}

      <div className="print-header" aria-hidden="true"><strong>MUARA · Laporan penelusuran pasokan (data demo)</strong><span>{data.mill.name} · {data.mill.reference}</span></div>

      <div className="master-detail-grid">
        <section className="panel list-panel no-print" aria-labelledby="lot-list-title">
          <div className="panel-pad list-tools">
            <div className="panel-heading"><div><h2 id="lot-list-title">Lot pasokan</h2><p>{visible.length} dari {results.length}</p></div></div>
            <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Cari lot</span><input type="search" placeholder="Cari lot atau pemasok" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="filter-group" role="group" aria-label="Filter status lot">{filters.map(({ value, label }) => <button key={value} type="button" aria-pressed={activeFilter === value} onClick={() => setFilter(value === "all" ? null : value)}>{label}</button>)}</div>
          </div>
          <div className="select-list scroll-list">
            {visible.map(({ lot: entry, validation: result, supplier: owner }) => (
              <button key={entry.id} type="button" aria-pressed={entry.id === lot.id} onClick={() => { setLotId(entry.id); setFeedback(""); }}>
                <span className="select-row"><strong className="mono">{entry.id}</strong><RiskBadge risk={result.risk} /></span>
                <span className="record-id">{owner?.name ?? entry.supplierId} · {formatDate(entry.date)} · <span className="mono">{formatNumber(entry.weight)} t</span></span>
              </button>
            ))}
            {!visible.length && <EmptyState title="Tidak ada lot yang cocok" action={<button type="button" className="button button-secondary button-small" onClick={() => { setSearch(""); setFilter(null); }}>Hapus filter</button>} />}
          </div>
        </section>

        <div className="detail-stack">
          <section className="panel panel-pad" aria-labelledby="lot-title">
            <div className="panel-heading">
              <div><span className="record-id">Diterima {formatDate(lot.date)}</span><h2 className="mono" id="lot-title">{lot.id}</h2><p>{supplier?.name ?? "Pemasok belum terdaftar"} · <span className="mono">{formatNumber(lot.weight)} ton</span> {lot.species && <>· <i>{lot.species}</i></>}</p></div>
              <div className="lot-status"><RiskBadge risk={validation.risk} /><small>{validation.issues.length ? `${validation.issues.length} temuan` : "Tanpa temuan"}</small></div>
            </div>
            <div className="chain-host"><SupplyChain lot={lot} validation={validation} data={data} /></div>
          </section>

          <section className="panel panel-pad" aria-labelledby="allocation-title">
            <div className="panel-heading"><div><h2 id="allocation-title">Tonase per lahan</h2><p>Dibandingkan dengan kapasitas lahan tahun {validation.period}.</p></div><button type="button" className="button button-secondary button-small no-print" onClick={() => { setEditor({ mode: "edit" }); setFeedback(""); }}><Pencil size={16} /> Ubah alokasi</button></div>
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th>Lahan</th><th className="num">Lot ini</th><th className="num">Lot lain</th><th className="num">Sisa kapasitas</th><th>Dasar kapasitas</th><th>Status lahan</th></tr></thead>
              <tbody>
                {validation.sources.map((source) => (
                  <tr key={source.plotId} className={source.overCapacity ? "error-row" : undefined}>
                    <td><span className="mono">{source.plotId || "Belum dipilih"}</span><small>{source.plot ? `${source.plot.owner} · ${source.plot.documentType} ${source.plot.documentRef || "(nomor kosong)"}` : "Tidak terdaftar"}</small></td>
                    <td className="mono num"><strong>{formatNumber(source.tons)} ton</strong></td>
                    <td className="mono num">{formatNumber(source.usedByOthers)} ton{source.otherLots.map((id) => <small key={id}>{id}</small>)}</td>
                    <td className="mono num">{source.plot ? `${formatNumber(source.available)} dari ${formatNumber(source.plot.annualCapacity)} ton` : "—"}{source.overCapacity && <small className="text-bad">Melebihi kapasitas</small>}</td>
                    <td>{source.plot ? <>{source.plot.capacityBasis}<small>{source.plot.capacityDate ? `Dicatat ${formatDate(source.plot.capacityDate)}` : "Tanggal belum dicatat"}</small></> : "—"}</td>
                    <td>{source.screening ? <RiskBadge risk={source.screening.risk} /> : <RiskBadge risk="yellow" label="Belum tercatat" />}</td>
                  </tr>
                ))}
                {!validation.sources.length && <tr><td colSpan={6}>Belum ada lahan. Klik <strong>Ubah alokasi</strong>.</td></tr>}
              </tbody>
            </table></div>
            <div className="allocation-total"><span>Total alokasi</span><strong className="mono">{formatNumber(validation.total)} / {formatNumber(lot.weight)} ton</strong>{Math.abs(shortfall) > 0.001 ? <span className="risk-badge risk-red">{shortfall > 0 ? "Kurang" : "Lebih"} {formatNumber(Math.abs(shortfall))} ton</span> : <span className="risk-badge risk-green">Sesuai</span>}</div>
          </section>

          <section className="panel panel-pad" aria-labelledby="validation-title">
            <div className="panel-heading"><div><h2 id="validation-title">Hasil pemeriksaan</h2></div></div>
            {grouped.length ? grouped.map(({ category, items }) => (
              <Fragment key={category}>
                <h3 className="issue-heading">{issueCategoryLabels[category]}</h3>
                <ul className="validation-list">{items.map(({ message, risk }, index) => <li key={`${index}-${message}`} className={`validation-${risk}`}><span aria-hidden="true" /><b className="sr-only">{risk === "red" ? "Perlu investigasi: " : "Perlu dilengkapi: "}</b>{message}</li>)}</ul>
              </Fragment>
            )) : <p className="inline-notice notice-success"><CheckCircle2 size={18} aria-hidden="true" /><span><strong>Lolos pemeriksaan awal.</strong> Semua lahan asal lengkap dan sesuai kapasitas.</span></p>}

            <div className="missing-box">
              <h3>Yang masih kurang</h3>
              {validation.missing.length || !validation.productLinked ? (
                <ul className="issue-list">{validation.missing.map((item) => <li key={item}>{item}</li>)}{!validation.productLinked && <li>{unlinkedProduct}.</li>}</ul>
              ) : <p>Tidak ada.</p>}
            </div>
            <div className="actions no-print next-actions">
              {validation.issues.some(({ category }) => category === "bukti" || category === "risiko") && <Link className="button button-secondary button-small" href={`/dashboard/due-diligence?pemasok=${lot.supplierId}`}>Lengkapi data pemasok</Link>}
              {validation.issues.some(({ category }) => category === "berat" || category === "kapasitas" || category === "pemasok") && <button type="button" className="button button-secondary button-small" onClick={() => setEditor({ mode: "edit" })}>Perbaiki alokasi</button>}
            </div>
            <p className="print-only fine-print">Dicetak dari demo MUARA ({data.activity[0] ? formatDateTime(data.activity[0].at) : "—"}). Keputusan penerimaan tetap di tangan perusahaan.</p>
          </section>
        </div>
      </div>

      {editor?.mode === "new" && <LotEditor data={data} today={editor.today} onDismiss={() => setEditor(null)} onSaved={(id) => { setEditor(null); setFilter(null); setLotId(id); setFeedback(`Lot ${id} tersimpan.`); }} />}
      {editor?.mode === "edit" && <LotEditor lot={lot} data={data} today={lot.date} onDismiss={() => setEditor(null)} onSaved={() => { setEditor(null); setFeedback("Perubahan tersimpan."); }} />}
    </>
  );
}
