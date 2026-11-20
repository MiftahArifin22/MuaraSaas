"use client";

import { ArrowRight, ClipboardCheck, Download, Fingerprint, History, MapPinned, Printer, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { activeStatuses, activeTaskForPlot } from "@/lib/demo-actions";
import { useDemo } from "@/lib/demo-store";
import type { Risk } from "@/lib/mock-data";
import { formatDate, formatDateTime, formatNumber, screenPlot, screenSupplier, validateLot } from "@/lib/screening";
import { downloadJson, EmptyState, PageHeading, RiskBadge, SimulationTag, TaskBadge } from "./ui";

type ActionItem = { key: string; risk: Risk; title: string; detail: string; href: string; cta: string };

export function Overview() {
  const { data } = useDemo();
  const suppliers = data.suppliers.map((supplier) => ({ ...supplier, risk: screenSupplier(data.plots.filter((plot) => plot.supplierId === supplier.id)) }));
  const lots = data.lots.map((lot) => ({ ...lot, validation: validateLot(lot, data) }));
  const supplierName = (id: string) => data.suppliers.find((item) => item.id === id)?.name ?? id;
  const coopName = (id: string) => data.cooperatives.find((item) => item.id === id)?.name ?? id;

  const flaggedSuppliers = suppliers.filter((supplier) => supplier.risk !== "green");
  const redSuppliers = flaggedSuppliers.filter((supplier) => supplier.risk === "red").length;
  const incompleteLots = lots.filter((lot) => lot.validation.risk !== "green");
  const incompleteTons = incompleteLots.reduce((sum, lot) => sum + lot.weight, 0);
  const waitingReview = data.tasks.filter((task) => task.status === "submitted_review");
  const activeTasks = data.tasks.filter((task) => activeStatuses.includes(task.status));
  const passedLots = lots.filter((lot) => lot.validation.risk === "green");

  const summary = [
    { label: "Pemasok perlu ditinjau", value: flaggedSuppliers.length, unit: `dari ${suppliers.length} pemasok`, detail: `${redSuppliers} perlu investigasi, ${flaggedSuppliers.length - redSuppliers} perlu dilengkapi`, icon: MapPinned, href: "/dashboard/due-diligence?status=perlu", tone: flaggedSuppliers.length ? "attention" : "ok" },
    { label: "Lot belum lolos", value: incompleteLots.length, unit: `dari ${lots.length} lot`, detail: `${formatNumber(incompleteTons)} ton`, icon: Fingerprint, href: "/dashboard/traceability?status=perlu", tone: incompleteLots.length ? "attention" : "ok" },
    { label: "Hasil mitra perlu ditinjau", value: waitingReview.length, unit: "tugas", detail: `${activeTasks.length} tugas masih berjalan`, icon: ClipboardCheck, href: "/dashboard/cooperatives?filter=review", tone: waitingReview.length ? "attention" : "ok" },
  ] as const;

  const actions: ActionItem[] = [
    ...waitingReview.map((task) => ({ key: task.id, risk: "yellow" as Risk, title: `Tinjau hasil ${task.id} · ${task.plotId}`, detail: `Dikirim ${coopName(task.cooperativeId)}.`, href: `/dashboard/cooperatives?tugas=${task.id}`, cta: "Tinjau hasil" })),
    ...lots.filter((lot) => lot.validation.risk === "red").map((lot) => ({ key: lot.id, risk: "red" as Risk, title: `${lot.id} perlu dicek`, detail: lot.validation.issues.find((issue) => issue.risk === "red")?.message ?? "", href: `/dashboard/traceability?lot=${lot.id}`, cta: "Buka lot" })),
    ...data.plots.filter((plot) => screenPlot(plot).risk !== "green" && !activeTaskForPlot(data, plot.id)).map((plot) => ({ key: plot.id, risk: screenPlot(plot).risk, title: `${plot.id} belum ditangani`, detail: screenPlot(plot).reasons[0], href: `/dashboard/due-diligence?pemasok=${plot.supplierId}&lahan=${plot.id}`, cta: "Tugaskan ke mitra" })),
    ...data.tasks.filter((task) => task.status === "revision_requested").map((task) => ({ key: task.id, risk: "yellow" as Risk, title: `${task.id} menunggu perbaikan mitra`, detail: task.reviewNote ?? "", href: `/dashboard/cooperatives?tugas=${task.id}`, cta: "Lihat tugas" })),
  ].slice(0, 6);

  return (
    <>
      <PageHeading title="Ringkasan" actions={<>
        <button type="button" className="button button-secondary" onClick={() => window.print()}><Printer size={17} /> Cetak</button>
        <button type="button" className="button button-secondary" onClick={() => downloadJson("muara-ringkasan", { simulasi: true, pabrik: data.mill, pemasok: suppliers, lot: lots.map(({ validation, ...lot }) => ({ ...lot, status: validation.risk, temuan: validation.issues })), tugas: data.tasks })}><Download size={17} /> Unduh JSON</button>
      </>}>
        Pekerjaan yang perlu ditindaklanjuti di <strong>{data.mill.name}</strong>.
      </PageHeading>

      <section className="summary-grid" aria-label="Ringkasan yang perlu ditindaklanjuti">
        {summary.map(({ label, value, unit, detail, icon: Icon, href, tone }) => (
          <Link href={href} className={`summary-card panel summary-${tone}`} key={label}>
            <span className="summary-top"><span className="icon-box"><Icon size={18} aria-hidden="true" /></span><span className="summary-label">{label}</span></span>
            <span className="summary-value"><strong>{value}</strong><span>{unit}</span></span>
            <small>{detail}</small>
            <span className="summary-link">Lihat <ArrowRight size={15} aria-hidden="true" /></span>
          </Link>
        ))}
      </section>

      <div className="overview-columns">
        <section className="panel panel-pad" aria-labelledby="todo-title">
          <div className="panel-heading"><div><h2 id="todo-title">Perlu ditindaklanjuti</h2></div></div>
          {actions.length ? (
            <ul className="action-list">
              {actions.map((item) => (
                <li key={`${item.key}-${item.cta}`} className={`action-${item.risk}`}>
                  <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  <Link className="button button-secondary button-small" href={item.href}>{item.cta}</Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Semua sudah ditangani" />}
        </section>

        <section className="panel panel-pad" aria-labelledby="activity-title">
          <div className="panel-heading"><div><h2 id="activity-title">Aktivitas terbaru</h2></div><span className="icon-box" aria-hidden="true"><History size={18} /></span></div>
          {data.activity.length ? (
            <ol className="activity-list">
              {data.activity.slice(0, 6).map((item) => (
                <li key={item.id}><Link href={item.href}>{item.text}</Link><time dateTime={item.at}>{formatDateTime(item.at)}</time></li>
              ))}
            </ol>
          ) : <EmptyState title="Belum ada aktivitas" />}
        </section>
      </div>

      <section className="panel panel-pad" aria-labelledby="lots-title">
        <div className="panel-heading"><div><h2 id="lots-title">Status pasokan</h2><p>{passedLots.length} dari {lots.length} lot lolos pemeriksaan awal.</p></div><Link href="/dashboard/traceability" className="text-link">Lihat semua</Link></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Nomor lot</th><th>Pemasok</th><th>Tanggal terima</th><th className="num">Berat</th><th>Status</th><th>Temuan</th></tr></thead>
          <tbody>
            {[...lots].reverse().map((lot) => (
              <tr key={lot.id}>
                <td><Link className="text-link mono" href={`/dashboard/traceability?lot=${lot.id}`}>{lot.id}</Link></td>
                <td>{supplierName(lot.supplierId)}</td>
                <td>{formatDate(lot.date)}</td>
                <td className="mono num">{formatNumber(lot.weight)} ton</td>
                <td><RiskBadge risk={lot.validation.risk} /></td>
                <td>{lot.validation.issues.length ? `${lot.validation.issues.length} temuan` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      <div className="overview-columns">
        <section className="panel panel-pad" aria-labelledby="partner-title">
          <div className="panel-heading"><div><h2 id="partner-title">Tugas mitra berjalan</h2></div><span className="icon-box" aria-hidden="true"><UsersRound size={18} /></span></div>
          {activeTasks.length ? <ul className="task-mini-list">{activeTasks.slice(0, 4).map((task) => (
            <li key={task.id}><Link href={`/dashboard/cooperatives?tugas=${task.id}`}><strong><span className="mono">{task.id}</span> · {task.plotId}</strong><small>{coopName(task.cooperativeId)} · tenggat {formatDate(task.dueDate)}</small></Link><TaskBadge status={task.status} /></li>
          ))}</ul> : <EmptyState title="Tidak ada tugas aktif" />}
        </section>

        <section className="panel panel-pad finance-panel" aria-labelledby="finance-title">
          <div className="panel-heading"><div><span className="eyebrow"><Wallet size={15} aria-hidden="true" /> Konsep</span><h2 id="finance-title">Data untuk pembiayaan</h2></div><SimulationTag>Simulasi</SimulationTag></div>
          <p><strong>{passedLots.length} lot · {formatNumber(passedLots.reduce((sum, lot) => sum + lot.weight, 0))} ton</strong> lolos pemeriksaan dan bisa jadi data pendukung bagi bank seperti BNI atau hibank.</p>
          <p className="fine-print">Masih konsep. Belum ada kerja sama atau integrasi.</p>
        </section>
      </div>
    </>
  );
}
