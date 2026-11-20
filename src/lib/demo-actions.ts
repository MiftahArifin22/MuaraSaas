import { fieldcoMonthlyHonorIdr, taskTypes, type Actor, type Allocation, type DemoData, type FieldResult, type Lot, type Plot, type Supplier, type Task, type TaskStatus, type TaskType } from "./mock-data";
import { formatNumber, jakartaDate, positiveTonsValue, screenPlot } from "./screening";

/**
 * Seluruh mutasi data demo berupa fungsi murni. Waktu (`now`, ISO 8601) diberikan
 * oleh pemanggil saat aksi penyimpanan, sehingga render tidak pernah membaca jam.
 */

const activityLimit = 40;

function nextId(prefix: string, ids: string[], width = 3) {
  const sequence = Math.max(0, ...ids.map((id) => Number(id.slice(prefix.length)) || 0)) + 1;
  return `${prefix}${String(sequence).padStart(width, "0")}`;
}

export function withActivity(data: DemoData, text: string, href: string, now: string): DemoData {
  const id = nextId("ACT-", data.activity.map((item) => item.id));
  return { ...data, activity: [{ id, at: now, text, href }, ...data.activity].slice(0, activityLimit) };
}

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const activeStatuses: TaskStatus[] = ["assigned", "in_progress", "submitted_review", "revision_requested"];

export function activeTaskForPlot(data: DemoData, plotId: string) {
  return data.tasks.find((task) => task.plotId === plotId && activeStatuses.includes(task.status));
}

export type AssignInput = Pick<Task, "supplierId" | "cooperativeId" | "plotId" | "taskType" | "scope" | "dueDate">;

export function assignTask(data: DemoData, input: AssignInput, now: string) {
  const { supplierId, cooperativeId, plotId, taskType, dueDate } = input;
  const scope = input.scope.trim();
  const plot = data.plots.find((item) => item.id === plotId && item.supplierId === supplierId);
  if (!plot) throw new Error("Pilih lahan milik pemasok ini.");
  if (screenPlot(plot).risk === "green") throw new Error(`${plot.id} sudah lolos pemeriksaan awal. Penugasan hanya untuk lahan yang perlu dilengkapi atau diinvestigasi.`);
  const active = activeTaskForPlot(data, plotId);
  if (active) throw new Error(`${plot.id} sudah memiliki tugas aktif ${active.id}. Selesaikan atau tinjau tugas tersebut terlebih dahulu.`);
  const cooperative = data.cooperatives.find((item) => item.id === cooperativeId);
  if (!cooperative) throw new Error("Pilih koperasi mitra.");
  if (!(taskType in taskTypes)) throw new Error("Pilih jenis pekerjaan.");
  if (!validDate(dueDate)) throw new Error("Isi tenggat dengan tanggal yang valid.");
  if (dueDate < jakartaDate(now)) throw new Error("Tenggat tidak boleh sebelum hari ini.");
  if (scope.length > 500) throw new Error("Lingkup pekerjaan maksimal 500 karakter.");

  const id = nextId("TGS-", data.tasks.map((task) => task.id));
  const task: Task = {
    id, supplierId, cooperativeId, plotId, taskType, dueDate, createdAt: now,
    scope: scope || taskTypes[taskType].label,
    feeIdr: taskTypes[taskType].fee,
    status: "assigned", obstacles: [],
    history: [{ at: now, actor: "pabrik", action: "Tugas dibuat", note: `${taskTypes[taskType].label} · ${cooperative.name}` }],
  };
  const next = withActivity({ ...data, tasks: [task, ...data.tasks] }, `${id} ditugaskan ke ${cooperative.name} untuk ${plot.id}`, `/dashboard/cooperatives?tugas=${id}`, now);
  return { data: next, id };
}

function updateTask(data: DemoData, taskId: string, allowed: TaskStatus[], message: string, change: (task: Task) => Task) {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task || !allowed.includes(task.status)) throw new Error(message);
  return { task, data: { ...data, tasks: data.tasks.map((item) => item.id === taskId ? change(item) : item) } };
}

function event(actor: Actor, action: string, now: string, note?: string) {
  return note ? { at: now, actor, action, note } : { at: now, actor, action };
}

export function startTask(data: DemoData, taskId: string, now: string): DemoData {
  return updateTask(data, taskId, ["assigned"], "Tugas ini sudah mulai dikerjakan atau sudah diproses.", (task) => ({
    ...task, status: "in_progress", history: [...task.history, event("koperasi", "Mulai dikerjakan", now)],
  })).data;
}

export function saveFieldResult(data: DemoData, taskId: string, result: FieldResult, submit: boolean, now: string): DemoData {
  const fields = { ...result, owner: result.owner.trim(), documentType: result.documentType.trim(), documentRef: result.documentRef.trim(), note: result.note.trim(), evidence: (result.evidence ?? []).map((name) => name.trim()).filter(Boolean).slice(0, 10) };
  if (submit) {
    const missing = [!fields.owner && "nama pemilik", !fields.documentType && "jenis dokumen", !fields.documentRef && "nomor dokumen", !fields.note && "catatan pendataan"].filter(Boolean);
    if (missing.length) throw new Error(`Lengkapi ${missing.join(", ")} sebelum mengirim hasil.`);
  }
  const { task, data: next } = updateTask(data, taskId, ["assigned", "in_progress", "revision_requested"], "Tugas ini sudah dikirim, diterima, atau direset. Muat ulang daftar tugas.", (item) => ({
    ...item,
    result: fields,
    status: submit ? "submitted_review" : "in_progress",
    history: [...item.history, event("koperasi", submit ? "Hasil dikirim untuk ditinjau" : "Draf disimpan", now)],
  }));
  const cooperative = data.cooperatives.find((item) => item.id === task.cooperativeId);
  return submit ? withActivity(next, `${cooperative?.name ?? "Koperasi"} mengirim hasil ${task.id} untuk ditinjau`, `/dashboard/cooperatives?tugas=${task.id}`, now) : next;
}

export function reportObstacle(data: DemoData, taskId: string, note: string, now: string): DemoData {
  const text = note.trim();
  if (!text) throw new Error("Tuliskan kendala yang dihadapi di lapangan.");
  if (text.length > 1000) throw new Error("Catatan kendala maksimal 1.000 karakter.");
  const { task, data: next } = updateTask(data, taskId, ["assigned", "in_progress", "revision_requested"], "Kendala hanya dapat dilaporkan pada tugas yang sedang dikerjakan.", (item) => ({
    ...item,
    obstacles: [...item.obstacles, { at: now, note: text }],
    history: [...item.history, event("koperasi", "Kendala dilaporkan", now, text)],
  }));
  return withActivity(next, `Kendala dilaporkan pada ${task.id} (${task.plotId})`, `/dashboard/cooperatives?tugas=${task.id}`, now);
}

export function reviewTask(data: DemoData, taskId: string, approve: boolean, reviewNote: string, now: string): DemoData {
  const note = reviewNote.trim();
  const task = data.tasks.find((item) => item.id === taskId);
  const plot = data.plots.find((item) => item.id === task?.plotId);
  const result = task?.result;
  if (task?.status !== "submitted_review" || !plot || !result) throw new Error("Hasil pendataan sudah diproses atau direset. Muat ulang daftar tugas.");
  if (!approve && !note) throw new Error("Isi catatan pemeriksa agar koperasi tahu bagian yang perlu diperbaiki.");
  const { owner, documentType, documentRef, geometry } = result;
  const next: DemoData = {
    ...data,
    // Hasil diterima melengkapi data lahan. Temuan layer tetap dihitung ulang dan tidak otomatis hilang.
    plots: approve ? data.plots.map((item) => item.id === plot.id ? { ...item, owner, documentType, documentRef, geometry, reviewed: true } : item) : data.plots,
    tasks: data.tasks.map((item) => item.id === taskId ? {
      ...item,
      status: approve ? "verified_completed" : "revision_requested",
      reviewNote: note || "Hasil pendataan diterima.",
      history: [...item.history, event("pemeriksa", approve ? "Hasil diterima" : "Perlu perbaikan", now, note || undefined)],
    } : item),
  };
  return withActivity(next, approve ? `Hasil ${task.id} diterima, data ${plot.id} diperbarui` : `${task.id} dikembalikan untuk perbaikan`, `/dashboard/cooperatives?tugas=${task.id}`, now);
}

export type LotInput = Omit<Lot, "allocations"> & { allocations: Allocation[] };

/** Pemeriksaan isian sebelum lot disimpan. Temuan risiko/kapasitas tidak memblokir, tetapi tercatat sebagai hasil pemeriksaan. */
export function lotInputErrors(lot: LotInput, data: DemoData, isNew: boolean) {
  const errors: string[] = [];
  if (isNew) {
    if (!/^[A-Z0-9-]{3,40}$/.test(lot.id)) errors.push("Nomor lot hanya berisi huruf kapital, angka, atau tanda hubung (3–40 karakter).");
    else if (data.lots.some((item) => item.id === lot.id)) errors.push(`Nomor lot ${lot.id} sudah digunakan.`);
  }
  if (!data.suppliers.some((item) => item.id === lot.supplierId)) errors.push("Pilih pemasok lot.");
  if (!validDate(lot.date)) errors.push("Isi tanggal penerimaan yang valid.");
  if (!positiveTonsValue(lot.weight)) errors.push("Berat kiriman harus lebih dari 0 ton dengan maksimal dua angka desimal.");
  if (!lot.allocations.length) errors.push("Tambahkan minimal satu lahan sumber.");
  const seen = new Set<string>();
  lot.allocations.forEach(({ plotId, tons }, index) => {
    const row = `Baris sumber ${index + 1}`;
    if (!plotId) errors.push(`${row}: pilih lahan sumber.`);
    else if (seen.has(plotId)) errors.push(`${row}: ${plotId} sudah dipilih di baris lain. Gabungkan tonasenya.`);
    seen.add(plotId);
    if (!positiveTonsValue(tons)) errors.push(`${row}: isi tonase lebih dari 0 ton dengan maksimal dua angka desimal.`);
  });
  const total = lot.allocations.reduce((sum, { tons }) => sum + Math.round((Number.isFinite(tons) ? tons : 0) * 100), 0);
  if (positiveTonsValue(lot.weight) && lot.allocations.length && total !== Math.round(lot.weight * 100)) {
    errors.push(`Total alokasi ${formatNumber(total / 100)} ton harus sama dengan berat kiriman ${formatNumber(lot.weight)} ton.`);
  }
  return errors;
}

/** Menyimpan lot beserta alokasinya sebagai satu perubahan: gagal seluruhnya atau berhasil seluruhnya. */
export function saveLot(data: DemoData, input: LotInput, isNew: boolean, now: string): DemoData {
  const lot: Lot = {
    ...input,
    id: input.id.trim().toUpperCase(),
    receivingRef: input.receivingRef.trim(), transportRef: input.transportRef.trim(),
    species: input.species.trim(), exportGroup: input.exportGroup.trim(),
    allocations: input.allocations.map(({ plotId, tons }) => ({ plotId, tons })),
  };
  const errors = lotInputErrors(lot, data, isNew);
  if (errors.length) throw new Error(errors.join(" "));
  if (!isNew && !data.lots.some((item) => item.id === lot.id)) throw new Error("Lot tidak ditemukan. Data demo mungkin telah direset.");
  const lots = isNew ? [...data.lots, lot] : data.lots.map((item) => item.id === lot.id ? lot : item);
  const text = isNew ? `Lot ${lot.id} dicatat, ${formatNumber(lot.weight)} ton dari ${lot.allocations.length} sumber` : `Alokasi ${lot.id} diperbarui`;
  return withActivity({ ...data, lots }, text, `/dashboard/traceability?lot=${lot.id}`, now);
}

export type ImportedRow = { supplier: Supplier; plot: Plot; newSupplier: boolean };

export function importPlots(data: DemoData, rows: ImportedRow[], now: string): DemoData {
  if (!rows.length) throw new Error("Tidak ada baris valid untuk disimpan.");
  const suppliers = [...data.suppliers];
  const plots = [...data.plots];
  for (const { supplier, plot } of rows) {
    if (plots.some((item) => item.id === plot.id)) throw new Error(`Kode lahan ${plot.id} sudah ada. Pratinjau ulang file impor.`);
    if (!suppliers.some((item) => item.id === supplier.id)) suppliers.push(supplier);
    plots.push({ ...plot, capacityDate: plot.capacityDate || jakartaDate(now), reviewed: false });
  }
  return withActivity({ ...data, suppliers, plots }, `${rows.length} lahan diimpor dan menunggu peninjauan`, "/dashboard/due-diligence?status=perlu", now);
}

export function taskTypeLabel(type: TaskType) {
  return taskTypes[type].label;
}

export type PayrollMonth = {
  /** Bulan kalender WIB, format YYYY-MM. */
  month: string;
  honorIdr: number;
  assigned: number;
  accepted: number;
  obstacles: number;
  /** "paid" untuk bulan yang sudah lewat, "running" untuk bulan terbaru. */
  status: "paid" | "running";
};

/**
 * Rekap honor bulanan fieldco satu koperasi (simulasi). Honor tetap per bulan;
 * jumlah tugas hanya menjadi catatan kinerja. Rentang bulan diturunkan dari data,
 * bukan dari jam, agar render tetap deterministik.
 */
export function fieldcoPayroll(data: DemoData, cooperativeId: string): PayrollMonth[] {
  const tasks = data.tasks.filter((task) => task.cooperativeId === cooperativeId);
  const month = (iso: string) => jakartaDate(iso).slice(0, 7);
  const stamps = [...data.activity.map((item) => item.at), ...tasks.flatMap((task) => [task.createdAt, ...task.history.map((event) => event.at)])];
  if (!stamps.length) return [];
  const months = stamps.map(month).sort();
  const last = months[months.length - 1];
  const result: PayrollMonth[] = [];
  let [year, mon] = months[0].split("-").map(Number);
  for (;;) {
    const key = `${year}-${String(mon).padStart(2, "0")}`;
    result.push({
      month: key,
      honorIdr: fieldcoMonthlyHonorIdr,
      assigned: tasks.filter((task) => month(task.createdAt) === key).length,
      accepted: tasks.filter((task) => task.history.some((event) => event.action === "Hasil diterima" && month(event.at) === key)).length,
      obstacles: tasks.reduce((sum, task) => sum + task.obstacles.filter((item) => month(item.at) === key).length, 0),
      status: key === last ? "running" : "paid",
    });
    if (key >= last) break;
    mon += 1;
    if (mon > 12) { mon = 1; year += 1; }
  }
  return result.reverse();
}
