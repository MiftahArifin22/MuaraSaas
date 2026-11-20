export type Risk = "green" | "yellow" | "red";
export type Position = [longitude: number, latitude: number];

export type PlotGeometry = {
  type: "Polygon";
  coordinates: [Position[]];
};

export type Supplier = {
  id: string;
  name: string;
  type: string;
  location: string;
  cooperativeId: string;
};

export type Plot = {
  id: string;
  supplierId: string;
  owner: string;
  village: string;
  documentType: string;
  documentRef: string;
  areaHa: number;
  /** Perkiraan hasil kayu per tahun kalender, dalam ton. */
  annualCapacity: number;
  /** Dasar perhitungan kapasitas, misalnya hasil inventarisasi tegakan. */
  capacityBasis: string;
  /** Tanggal kapasitas dicatat (YYYY-MM-DD). */
  capacityDate: string;
  geometry: PlotGeometry;
  reviewed: boolean;
};

export type Allocation = { plotId: string; tons: number };

export type Lot = {
  id: string;
  supplierId: string;
  receivingRef: string;
  transportRef: string;
  species: string;
  date: string;
  /** Kode kelompok produk bila hubungan produksinya tersedia. Kosong berarti belum tertaut. */
  exportGroup: string;
  weight: number;
  allocations: Allocation[];
};

export type FieldResult = Pick<Plot, "owner" | "documentType" | "documentRef" | "geometry"> & {
  note: string;
  /** Nama berkas bukti yang dilampirkan mitra. Dalam demo, isi berkas tidak diunggah. */
  evidence?: string[];
};

export type TaskStatus = "assigned" | "in_progress" | "submitted_review" | "revision_requested" | "verified_completed";
export type TaskType = "dokumen" | "pemetaan" | "klarifikasi";
export type Actor = "pabrik" | "koperasi" | "pemeriksa";

export type TaskEvent = { at: string; actor: Actor; action: string; note?: string };

export type Task = {
  id: string;
  supplierId: string;
  cooperativeId: string;
  plotId: string;
  taskType: TaskType;
  scope: string;
  dueDate: string;
  createdAt: string;
  /** Biaya jasa mitra (simulasi), dalam rupiah. */
  feeIdr: number;
  status: TaskStatus;
  result?: FieldResult;
  reviewNote?: string;
  obstacles: { at: string; note: string }[];
  history: TaskEvent[];
};

export type Activity = { id: string; at: string; text: string; href: string };

export type DemoData = {
  version: 2;
  mill: { name: string; region: string; reference: string };
  cooperatives: { id: string; name: string; region: string }[];
  suppliers: Supplier[];
  plots: Plot[];
  lots: Lot[];
  tasks: Task[];
  activity: Activity[];
};

export const taskTypes: Record<TaskType, { label: string; fee: number; requirements: string[] }> = {
  dokumen: {
    label: "Lengkapi dokumen lahan",
    fee: 350_000,
    requirements: ["Nama pemilik sesuai dokumen", "Jenis dan nomor dokumen lahan", "Foto atau salinan dokumen"],
  },
  pemetaan: {
    label: "Petakan ulang batas lahan",
    fee: 750_000,
    requirements: ["Titik batas lahan hasil GPS", "Poligon GeoJSON satu cincin luar", "Catatan kondisi tegakan"],
  },
  klarifikasi: {
    label: "Klarifikasi temuan di lapangan",
    fee: 500_000,
    requirements: ["Penjelasan pemilik atas temuan", "Foto kondisi lahan bertanggal", "Batas lahan yang dikonfirmasi"],
  },
};

/** Honor tetap fieldco per bulan (simulasi), dalam rupiah. Tidak bergantung pada jumlah tugas atau status hijau. */
export const fieldcoMonthlyHonorIdr = 16_000_000;

/** Koordinator lapangan (fieldco) tiap koperasi mitra. Nama fiktif untuk demo. */
export const fieldcos: Record<string, { name: string }> = {
  "KOP-01": { name: "Andi Prasetyo" },
  "KOP-02": { name: "Siti Nurhaliza" },
};

function rectangle(west: number, south: number, east: number, north: number): PlotGeometry {
  return {
    type: "Polygon",
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
}

export const demoLayers = [
  { id: "protected", name: "Kawasan lindung", color: "#8c4784", geometry: rectangle(103.831, -1.732, 103.857, -1.708) },
  { id: "peat", name: "Lahan gambut", color: "#8d683b", geometry: rectangle(103.875, -1.688, 103.911, -1.663) },
  { id: "deforestation", name: "Indikasi deforestasi pasca-2020", color: "#ca5645", geometry: rectangle(103.910, -1.742, 103.941, -1.716) },
] as const;

const inventory = "Inventarisasi tegakan contoh";

export const seed: DemoData = {
  version: 2,
  mill: { name: "Pabrik Serat Teluk Jelutong", region: "Muaro Jambi, Jambi", reference: "SVLK-001" },
  cooperatives: [
    { id: "KOP-01", name: "Koperasi Rimba Muara", region: "Kumpeh Ulu, Muaro Jambi" },
    { id: "KOP-02", name: "Koperasi Tunas Batanghari", region: "Kumpeh, Muaro Jambi" },
  ],
  suppliers: [
    { id: "PS-001", name: "CV Akar Lestari", type: "Pengepul", location: "Kumpeh Ulu, Muaro Jambi", cooperativeId: "KOP-01" },
    { id: "PS-002", name: "Kelompok Tani Tunas Jelutong", type: "Kelompok tani", location: "Kumpeh, Muaro Jambi", cooperativeId: "KOP-02" },
    { id: "PS-003", name: "UD Serat Meranti", type: "Pengepul", location: "Kumpeh, Muaro Jambi", cooperativeId: "KOP-02" },
    { id: "PS-004", name: "Mitra Akasia Sejahtera", type: "HTI mitra", location: "Kumpeh Ulu, Muaro Jambi", cooperativeId: "KOP-01" },
  ],
  plots: [
    { id: "LH-001", supplierId: "PS-001", owner: "Bayu Pranata", village: "Pematang Jering", documentType: "SHM", documentRef: "SHM-001", areaHa: 34.6, annualCapacity: 110, capacityBasis: `${inventory}, riap 3,2 ton/ha`, capacityDate: "2026-03-12", geometry: rectangle(103.789, -1.698, 103.795, -1.693), reviewed: true },
    { id: "LH-002", supplierId: "PS-001", owner: "Rina Maharani", village: "Pematang Jering", documentType: "SKT", documentRef: "SKT-002", areaHa: 29.7, annualCapacity: 85, capacityBasis: `${inventory}, riap 2,9 ton/ha`, capacityDate: "2026-03-12", geometry: rectangle(103.802, -1.704, 103.807, -1.699), reviewed: true },
    { id: "LH-003", supplierId: "PS-002", owner: "Dodi Saputra", village: "Rantau Jelutong", documentType: "SKT", documentRef: "", areaHa: 24.7, annualCapacity: 75, capacityBasis: "Perkiraan pemasok, belum diperiksa", capacityDate: "2026-05-20", geometry: rectangle(103.86, -1.713, 103.865, -1.709), reviewed: false },
    { id: "LH-004", supplierId: "PS-002", owner: "Sari Wulandari", village: "Rantau Jelutong", documentType: "SHM", documentRef: "SHM-004", areaHa: 29.7, annualCapacity: 80, capacityBasis: `${inventory}, riap 2,7 ton/ha`, capacityDate: "2026-04-02", geometry: rectangle(103.867, -1.706, 103.873, -1.702), reviewed: true },
    { id: "LH-005", supplierId: "PS-003", owner: "Ilham Fadli", village: "Teluk Meranti", documentType: "SKT", documentRef: "SKT-005", areaHa: 29.7, annualCapacity: 90, capacityBasis: `${inventory}, riap 3,0 ton/ha`, capacityDate: "2026-02-18", geometry: rectangle(103.916, -1.732, 103.922, -1.728), reviewed: true },
    { id: "LH-006", supplierId: "PS-003", owner: "Yuni Kartika", village: "Teluk Meranti", documentType: "SHM", documentRef: "SHM-006", areaHa: 24.7, annualCapacity: 70, capacityBasis: `${inventory}, riap 2,8 ton/ha`, capacityDate: "2026-02-18", geometry: rectangle(103.903, -1.71, 103.908, -1.706), reviewed: true },
    { id: "LH-007", supplierId: "PS-004", owner: "Farid Hidayat", village: "Sungai Akasia", documentType: "Perhutanan sosial", documentRef: "PS-007", areaHa: 41.5, annualCapacity: 130, capacityBasis: `${inventory}, riap 3,1 ton/ha`, capacityDate: "2026-01-30", geometry: rectangle(103.817, -1.684, 103.823, -1.6784), reviewed: true },
    { id: "LH-008", supplierId: "PS-004", owner: "Hendra Gunawan", village: "Sungai Akasia", documentType: "Surat keterangan desa", documentRef: "", areaHa: 18.2, annualCapacity: 50, capacityBasis: "Perkiraan pemasok, belum diperiksa", capacityDate: "2026-09-08", geometry: rectangle(103.826, -1.69, 103.83, -1.686), reviewed: false },
  ],
  lots: [
    { id: "LOT-2611-001", supplierId: "PS-001", receivingRef: "GR-001", transportRef: "NA-001", species: "Acacia mangium", date: "2026-11-04", exportGroup: "SERAT-A", weight: 80, allocations: [{ plotId: "LH-001", tons: 62 }, { plotId: "LH-002", tons: 18 }] },
    { id: "LOT-2611-002", supplierId: "PS-002", receivingRef: "GR-002", transportRef: "NA-002", species: "Acacia mangium", date: "2026-11-07", exportGroup: "", weight: 60, allocations: [{ plotId: "LH-003", tons: 48 }, { plotId: "LH-004", tons: 12 }] },
    { id: "LOT-2611-003", supplierId: "PS-003", receivingRef: "GR-003", transportRef: "NA-003", species: "Acacia crassicarpa", date: "2026-11-11", exportGroup: "SERAT-B", weight: 68, allocations: [{ plotId: "LH-005", tons: 30 }, { plotId: "LH-006", tons: 38 }] },
    { id: "LOT-2611-004", supplierId: "PS-003", receivingRef: "GR-004", transportRef: "NA-004", species: "Acacia crassicarpa", date: "2026-11-14", exportGroup: "SERAT-B", weight: 45, allocations: [{ plotId: "LH-006", tons: 45 }] },
  ],
  tasks: [
    {
      id: "TGS-001", supplierId: "PS-001", cooperativeId: "KOP-01", plotId: "LH-001", taskType: "dokumen",
      scope: "Cocokkan nama pemilik dan nomor SHM dengan dokumen asli.", dueDate: "2026-11-05", createdAt: "2026-10-28T02:00:00.000Z",
      feeIdr: 350_000, status: "verified_completed", reviewNote: "Dokumen dan batas lahan sesuai.", obstacles: [],
      result: { owner: "Bayu Pranata", documentType: "SHM", documentRef: "SHM-001", geometry: rectangle(103.789, -1.698, 103.795, -1.693), note: "SHM asli diperiksa bersama pemilik. Batas sesuai patok.", evidence: ["foto-shm-lh001.jpg"] },
      history: [
        { at: "2026-10-28T02:00:00.000Z", actor: "pabrik", action: "Tugas dibuat" },
        { at: "2026-10-30T04:10:00.000Z", actor: "koperasi", action: "Hasil dikirim untuk ditinjau" },
        { at: "2026-11-02T07:30:00.000Z", actor: "pemeriksa", action: "Hasil diterima", note: "Dokumen dan batas lahan sesuai." },
      ],
    },
    {
      id: "TGS-002", supplierId: "PS-004", cooperativeId: "KOP-01", plotId: "LH-008", taskType: "dokumen",
      scope: "Minta salinan surat keterangan desa dan pastikan nama pemilik sama.", dueDate: "2026-11-28", createdAt: "2026-11-10T03:00:00.000Z",
      feeIdr: 350_000, status: "submitted_review", obstacles: [],
      result: { owner: "Hendra Gunawan", documentType: "Surat keterangan desa", documentRef: "SKD-008", geometry: rectangle(103.826, -1.69, 103.83, -1.686), note: "Surat keterangan desa ditandatangani kepala desa Sungai Akasia. Batas lahan ditelusuri bersama pemilik.", evidence: ["skd-sungai-akasia-008.pdf", "foto-batas-lh008.jpg"] },
      history: [
        { at: "2026-11-10T03:00:00.000Z", actor: "pabrik", action: "Tugas dibuat" },
        { at: "2026-11-12T01:45:00.000Z", actor: "koperasi", action: "Mulai dikerjakan" },
        { at: "2026-11-17T08:20:00.000Z", actor: "koperasi", action: "Hasil dikirim untuk ditinjau" },
      ],
    },
    {
      id: "TGS-003", supplierId: "PS-003", cooperativeId: "KOP-02", plotId: "LH-005", taskType: "klarifikasi",
      scope: "Lahan beririsan dengan indikasi deforestasi pasca-2020. Konfirmasi riwayat tutupan lahan dan batasnya.", dueDate: "2026-12-03", createdAt: "2026-11-13T02:30:00.000Z",
      feeIdr: 500_000, status: "in_progress",
      obstacles: [{ at: "2026-11-16T06:00:00.000Z", note: "Akses jalan ke lahan tergenang. Kunjungan dijadwalkan ulang." }],
      history: [
        { at: "2026-11-13T02:30:00.000Z", actor: "pabrik", action: "Tugas dibuat" },
        { at: "2026-11-14T01:15:00.000Z", actor: "koperasi", action: "Mulai dikerjakan" },
        { at: "2026-11-16T06:00:00.000Z", actor: "koperasi", action: "Kendala dilaporkan", note: "Akses jalan ke lahan tergenang. Kunjungan dijadwalkan ulang." },
      ],
    },
  ],
  activity: [
    { id: "ACT-004", at: "2026-11-17T08:20:00.000Z", text: "Koperasi Rimba Muara mengirim hasil TGS-002 untuk ditinjau", href: "/dashboard/cooperatives?tugas=TGS-002" },
    { id: "ACT-003", at: "2026-11-16T06:00:00.000Z", text: "Kendala dilaporkan pada TGS-003 (LH-005)", href: "/dashboard/cooperatives?tugas=TGS-003" },
    { id: "ACT-002", at: "2026-11-14T03:05:00.000Z", text: "Lot LOT-2611-004 diterima pabrik, 45 ton", href: "/dashboard/traceability?lot=LOT-2611-004" },
    { id: "ACT-001", at: "2026-11-11T02:40:00.000Z", text: "Lot LOT-2611-003 diterima pabrik, 68 ton", href: "/dashboard/traceability?lot=LOT-2611-003" },
  ],
};
