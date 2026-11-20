"use client";

import { AlertTriangle, ClipboardCheck, Paperclip, Play, Save, Send, ShieldCheck, Undo2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { activeStatuses, fieldcoPayroll, reportObstacle, reviewTask, saveFieldResult, startTask } from "@/lib/demo-actions";
import { updateDemo, useDemo } from "@/lib/demo-store";
import { fieldcoMonthlyHonorIdr, fieldcos, taskTypes, type DemoData, type Plot, type PlotGeometry, type Task, type TaskStatus } from "@/lib/mock-data";
import { formatCurrency, formatDate, formatMonth, formatDateTime, parseGeometry, plotCompleteness, plotFlags, screenPlot } from "@/lib/screening";
import { EmptyState, ErrorNotice, PageHeading, RiskBadge, SimulationTag, SuccessNotice, TaskBadge, taskLabels, timestamp, useParamSelection } from "./ui";

type Role = "pemeriksa" | "koperasi";
type Filter = "all" | "active" | "review" | "revision" | "done";
const filters: { value: Filter; label: string; match: (status: TaskStatus) => boolean }[] = [
  { value: "all", label: "Semua", match: () => true },
  { value: "active", label: "Aktif", match: (status) => activeStatuses.includes(status) },
  { value: "review", label: "Menunggu tinjauan", match: (status) => status === "submitted_review" },
  { value: "revision", label: "Perlu perbaikan", match: (status) => status === "revision_requested" },
  { value: "done", label: "Selesai", match: (status) => status === "verified_completed" },
];
const steps: TaskStatus[] = ["assigned", "in_progress", "submitted_review", "verified_completed"];
const actorLabels = { pabrik: "Pabrik", koperasi: "Koperasi", pemeriksa: "Pemeriksa" };

function editableGeometry({ coordinates: [ring] }: PlotGeometry) {
  return `{"type":"Polygon","coordinates":[[\n${ring.map((point) => `  ${JSON.stringify(point)}`).join(",\n")}\n]]}`;
}

function StatusSteps({ status }: { status: TaskStatus }) {
  const index = status === "revision_requested" ? 2 : steps.indexOf(status);
  return (
    <ol className="status-steps" aria-label={`Tahap tugas: ${taskLabels[status]}`}>
      {steps.map((step, position) => {
        const revision = step === "submitted_review" && status === "revision_requested";
        const state = position < index || status === "verified_completed" ? "done" : position === index ? "current" : "todo";
        return <li key={step} className={`step-${revision ? "revision" : state}`} aria-current={position === index ? "step" : undefined}><span aria-hidden="true" />{revision ? "Perlu perbaikan" : taskLabels[step]}</li>;
      })}
    </ol>
  );
}

function FieldForm({ task, plot, onSaved }: { task: Task; plot: Plot; onSaved: (message: string) => void }) {
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<string[]>(task.result?.evidence ?? []);
  const result = task.result ?? { ...plot, note: "" };
  const mapping = task.taskType !== "dokumen";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const submit = submitter instanceof HTMLButtonElement && submitter.value === "submit";
    const field = (name: string) => String(form.get(name) ?? "").trim();
    try {
      const value = { owner: field("owner"), documentType: field("documentType"), documentRef: field("documentRef"), geometry: parseGeometry(field("geometry")), note: field("note"), evidence };
      updateDemo((current) => saveFieldResult(current, task.id, value, submit, timestamp()));
      setError("");
      onSaved(submit ? "Hasil terkirim ke pemeriksa." : "Draf tersimpan.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Hasil pendataan tidak tersimpan. Coba kembali.");
    }
  }

  return (
    <form className="form-stack" onSubmit={save} noValidate>
      <div className="form-grid">
        <label>Nama pemilik<input name="owner" maxLength={100} defaultValue={result.owner} required /></label>
        <label>Jenis dokumen<input name="documentType" maxLength={80} defaultValue={result.documentType} required /></label>
      </div>
      <label>Nomor dokumen lahan<input className="mono" name="documentRef" maxLength={100} placeholder="Contoh: SKT-003" defaultValue={result.documentRef} required /></label>
      <details className="geometry-details" open={mapping}>
        <summary>{mapping ? "Batas lahan hasil pemetaan (GeoJSON)" : "Ubah batas lahan (opsional)"}</summary>
        <label><span className="sr-only">Poligon lahan (GeoJSON)</span><textarea className="mono" name="geometry" rows={6} maxLength={40000} defaultValue={editableGeometry(result.geometry)} required /><small>Satu cincin luar dengan urutan bujur, lintang. Titik terakhir sama dengan titik awal.</small></label>
      </details>
      <label>Catatan pendataan<textarea name="note" rows={3} maxLength={1500} placeholder="Apa yang dicek dan hasilnya." defaultValue={result.note} required /></label>
      <div className="evidence-field">
        <label className="file-drop compact">
          <Paperclip size={18} aria-hidden="true" />
          <span><strong>Lampirkan bukti</strong><small>Foto dokumen atau lahan</small></span>
          <input type="file" multiple accept="image/*,.pdf" onChange={(event) => { const names = [...(event.target.files ?? [])].map((file) => file.name); setEvidence((previous) => [...new Set([...previous, ...names])].slice(0, 10)); event.target.value = ""; }} />
        </label>
        {evidence.length > 0 && <ul className="chip-list" aria-label="Bukti terlampir">{evidence.map((name) => <li key={name} className="chip"><Paperclip size={13} aria-hidden="true" />{name}<button type="button" className="chip-remove" aria-label={`Hapus ${name}`} onClick={() => setEvidence(evidence.filter((item) => item !== name))}>×</button></li>)}</ul>}
      </div>
      <ErrorNotice message={error} />
      <div className="actions"><button type="submit" value="draft" className="button button-secondary"><Save size={17} /> Simpan draf</button><button type="submit" value="submit" className="button button-primary"><Send size={17} /> Kirim untuk ditinjau</button></div>
    </form>
  );
}

function ObstacleForm({ task, onSaved }: { task: Task; onSaved: (message: string) => void }) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("obstacle") ?? "");
    try {
      updateDemo((current) => reportObstacle(current, task.id, note, timestamp()));
      setOpen(false);
      setError("");
      onSaved("Kendala tercatat.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kendala tidak tersimpan.");
    }
  }
  if (!open) return <button type="button" className="button button-secondary button-small" onClick={() => setOpen(true)}><AlertTriangle size={16} /> Laporkan kendala</button>;
  return (
    <form className="form-stack obstacle-form" onSubmit={save} noValidate>
      <label>Kendala di lapangan<textarea name="obstacle" rows={3} maxLength={1000} placeholder="Contoh: pemilik tidak bisa ditemui." autoFocus /><small>Tidak membatalkan tugas.</small></label>
      <ErrorNotice message={error} />
      <div className="actions"><button type="button" className="button button-secondary button-small" onClick={() => setOpen(false)}>Batal</button><button type="submit" className="button button-primary button-small">Kirim</button></div>
    </form>
  );
}

function ReviewForm({ task, plot, onSaved }: { task: Task; plot: Plot; onSaved: (message: string) => void }) {
  const [error, setError] = useState("");
  const result = task.result;
  if (!result) return null;
  const after = { ...plot, ...result, reviewed: true };
  const screening = screenPlot(after);
  const flags = plotFlags(after);
  const changed = (key: "owner" | "documentType" | "documentRef") => plot[key] !== result[key];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const approved = submitter instanceof HTMLButtonElement && submitter.value === "approve";
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    try {
      updateDemo((current) => reviewTask(current, task.id, approved, note, timestamp()));
      onSaved(approved ? `Hasil diterima. Data ${plot.id} diperbarui.` : "Dikembalikan ke mitra untuk diperbaiki.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Tinjauan tidak tersimpan.");
    }
  }

  return (
    <>
      <div className="table-wrap"><table className="data-table compare-table">
        <thead><tr><th>Data</th><th>Sebelumnya</th><th>Dari mitra</th></tr></thead>
        <tbody>
          <tr><td>Pemilik</td><td>{plot.owner || "—"}</td><td className={changed("owner") ? "changed" : undefined}>{result.owner}</td></tr>
          <tr><td>Jenis dokumen</td><td>{plot.documentType || "—"}</td><td className={changed("documentType") ? "changed" : undefined}>{result.documentType}</td></tr>
          <tr><td>Nomor dokumen</td><td className="mono">{plot.documentRef || "—"}</td><td className={`mono${changed("documentRef") ? " changed" : ""}`}>{result.documentRef}</td></tr>
          <tr><td>Bukti</td><td>—</td><td>{result.evidence?.length ? result.evidence.join(", ") : "Tidak ada"}</td></tr>
        </tbody>
      </table></div>
      <p className="record-note"><strong>Catatan mitra:</strong> {result.note}</p>
      <details className="geometry-details"><summary>Lihat batas lahan</summary><pre className="mono">{editableGeometry(result.geometry)}</pre></details>

      <div className="review-outcome">
        <div><span>Kelengkapan data</span><RiskBadge risk={plotCompleteness(after).complete ? "green" : "yellow"} label={plotCompleteness(after).complete ? "Data lengkap" : "Belum lengkap"} /></div>
        <div><span>Temuan risiko (simulasi)</span><RiskBadge risk={flags.length ? "red" : "green"} label={flags.length ? `${flags.length} temuan tetap ada` : "Tidak ada"} /></div>
        <div><span>Status setelah diterima</span><RiskBadge risk={screening.risk} /></div>
        {flags.length > 0 && <p>Menerima hasil hanya melengkapi data. Temuan risiko tetap ada.</p>}
      </div>

      <form className="form-stack" onSubmit={save} noValidate>
        <label>Catatan pemeriksa<textarea name="note" rows={3} maxLength={1500} placeholder="Wajib diisi jika minta perbaikan." /></label>
        <ErrorNotice message={error} />
        <div className="actions"><button type="submit" value="revision" className="button button-secondary"><Undo2 size={17} /> Minta perbaikan</button><button type="submit" value="approve" className="button button-primary"><ClipboardCheck size={17} /> Terima hasil</button></div>
      </form>
    </>
  );
}

function TaskActions({ role, task, plot, data, onSaved, onSwitchRole }: { role: Role; task: Task; plot: Plot; data: DemoData; onSaved: (message: string) => void; onSwitchRole: (role: Role) => void }) {
  const relatedLots = data.lots.filter((lot) => lot.allocations.some((allocation) => allocation.plotId === plot.id));
  if (task.status === "verified_completed") {
    const screening = screenPlot(plot);
    return (
      <section className="panel panel-pad" aria-labelledby="result-title">
        <div className="panel-heading"><div><h2 id="result-title">Hasil diterima</h2><p>Dokumen <span className="mono">{plot.documentRef}</span></p></div></div>
        <div className="review-outcome">
          <div><span>Kelengkapan data</span><RiskBadge risk={plotCompleteness(plot).complete ? "green" : "yellow"} label={plotCompleteness(plot).complete ? "Data lengkap" : "Belum lengkap"} /></div>
          <div><span>Status lahan</span><RiskBadge risk={screening.risk} /></div>
          {screening.risk === "red" && <p>Data sudah lengkap, tapi temuan risiko tetap perlu diputuskan perusahaan.</p>}
        </div>
        {relatedLots.length > 0 && <div className="related-lots"><h3>Cek lagi lot terkait</h3><div className="actions">{relatedLots.map((lot) => <Link key={lot.id} className="button button-secondary button-small mono" href={`/dashboard/traceability?lot=${lot.id}`}>{lot.id}</Link>)}</div></div>}
      </section>
    );
  }

  if (role === "pemeriksa") {
    if (task.status === "submitted_review") {
      return <section className="panel panel-pad" aria-labelledby="review-title"><div className="panel-heading"><div><h2 id="review-title">Tinjauan pemeriksa</h2><p>Bandingkan, lalu terima atau minta perbaikan.</p></div></div><ReviewForm task={task} plot={plot} onSaved={onSaved} /></section>;
    }
    return (
      <section className="panel panel-pad waiting-panel">
        <h2>Menunggu mitra</h2>
        <p>{task.status === "revision_requested" ? "Mitra sedang memperbaiki hasil." : task.status === "assigned" ? "Mitra belum mulai." : "Mitra sedang mengumpulkan data."}</p>
        <button type="button" className="button button-secondary button-small" onClick={() => onSwitchRole("koperasi")}><UsersRound size={16} /> Lihat sebagai petugas koperasi (simulasi)</button>
      </section>
    );
  }

  if (task.status === "submitted_review") {
    return (
      <section className="panel panel-pad waiting-panel">
        <h2>Hasil sudah dikirim</h2>
        <p>Menunggu tinjauan pemeriksa.</p>
        <button type="button" className="button button-secondary button-small" onClick={() => onSwitchRole("pemeriksa")}><ShieldCheck size={16} /> Lihat sebagai pemeriksa (simulasi)</button>
      </section>
    );
  }

  return (
    <section className="panel panel-pad" aria-labelledby="field-title">
      <div className="panel-heading"><div><h2 id="field-title">Hasil pendataan</h2><p>{task.status === "assigned" ? "Mulai saat tim turun ke lapangan." : "Isi data, lalu kirim untuk ditinjau."}</p></div><ObstacleForm task={task} onSaved={onSaved} /></div>
      {task.status === "assigned" ? (
        <div className="actions start-row"><button type="button" className="button button-primary" onClick={() => { updateDemo((current) => startTask(current, task.id, timestamp())); onSaved("Tugas dimulai."); }}><Play size={17} /> Mulai kerjakan</button></div>
      ) : <FieldForm key={`${task.status}-${task.history.length}`} task={task} plot={plot} onSaved={onSaved} />}
    </section>
  );
}

export function Cooperatives() {
  const params = useSearchParams();
  const { data } = useDemo();
  const filterParam = params.get("filter");
  const [taskId, setTaskId] = useParamSelection(params.get("tugas"));
  const [role, setRole] = useParamSelection<Role>(params.get("peran") === "koperasi" ? "koperasi" : null);
  const [filter, setFilter] = useParamSelection<Filter>(filters.some(({ value }) => value === filterParam) ? filterParam as Filter : null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const activeRole = role ?? "pemeriksa";
  const activeFilter = filters.find(({ value }) => value === (filter ?? "all")) ?? filters[0];

  const urlTask = data.tasks.find((item) => item.id === taskId);
  const partner = activeRole === "koperasi" ? partnerId ?? urlTask?.cooperativeId ?? data.cooperatives[0]?.id : null;
  const scoped = data.tasks.filter((item) => !partner || item.cooperativeId === partner);
  const visibleTasks = scoped.filter(({ status }) => activeFilter.match(status));
  const task = (urlTask && (!partner || urlTask.cooperativeId === partner) ? urlTask : undefined) ?? visibleTasks[0];
  const plot = data.plots.find((item) => item.id === task?.plotId);
  const supplier = data.suppliers.find((item) => item.id === task?.supplierId);
  const cooperative = data.cooperatives.find((item) => item.id === task?.cooperativeId);
  const payrollCoop = data.cooperatives.find((item) => item.id === (partner ?? data.cooperatives[0]?.id));
  const payroll = payrollCoop ? fieldcoPayroll(data, payrollCoop.id) : null;
  const coopName = (id: string) => data.cooperatives.find((item) => item.id === id)?.name ?? id;

  function switchRole(next: Role) {
    setRole(next === "pemeriksa" ? null : next);
    if (next === "koperasi") setPartnerId(task?.cooperativeId ?? null);
    setFeedback("");
  }

  return (
    <>
      <PageHeading title="Portal mitra koperasi" actions={
        <div className="role-switch" role="group" aria-label="Lihat sebagai (simulasi peran)">
          <span>Lihat sebagai <SimulationTag /></span>
          <button type="button" aria-pressed={activeRole === "pemeriksa"} onClick={() => switchRole("pemeriksa")}><ShieldCheck size={15} aria-hidden="true" /> Pemeriksa pabrik</button>
          <button type="button" aria-pressed={activeRole === "koperasi"} onClick={() => switchRole("koperasi")}><UsersRound size={15} aria-hidden="true" /> Petugas koperasi</button>
        </div>
      }>
        Koperasi membantu melengkapi data pemasok, lalu pemeriksa meninjau hasilnya.
      </PageHeading>

      <section className="partner-grid" aria-label="Mitra koperasi">
        {data.cooperatives.map((item) => {
          const tasks = data.tasks.filter((entry) => entry.cooperativeId === item.id);
          const selected = activeRole === "koperasi" && partner === item.id;
          const content = <><span className="icon-box" aria-hidden="true"><UsersRound size={18} /></span><div><h2>{item.name}</h2><p>{item.region}</p><p className="partner-stats"><span><b>{tasks.filter((entry) => activeStatuses.includes(entry.status)).length}</b> aktif</span><span><b>{tasks.filter((entry) => entry.status === "submitted_review").length}</b> ditinjau</span><span><b>{tasks.filter((entry) => entry.status === "verified_completed").length}</b> diterima</span></p></div></>;
          return activeRole === "koperasi"
            ? <button type="button" key={item.id} className="panel partner-card" aria-pressed={selected} onClick={() => { setPartnerId(item.id); setTaskId(null); setFeedback(""); }}>{content}</button>
            : <article key={item.id} className="panel partner-card">{content}</article>;
        })}
      </section>

      {activeRole === "koperasi" && payroll && payrollCoop && (
        <section className="panel panel-pad" aria-labelledby="payroll-title">
          <div className="panel-heading"><div><h2 id="payroll-title">Honor fieldco bulanan</h2><p>{payrollCoop.name} · fieldco {fieldcos[payrollCoop.id]?.name ?? "belum ditunjuk"}. Dibayar MUARA, tetap {formatCurrency(fieldcoMonthlyHonorIdr)} per bulan, tidak bergantung pada jumlah tugas atau status hijau.</p></div><SimulationTag>Simulasi</SimulationTag></div>
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Bulan</th><th className="num">Honor</th><th className="num">Tugas masuk</th><th className="num">Hasil diterima</th><th className="num">Kendala dilaporkan</th><th>Status</th></tr></thead>
            <tbody>{payroll.map((row) => <tr key={row.month}><td>{formatMonth(row.month)}</td><td className="num mono">{formatCurrency(row.honorIdr)}</td><td className="num">{row.assigned}</td><td className="num">{row.accepted}</td><td className="num">{row.obstacles}</td><td>{row.status === "paid" ? "Dibayar" : "Berjalan"}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}

      <div className="master-detail-grid">
        <section className="panel list-panel" aria-labelledby="task-list-title">
          <div className="panel-pad list-tools">
            <div className="panel-heading"><div><h2 id="task-list-title">{activeRole === "koperasi" ? `Tugas ${coopName(partner ?? "")}` : "Semua tugas mitra"}</h2><p>{visibleTasks.length} dari {scoped.length}</p></div></div>
            <div className="filter-group" role="group" aria-label="Filter status tugas">{filters.map(({ value, label }) => <button key={value} type="button" aria-pressed={value === activeFilter.value} onClick={() => { setFilter(value === "all" ? null : value); setTaskId(null); setFeedback(""); }}>{label}</button>)}</div>
          </div>
          <div className="select-list scroll-list">
            {visibleTasks.map((item) => (
              <button type="button" key={item.id} aria-pressed={task?.id === item.id} onClick={() => { setTaskId(item.id); setFeedback(""); }}>
                <span className="select-row"><strong><span className="mono">{item.id}</span> · {item.plotId}</strong><TaskBadge status={item.status} /></span>
                <span className="record-id">{taskTypes[item.taskType].label} · {coopName(item.cooperativeId)} · tenggat {formatDate(item.dueDate)}</span>
              </button>
            ))}
            {!visibleTasks.length && <EmptyState title="Tidak ada tugas">{activeRole === "pemeriksa" ? <Link className="text-link" href="/dashboard/due-diligence?status=perlu">Buat tugas baru</Link> : null}</EmptyState>}
          </div>
        </section>

        {task && plot ? (
          <div className="detail-stack" key={task.id}>
            <section className="panel panel-pad" aria-labelledby="task-title">
              <div className="panel-heading"><div><span className="record-id"><span className="mono">{task.id}</span></span><h2 id="task-title">{taskTypes[task.taskType].label}</h2><p>{supplier?.name} · lahan <Link className="text-link mono" href={`/dashboard/due-diligence?pemasok=${plot.supplierId}&lahan=${plot.id}`}>{plot.id}</Link> · {plot.village}</p></div><TaskBadge status={task.status} /></div>
              <StatusSteps status={task.status} />
              {feedback && <SuccessNotice onDismiss={() => setFeedback("")}>{feedback}</SuccessNotice>}
              {task.reviewNote && task.status !== "submitted_review" && <p className={`inline-notice ${task.status === "revision_requested" ? "notice-error" : "notice-info"}`}><span><strong>Catatan pemeriksa:</strong> {task.reviewNote}</span></p>}
              <dl className="record-grid">
                <div><dt>Mitra</dt><dd>{cooperative?.name}</dd></div>
                <div><dt>Tenggat</dt><dd>{formatDate(task.dueDate)}</dd></div>
                <div><dt>Pemilik tercatat</dt><dd>{plot.owner || "Belum diisi"}</dd></div>
                <div><dt>Status lahan</dt><dd><RiskBadge risk={screenPlot(plot).risk} /></dd></div>
                <div className="record-wide"><dt>Lingkup</dt><dd>{task.scope}</dd></div>
                <div className="record-wide"><dt>Yang perlu dikumpulkan</dt><dd><ul className="check-list">{taskTypes[task.taskType].requirements.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
                {activeRole === "koperasi" && <div className="record-wide"><dt>Honor fieldco <SimulationTag /></dt><dd><span className="mono">{formatCurrency(fieldcoMonthlyHonorIdr)}</span> per bulan<small className="fee-note">Dibayar MUARA kepada fieldco {fieldcos[task.cooperativeId]?.name ?? "mitra"} sebagai honor tetap bulanan, bukan per tugas. Rekap ada di panel Honor fieldco bulanan.</small></dd></div>}
              </dl>
              {task.obstacles.length > 0 && <div className="obstacle-list"><h3><AlertTriangle size={16} aria-hidden="true" /> Kendala dilaporkan</h3><ul>{task.obstacles.map((item) => <li key={item.at}><time dateTime={item.at}>{formatDateTime(item.at)}</time>{item.note}</li>)}</ul></div>}
            </section>

            <TaskActions role={activeRole} task={task} plot={plot} data={data} onSaved={setFeedback} onSwitchRole={switchRole} />

            <section className="panel panel-pad" aria-labelledby="history-title">
              <div className="panel-heading"><div><h2 id="history-title">Riwayat</h2></div></div>
              <ol className="timeline">{[...task.history].reverse().map((item, index) => <li key={`${item.at}-${index}`}><span className={`timeline-dot actor-${item.actor}`} aria-hidden="true" /><div><strong>{item.action}</strong><small>{actorLabels[item.actor]} · <time dateTime={item.at}>{formatDateTime(item.at)}</time></small>{item.note && <p>{item.note}</p>}</div></li>)}</ol>
            </section>
          </div>
        ) : <section className="panel panel-pad"><EmptyState title="Pilih tugas di daftar" /></section>}
      </div>
    </>
  );
}
