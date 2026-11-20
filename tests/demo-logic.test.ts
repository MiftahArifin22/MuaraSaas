import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignTask, fieldcoPayroll, reportObstacle, reviewTask, saveFieldResult, saveLot, startTask } from "../src/lib/demo-actions";
import { previewImport, sampleCsv, sampleJson } from "../src/lib/import";
import { seed, type DemoData, type Lot } from "../src/lib/mock-data";
import { screenPlot, screenSupplier, validateLot } from "../src/lib/screening";

const now = "2026-11-19T03:00:00.000Z";
const lot = (data: DemoData, id: string) => data.lots.find((item) => item.id === id) as Lot;
const fieldResult = (data: DemoData, plotId: string) => {
  const plot = data.plots.find((item) => item.id === plotId)!;
  return { owner: plot.owner, documentType: plot.documentType, documentRef: "SKT-003", geometry: plot.geometry, note: "Dokumen asli diperiksa." };
};

describe("validasi lot", () => {
  it("lot dengan dua sumber yang memenuhi aturan lolos pemeriksaan awal", () => {
    const result = validateLot(lot(seed, "LOT-2611-001"), seed);
    assert.equal(result.risk, "green");
    assert.equal(result.sources.length, 2);
    assert.equal(result.total, 80);
    assert.deepEqual(result.issues, []);
  });

  it("sumber yang belum diperiksa menjadi kekurangan bukti, dan kelompok produk kosong dicatat", () => {
    const result = validateLot(lot(seed, "LOT-2611-002"), seed);
    assert.equal(result.risk, "yellow");
    assert.ok(result.missing.some((message) => message.includes("LH-003") && message.includes("belum ditinjau")));
    assert.equal(result.productLinked, false);
  });

  it("temuan layer dan kelebihan kapasitas pada periode yang sama menjadi temuan merah beralasan", () => {
    const result = validateLot(lot(seed, "LOT-2611-004"), seed);
    assert.equal(result.risk, "red");
    const capacity = result.issues.find((issue) => issue.category === "kapasitas");
    assert.ok(capacity, "temuan kapasitas harus ada");
    assert.match(capacity.message, /LH-006/);
    assert.match(capacity.message, /2026/);
    const other = validateLot(lot(seed, "LOT-2611-003"), seed);
    assert.ok(other.issues.some((issue) => issue.category === "risiko" && issue.message.includes("deforestasi")));
  });

  it("alokasi lain di tahun berbeda tidak memakan kapasitas", () => {
    const data = { ...seed, lots: seed.lots.map((item) => item.id === "LOT-2611-003" ? { ...item, date: "2025-11-11" } : item) };
    const result = validateLot(lot(data, "LOT-2611-004"), data);
    assert.ok(!result.issues.some((issue) => issue.category === "kapasitas"));
  });

  it("sumber milik pemasok lain ditandai", () => {
    const changed = { ...lot(seed, "LOT-2611-001"), allocations: [{ plotId: "LH-001", tons: 70 }, { plotId: "LH-007", tons: 10 }] };
    const result = validateLot(changed, seed);
    assert.ok(result.issues.some((issue) => issue.category === "pemasok" && issue.message.includes("LH-007")));
  });
});

describe("penyimpanan lot", () => {
  const base = { id: "LOT-2611-010", supplierId: "PS-001", receivingRef: "GR-1", transportRef: "NA-1", species: "Acacia mangium", date: "2026-11-19", exportGroup: "", weight: 20 };

  it("menolak total alokasi yang tidak sama dengan berat kiriman", () => {
    assert.throws(() => saveLot(seed, { ...base, allocations: [{ plotId: "LH-001", tons: 10 }] }, true, now), /harus sama dengan berat kiriman/);
  });

  it("menolak tonase nol/negatif dan lahan ganda", () => {
    assert.throws(() => saveLot(seed, { ...base, allocations: [{ plotId: "LH-001", tons: 20 }, { plotId: "LH-002", tons: 0 }] }, true, now), /lebih dari 0 ton/);
    assert.throws(() => saveLot(seed, { ...base, allocations: [{ plotId: "LH-001", tons: 10 }, { plotId: "LH-001", tons: 10 }] }, true, now), /sudah dipilih/);
  });

  it("menolak nomor lot ganda dan tidak mengubah data bila gagal", () => {
    const before = JSON.stringify(seed);
    assert.throws(() => saveLot(seed, { ...base, id: "LOT-2611-001", allocations: [{ plotId: "LH-001", tons: 20 }] }, true, now), /sudah digunakan/);
    assert.equal(JSON.stringify(seed), before);
  });

  it("menyimpan lot baru beserta aktivitas, dan kelebihan kapasitas tetap dapat dicatat sebagai temuan", () => {
    const next = saveLot(seed, { ...base, weight: 100, allocations: [{ plotId: "LH-002", tons: 100 }] }, true, now);
    assert.equal(next.lots.length, seed.lots.length + 1);
    assert.equal(next.activity[0].at, now);
    assert.equal(validateLot(lot(next, "LOT-2611-010"), next).risk, "red");
  });
});

describe("transisi tugas koperasi", () => {
  it("menjalankan alur Ditugaskan → Dikerjakan → Dikirim → Perlu perbaikan → Dikirim → Diterima", () => {
    const { data: assigned, id } = assignTask(seed, { supplierId: "PS-002", cooperativeId: "KOP-02", plotId: "LH-003", taskType: "dokumen", scope: "", dueDate: "2026-11-30" }, now);
    assert.equal(assigned.tasks.find((task) => task.id === id)?.status, "assigned");
    const started = startTask(assigned, id, now);
    const obstacle = reportObstacle(started, id, "Pemilik sedang di luar desa.", now);
    const submitted = saveFieldResult(obstacle, id, fieldResult(obstacle, "LH-003"), true, now);
    assert.equal(submitted.tasks.find((task) => task.id === id)?.status, "submitted_review");
    assert.throws(() => reviewTask(submitted, id, false, "", now), /catatan pemeriksa/);
    const revision = reviewTask(submitted, id, false, "Foto dokumen buram.", now);
    assert.equal(revision.tasks.find((task) => task.id === id)?.status, "revision_requested");
    const resubmitted = saveFieldResult(revision, id, fieldResult(revision, "LH-003"), true, now);
    const accepted = reviewTask(resubmitted, id, true, "", now);
    const task = accepted.tasks.find((item) => item.id === id)!;
    assert.equal(task.status, "verified_completed");
    assert.equal(task.obstacles.length, 1);
    assert.deepEqual(task.history.map((item) => item.action), ["Tugas dibuat", "Mulai dikerjakan", "Kendala dilaporkan", "Hasil dikirim untuk ditinjau", "Perlu perbaikan", "Hasil dikirim untuk ditinjau", "Hasil diterima"]);
    assert.equal(screenPlot(accepted.plots.find((plot) => plot.id === "LH-003")!).risk, "green");
  });

  it("mencegah penugasan ganda pada lahan dengan tugas aktif", () => {
    assert.throws(() => assignTask(seed, { supplierId: "PS-004", cooperativeId: "KOP-01", plotId: "LH-008", taskType: "dokumen", scope: "", dueDate: "2026-11-30" }, now), /sudah memiliki tugas aktif TGS-002/);
  });

  it("menolak tenggat yang sudah lewat dan lahan yang sudah lolos", () => {
    assert.throws(() => assignTask(seed, { supplierId: "PS-002", cooperativeId: "KOP-02", plotId: "LH-003", taskType: "dokumen", scope: "", dueDate: "2026-11-01" }, now), /sebelum hari ini/);
    assert.throws(() => assignTask(seed, { supplierId: "PS-001", cooperativeId: "KOP-01", plotId: "LH-001", taskType: "dokumen", scope: "", dueDate: "2026-11-30" }, now), /sudah lolos/);
  });

  it("hasil diterima tidak menghapus temuan risiko layer", () => {
    const submitted = saveFieldResult(seed, "TGS-003", { ...fieldResult(seed, "LH-005"), documentRef: "SKT-005" }, true, now);
    const accepted = reviewTask(submitted, "TGS-003", true, "", now);
    assert.equal(screenPlot(accepted.plots.find((plot) => plot.id === "LH-005")!).risk, "red");
    assert.equal(screenSupplier(accepted.plots.filter((plot) => plot.supplierId === "PS-003")), "red");
  });

  it("tidak dapat meninjau tugas yang belum dikirim", () => {
    assert.throws(() => reviewTask(seed, "TGS-003", true, "", now), /sudah diproses/);
  });
});

describe("impor lahan", () => {
  it("contoh CSV dan JSON valid seluruhnya", () => {
    for (const [text, name] of [[sampleCsv(), "contoh.csv"], [sampleJson(), "contoh.json"]]) {
      const rows = previewImport(text, name, seed);
      assert.equal(rows.length, 2);
      assert.ok(rows.every((row) => row.errors.length === 0 && row.value), JSON.stringify(rows.map((row) => row.errors)));
      assert.equal(rows[1].value?.newSupplier, true);
    }
  });

  it("menunjukkan kesalahan per baris", () => {
    const csv = `${sampleCsv()}\nPS-001,,,LH-001,,Desa,SKT,,-2,abc,Dasar,{}`;
    const rows = previewImport(csv, "data.csv", seed);
    const bad = rows[2];
    assert.equal(bad.line, 4);
    assert.ok(bad.errors.some((error) => error.includes("Nama pemilik")));
    assert.ok(bad.errors.some((error) => error.includes("Luas")));
  });

  it("menolak kolom yang hilang", () => {
    assert.throws(() => previewImport("kode_lahan,pemilik\nLH-1,A", "x.csv", seed), /Kolom belum ada/);
  });
});

describe("honor fieldco bulanan", () => {
  it("honor tetap Rp16 juta per bulan, bulan terbaru berjalan", () => {
    const rows = fieldcoPayroll(seed, "KOP-01");
    assert.deepEqual(rows.map((row) => row.month), ["2026-11", "2026-10"]);
    assert.ok(rows.every((row) => row.honorIdr === 16_000_000));
    assert.equal(rows[0].status, "running");
    assert.equal(rows[1].status, "paid");
    assert.equal(rows[0].accepted, 1);
  });
});
