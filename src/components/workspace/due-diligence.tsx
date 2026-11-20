"use client";

import { Building2, FileUp, FlaskConical, Layers3, MapPinned, Search, UserPlus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { activeTaskForPlot, assignTask } from "@/lib/demo-actions";
import { updateDemo, useDemo } from "@/lib/demo-store";
import { demoLayers, taskTypes, type DemoData, type Plot, type Risk, type Supplier, type TaskType } from "@/lib/mock-data";
import { formatDate, formatNumber, plotCompleteness, plotFlags, riskLabels, screenPlot, screenSupplier, validateLot } from "@/lib/screening";
import { ImportDialog } from "./import-dialog";
import { Dialog, Drawer, EmptyState, ErrorNotice, PageHeading, RiskBadge, SuccessNotice, TaskBadge, timestamp, useParamSelection } from "./ui";

const PlotMap = dynamic(() => import("./plot-map"), { ssr: false, loading: () => <div className="plot-map loading-map" role="status"><span className="spinner" aria-hidden="true" />Memuat peta…</div> });
const plotRisks: Risk[] = ["green", "yellow", "red"];
const noPlots: Plot[] = [];
type Filter = "all" | "perlu" | Risk;
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" }, { value: "perlu", label: "Perlu ditinjau" },
  { value: "red", label: "Perlu investigasi" }, { value: "yellow", label: "Perlu dilengkapi" }, { value: "green", label: "Lolos" },
];
const filterValues = new Set<string>(filters.map(({ value }) => value));

function suggestedTaskType(plot: Plot): TaskType {
  if (plotFlags(plot).length) return "klarifikasi";
  return "dokumen";
}

function nextStep(plot: Plot, data: DemoData) {
  const task = activeTaskForPlot(data, plot.id);
  const flags = plotFlags(plot);
  const completeness = plotCompleteness(plot);
  if (task) return { text: `Sedang dikerjakan mitra (${task.id}).`, task };
  if (flags.length) return { text: "Minta mitra mengecek ke lapangan. Melengkapi data tidak menghapus temuan ini." };
  if (!completeness.complete) return { text: "Minta mitra melengkapi dokumen lahan." };
  return { text: "Tidak perlu tindakan." };
}

function Assignment({ data, supplier, plots, initialPlotId, onDismiss, onAssigned }: { data: DemoData; supplier: Supplier; plots: Plot[]; initialPlotId?: string; onDismiss: () => void; onAssigned: (id: string) => void }) {
  const [error, setError] = useState("");
  const [plotId, setPlotId] = useState(initialPlotId ?? plots[0]?.id ?? "");
  const plot = plots.find((item) => item.id === plotId);
  const [taskType, setTaskType] = useState<TaskType>(plot ? suggestedTaskType(plot) : "dokumen");
  const [saving, setSaving] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      let id = "";
      updateDemo((current) => {
        const next = assignTask(current, {
          supplierId: supplier.id, plotId, taskType,
          cooperativeId: String(form.get("cooperative") ?? ""),
          scope: String(form.get("scope") ?? ""),
          dueDate: String(form.get("dueDate") ?? ""),
        }, timestamp());
        id = next.id;
        return next.data;
      });
      onAssigned(id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Tugas tidak tersimpan. Coba kembali.");
      setSaving(false);
    }
  }

  return (
    <Dialog title="Tugaskan ke mitra" onDismiss={onDismiss} description={<>Koperasi akan membantu melengkapi data <strong>{supplier.name}</strong>.</>}>
      {plots.length ? (
        <form className="form-stack" onSubmit={handleSubmit} noValidate>
          <label>Lahan<select name="plot" value={plotId} onChange={(event) => { setPlotId(event.target.value); const next = plots.find((item) => item.id === event.target.value); if (next) setTaskType(suggestedTaskType(next)); }} required>
            {plots.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.owner} · {riskLabels[screenPlot(item).risk]}</option>)}
          </select></label>
          <div className="form-grid">
            <label>Mitra koperasi<select name="cooperative" defaultValue={supplier.cooperativeId} required>{data.cooperatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Tenggat<input name="dueDate" type="date" required /></label>
          </div>
          <label>Jenis pekerjaan<select name="taskType" value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)}>{Object.entries(taskTypes).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
          <div className="task-brief">
            <strong>Yang perlu dikumpulkan</strong>
            <ul>{taskTypes[taskType].requirements.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <label>Catatan <small>Opsional</small><textarea name="scope" rows={3} maxLength={500} defaultValue={plot ? screenPlot(plot).reasons.join(" ") : ""} /></label>
          <ErrorNotice message={error} />
          <div className="actions dialog-actions"><button type="button" className="button button-secondary" onClick={onDismiss}>Batal</button><button type="submit" className="button button-primary" disabled={saving}><UserPlus size={17} />{saving ? "Menyimpan…" : "Simpan tugas"}</button></div>
        </form>
      ) : <EmptyState title="Tidak ada lahan yang bisa ditugaskan">Semua lahan sudah lolos atau sedang dikerjakan.</EmptyState>}
    </Dialog>
  );
}

function PlotDrawer({ plot, data, onDismiss, onAssign }: { plot: Plot; data: DemoData; onDismiss: () => void; onAssign: () => void }) {
  const supplier = data.suppliers.find((item) => item.id === plot.supplierId);
  const screening = screenPlot(plot);
  const flags = plotFlags(plot);
  const completeness = plotCompleteness(plot);
  const step = nextStep(plot, data);
  const history = data.tasks.filter((task) => task.plotId === plot.id);
  const lots = data.lots.filter((lot) => lot.allocations.some((allocation) => allocation.plotId === plot.id));
  const canAssign = screening.risk !== "green" && !step.task;

  return (
    <Drawer title={`${plot.owner}`} eyebrow={`${plot.id} · ${supplier?.name ?? plot.supplierId}`} onDismiss={onDismiss} footer={
      canAssign ? <button type="button" className="button button-primary" onClick={onAssign}><UserPlus size={17} /> Tugaskan ke mitra</button>
        : step.task ? <Link className="button button-primary" href={`/dashboard/cooperatives?tugas=${step.task.id}`}>Buka tugas {step.task.id}</Link>
          : <button type="button" className="button button-secondary" onClick={onDismiss}>Tutup</button>
    }>
      <div className="drawer-status"><RiskBadge risk={screening.risk} /></div>

      <section className="drawer-section" aria-label="Tindakan berikutnya">
        <h3>Tindakan berikutnya</h3>
        <p>{step.text}</p>
      </section>

      <section className="drawer-section">
        <h3>Data lahan</h3>
        <dl className="record-grid compact">
          <div><dt>Pemilik</dt><dd>{plot.owner || "Belum diisi"}</dd></div>
          <div><dt>Desa</dt><dd>{plot.village}</dd></div>
          <div><dt>Pemasok</dt><dd>{supplier?.name} <span className="mono muted">{plot.supplierId}</span></dd></div>
          <div><dt>Luas</dt><dd className="mono">{formatNumber(plot.areaHa)} ha</dd></div>
          <div><dt>Kapasitas</dt><dd className="mono">{formatNumber(plot.annualCapacity)} ton/tahun</dd></div>
          <div><dt>Dasar kapasitas</dt><dd>{plot.capacityBasis}{plot.capacityDate && <small> · dicatat {formatDate(plot.capacityDate)}</small>}</dd></div>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>Dokumen</h3>
        <dl className="record-grid compact">
          <div><dt>Jenis dokumen</dt><dd>{plot.documentType || "Belum diisi"}</dd></div>
          <div><dt>Nomor dokumen</dt><dd className="mono">{plot.documentRef || "Belum diisi"}</dd></div>
          <div><dt>Status peninjauan</dt><dd>{plot.reviewed ? "Sudah ditinjau" : "Belum ditinjau"}</dd></div>
          <div><dt>Kelengkapan</dt><dd><RiskBadge risk={completeness.complete ? "green" : "yellow"} label={completeness.complete ? "Data lengkap" : "Belum lengkap"} /></dd></div>
        </dl>
        {completeness.missing.length > 0 && <p className="field-hint">Kurang: {completeness.missing.join(", ").toLowerCase()}.</p>}
      </section>

      <section className="drawer-section">
        <h3>Temuan risiko <span className="simulation-tag">Simulasi</span></h3>
        {flags.length ? <ul className="validation-list">{flags.map((flag) => <li key={flag.id} className="validation-red"><span aria-hidden="true" />Masuk area {flag.name.toLowerCase()}. Perlu dicek.</li>)}</ul>
          : <p className="field-hint">Tidak ada temuan.</p>}
      </section>

      <section className="drawer-section">
        <h3>Tugas mitra</h3>
        {history.length ? <ul className="task-mini-list">{history.map((task) => <li key={task.id}><Link href={`/dashboard/cooperatives?tugas=${task.id}`}><strong className="mono">{task.id}</strong><small>{taskTypes[task.taskType].label} · tenggat {formatDate(task.dueDate)}</small></Link><TaskBadge status={task.status} /></li>)}</ul> : <p className="field-hint">Belum pernah ditugaskan.</p>}
      </section>

      <section className="drawer-section">
        <h3>Dipakai pada pasokan</h3>
        {lots.length ? <div className="chip-list">{lots.map((lot) => <Link key={lot.id} className="chip mono" href={`/dashboard/traceability?lot=${lot.id}`}>{(() => { const risk = validateLot(lot, data).risk; return <><i className={`dot segment-${risk}`} aria-hidden="true" />{lot.id} · {formatNumber(lot.allocations.filter((item) => item.plotId === plot.id).reduce((sum, item) => sum + item.tons, 0))} ton<span className="sr-only">, {riskLabels[risk]}</span></>; })()}</Link>)}</div> : <p className="field-hint">Belum dipakai.</p>}
      </section>
    </Drawer>
  );
}

export function DueDiligence() {
  const { data } = useDemo();
  const params = useSearchParams();
  const statusParam = params.get("status");
  const supplierParam = params.get("pemasok");
  const [filter, setFilter] = useParamSelection<Filter>(statusParam && filterValues.has(statusParam) ? statusParam as Filter : null);
  const [selectedSupplierId, setSupplierId] = useParamSelection(supplierParam);
  const [drawerPlotId, setDrawerPlotId] = useParamSelection(params.get("lahan"));
  const [showAll, setShowAll] = useParamSelection<"0" | "1">(supplierParam ? "0" : "1");
  const [viewRevision, setViewRevision] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState<string[]>(demoLayers.map(({ id }) => id));
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<{ plotId?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; taskId?: string } | null>(null);
  const activeFilter = filter ?? "all";

  const suppliers = useMemo(() => data.suppliers.map((item) => {
    const sourcePlots = data.plots.filter((plot) => plot.supplierId === item.id);
    return { ...item, sourcePlots, risk: screenSupplier(sourcePlots), activeTasks: data.tasks.filter((task) => task.supplierId === item.id && task.status !== "verified_completed").length };
  }), [data]);
  const searchTerm = search.trim().toLocaleLowerCase("id-ID");
  const filtered = suppliers.filter((item) => (
    activeFilter === "all" || (activeFilter === "perlu" ? item.risk !== "green" : activeFilter === item.risk))
    && `${item.name} ${item.id} ${item.location} ${item.sourcePlots.map((plot) => `${plot.id} ${plot.owner}`).join(" ")}`.toLocaleLowerCase("id-ID").includes(searchTerm));

  const supplier = suppliers.find((item) => item.id === selectedSupplierId) ?? filtered[0] ?? suppliers[0];
  const plots = supplier.sourcePlots;
  // Referensi array stabil agar peta hanya menyesuaikan tampilan ketika pilihan berubah.
  const focus = showAll === "1" ? noPlots : plots;
  const drawerPlot = data.plots.find((plot) => plot.id === drawerPlotId);
  const assignable = plots.filter((plot) => screenPlot(plot).risk !== "green" && !activeTaskForPlot(data, plot.id));
  const needsAction = plots.filter((plot) => screenPlot(plot).risk !== "green");
  const assignPlot = assigning?.plotId ? data.plots.find((plot) => plot.id === assigning.plotId) : undefined;
  const assignSupplier = suppliers.find((item) => item.id === assignPlot?.supplierId) ?? supplier;
  const assignOptions = assignSupplier.sourcePlots.filter((plot) => screenPlot(plot).risk !== "green" && !activeTaskForPlot(data, plot.id));

  function selectSupplier(id: string) {
    setSupplierId(id);
    setShowAll("0");
    setViewRevision((revision) => revision + 1);
    setFeedback(null);
  }

  function openPlot(plot: Plot) {
    if (plot.supplierId !== supplier.id) selectSupplier(plot.supplierId);
    setDrawerPlotId(plot.id);
  }

  return (
    <>
      <PageHeading title="Pemeriksaan pemasok" actions={<button type="button" className="button button-primary" onClick={() => setImporting(true)}><FileUp size={17} /> Impor data lahan</button>}>
        Cek dokumen dan lahan setiap pemasok.
      </PageHeading>
      <p className="inline-notice notice-info"><FlaskConical size={18} aria-hidden="true" /><span><strong>Simulasi.</strong> Peta dan datanya contoh, bukan hasil analisis resmi.</span></p>
      {feedback && <SuccessNotice onDismiss={() => setFeedback(null)}>{feedback.text} {feedback.taskId && <Link className="text-link" href={`/dashboard/cooperatives?tugas=${feedback.taskId}`}>Lihat tugas</Link>}</SuccessNotice>}

      <div className="inspection-grid">
        <section className="panel list-panel" aria-labelledby="supplier-list-title">
          <div className="panel-pad list-tools">
            <div className="panel-heading"><div><h2 id="supplier-list-title">Pemasok</h2><p>{filtered.length} dari {suppliers.length}</p></div><span className="icon-box" aria-hidden="true"><Building2 size={18} /></span></div>
            <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Cari pemasok atau lahan</span><input type="search" placeholder="Cari pemasok atau pemilik" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="filter-group" role="group" aria-label="Filter status pemasok">{filters.map(({ value, label }) => <button type="button" key={value} aria-pressed={activeFilter === value} onClick={() => setFilter(value === "all" ? null : value)}>{label}</button>)}</div>
          </div>
          <div className="select-list scroll-list">
            {filtered.map((item) => (
              <button type="button" key={item.id} onClick={() => selectSupplier(item.id)} aria-pressed={supplier.id === item.id}>
                <span className="select-row"><strong>{item.name}</strong><RiskBadge risk={item.risk} /></span>
                <span className="record-id"><span className="mono">{item.id}</span> · {item.sourcePlots.length} lahan{item.activeTasks ? ` · ${item.activeTasks} tugas mitra aktif` : ""}</span>
              </button>
            ))}
            {!filtered.length && <EmptyState title="Tidak ditemukan" action={<button type="button" className="button button-secondary button-small" onClick={() => { setSearch(""); setFilter(null); }}>Hapus filter</button>} />}
          </div>
        </section>

        <section className="panel map-panel" aria-labelledby="map-title">
          <div className="panel-heading panel-pad map-heading">
            <div><h2 id="map-title">Peta lahan sumber</h2><p>{showAll === "1" ? `${data.plots.length} lahan` : "Klik lahan untuk melihat detail"}</p></div>
            <button type="button" className="button button-secondary button-small" aria-pressed={showAll === "1"} onClick={() => { setShowAll("1"); setViewRevision((revision) => revision + 1); }}><MapPinned size={16} /> Semua lahan</button>
          </div>
          <PlotMap plots={data.plots} focus={focus} highlightIds={showAll === "1" ? [] : plots.map((plot) => plot.id)} viewRevision={viewRevision} selectedPlotId={drawerPlotId} visibleLayers={visibleLayers} onPlotSelect={openPlot} />
          <div className="map-controls">
            <div className="map-legend" aria-label="Legenda status lahan">{plotRisks.map((risk) => <span key={risk}><i className={`segment-${risk}`} />{riskLabels[risk]}</span>)}</div>
            <fieldset className="layer-controls"><legend><Layers3 size={15} aria-hidden="true" /> Layer (simulasi)</legend><div>{demoLayers.map((layer) => <label key={layer.id}><input type="checkbox" checked={visibleLayers.includes(layer.id)} onChange={(event) => setVisibleLayers((previous) => event.target.checked ? [...previous, layer.id] : previous.filter((id) => id !== layer.id))} /><span className="layer-swatch" style={{ color: layer.color }} />{layer.name}</label>)}</div></fieldset>
          </div>
        </section>
      </div>

      <section className="panel panel-pad" aria-labelledby="supplier-title">
        <div className="panel-heading">
          <div><span className="record-id"><span className="mono">{supplier.id}</span> · {supplier.type} · {supplier.location}</span><h2 id="supplier-title">{supplier.name}</h2><p>{plots.length} lahan · {formatNumber(plots.reduce((sum, plot) => sum + plot.areaHa, 0))} ha · {needsAction.length ? `${needsAction.length} perlu dicek` : "semua lolos"}</p></div>
          <div className="actions"><RiskBadge risk={supplier.risk} />{assignable.length > 0 && <button type="button" className="button button-secondary" onClick={() => setAssigning({})}><UserPlus size={17} /> Tugaskan ke mitra</button>}</div>
        </div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Lahan</th><th>Dokumen</th><th className="num">Kapasitas</th><th>Data</th><th>Temuan</th><th>Tindakan</th></tr></thead>
          <tbody>
            {plots.map((plot) => {
              const completeness = plotCompleteness(plot);
              const flags = plotFlags(plot);
              const task = activeTaskForPlot(data, plot.id);
              return (
                <tr key={plot.id} className={plot.id === drawerPlotId ? "selected-row" : undefined}>
                  <td><button type="button" className="text-link mono" onClick={() => openPlot(plot)}>{plot.id}</button><small>{plot.owner} · {plot.village}</small></td>
                  <td>{plot.documentType || "—"}<small className="mono">{plot.documentRef || "Nomor belum diisi"}</small></td>
                  <td className="mono num">{formatNumber(plot.annualCapacity)} ton/th</td>
                  <td><RiskBadge risk={completeness.complete ? "green" : "yellow"} label={completeness.complete ? "Lengkap" : "Belum lengkap"} />{!plot.reviewed && <small>Belum ditinjau</small>}</td>
                  <td>{flags.length ? <><RiskBadge risk="red" label={`${flags.length} temuan`} />{flags.map((flag) => <small key={flag.id}>{flag.name}</small>)}</> : <span className="muted">Tidak ada</span>}</td>
                  <td>{task ? <Link className="text-link mono" href={`/dashboard/cooperatives?tugas=${task.id}`}>{task.id}</Link> : screenPlot(plot).risk !== "green" ? <button type="button" className="button button-secondary button-small" onClick={() => setAssigning({ plotId: plot.id })}>Tugaskan</button> : <span className="muted">—</span>}{task && <small><TaskBadge status={task.status} /></small>}</td>
                </tr>
              );
            })}
            {!plots.length && <tr><td colSpan={6}><EmptyState title="Belum ada lahan" /></td></tr>}
          </tbody>
        </table></div>
      </section>

      {drawerPlot && !assigning && <PlotDrawer plot={drawerPlot} data={data} onDismiss={() => setDrawerPlotId(null)} onAssign={() => setAssigning({ plotId: drawerPlot.id })} />}
      {assigning && <Assignment data={data} supplier={assignSupplier} plots={assignOptions} initialPlotId={assigning.plotId} onDismiss={() => setAssigning(null)} onAssigned={(id) => { setAssigning(null); setDrawerPlotId(null); setFeedback({ text: `Tugas ${id} tersimpan.`, taskId: id }); }} />}
      {importing && <ImportDialog data={data} onDismiss={() => setImporting(false)} onImported={(count, supplierId) => { setImporting(false); if (supplierId) selectSupplier(supplierId); setFeedback({ text: `${count} lahan berhasil diimpor.` }); }} />}
    </>
  );
}
