import { demoLayers, type DemoData, type Lot, type Plot, type PlotGeometry, type Position, type Risk } from "./mock-data";

export const riskLabels: Record<Risk, string> = {
  green: "Lolos pemeriksaan awal",
  yellow: "Perlu dilengkapi",
  red: "Perlu investigasi",
};

const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const currencyFormat = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
// Zona waktu tetap agar hasil format sama di server dan browser.
const dateTimeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatCurrency(value: number) {
  return currencyFormat.format(value);
}

export function formatDate(date: string) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function formatDateTime(iso: string) {
  return `${dateTimeFormat.format(new Date(iso))} WIB`;
}

/** Tanggal kalender di zona WIB (YYYY-MM-DD) dari stempel waktu ISO. */
export function jakartaDate(iso: string) {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function orientation(a: Position, b: Position, c: Position) {
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return Math.abs(cross) < 1e-12 ? 0 : Math.sign(cross);
}

function onSegment(a: Position, b: Position, point: Position) {
  return point.every((coordinate, index) => (
    coordinate >= Math.min(a[index], b[index]) && coordinate <= Math.max(a[index], b[index])
  ));
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position) {
  const ac = orientation(a, b, c);
  const ad = orientation(a, b, d);
  const ca = orientation(c, d, a);
  const cb = orientation(c, d, b);
  return (ac * ad < 0 && ca * cb < 0)
    || (!ac && onSegment(a, b, c)) || (!ad && onSegment(a, b, d))
    || (!ca && onSegment(c, d, a)) || (!cb && onSegment(c, d, b));
}

function edges(ring: Position[]) {
  return ring.slice(1).map((end, index) => [ring[index], end] as const);
}

function contains(ring: Position[], [x, y]: Position) {
  let inside = false;
  for (const [[ax, ay], [bx, by]] of edges(ring)) {
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function intersects(first: PlotGeometry, second: PlotGeometry) {
  const [left] = first.coordinates;
  const [right] = second.coordinates;
  const rightEdges = edges(right);
  return contains(left, right[0]) || contains(right, left[0])
    || edges(left).some(([a, b]) => rightEdges.some(([c, d]) => segmentsIntersect(a, b, c, d)));
}

export function parseGeometry(text: string): PlotGeometry {
  let input: { type?: unknown; coordinates?: unknown };
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("GeoJSON belum berupa JSON yang valid.");
  }
  if (!input || input.type !== "Polygon" || !Array.isArray(input.coordinates) || input.coordinates.length !== 1) {
    throw new Error("Gunakan GeoJSON Polygon dengan satu cincin luar.");
  }
  const ring: unknown = input.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 501 || !ring.every((point): point is Position => (
    Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
  ))) {
    throw new Error("Masukkan 4–501 pasangan bujur dan lintang yang valid.");
  }
  const unique = new Set(ring.slice(0, -1).map((point) => point.join(",")));
  if (ring[0].join(",") !== ring.at(-1)?.join(",") || unique.size !== ring.length - 1) {
    throw new Error("Tutup poligon dengan mengulang titik awal. Titik lainnya harus berbeda.");
  }
  const segments = edges(ring);
  const [x, y] = ring[0];
  const area = segments.reduce((sum, [[ax, ay], [bx, by]]) => sum + (ax - x) * (by - y) - (bx - x) * (ay - y), 0);
  const hasCrossing = segments.some(([a, b], index) => segments.some(([c, d], other) => (
    other > index + 1 && (index !== 0 || other !== segments.length - 1) && segmentsIntersect(a, b, c, d)
  )));
  if (Math.abs(area) < 1e-12 || hasCrossing) {
    throw new Error("Poligon harus memiliki luas dan batas yang tidak berpotongan.");
  }
  return { type: "Polygon", coordinates: [area > 0 ? ring : [...ring].reverse()] };
}

/** Kelengkapan data lahan, terpisah dari temuan risiko geospasial. */
export function plotCompleteness(plot: Plot) {
  const missing: string[] = [];
  if (!plot.owner.trim()) missing.push("Nama pemilik");
  if (!plot.documentType.trim()) missing.push("Jenis dokumen lahan");
  if (!plot.documentRef.trim()) missing.push("Nomor dokumen lahan");
  return { complete: missing.length === 0 && plot.reviewed, missing, reviewed: plot.reviewed };
}

/** Temuan perpotongan dengan layer contoh. Hasil simulasi, bukan analisis resmi. */
export function plotFlags(plot: Plot) {
  return demoLayers.filter((layer) => intersects(plot.geometry, layer.geometry)).map(({ id, name }) => ({ id, name }));
}

export function screenPlot(plot: Plot): { risk: Risk; reasons: string[] } {
  const flags = plotFlags(plot);
  const { missing, reviewed } = plotCompleteness(plot);
  const reasons = flags.map((layer) => `Masuk area ${layer.name.toLowerCase()} (simulasi).`);
  if (missing.length) reasons.push(`Belum lengkap: ${missing.join(", ").toLowerCase()}.`);
  if (!reviewed) reasons.push("Belum ditinjau pemeriksa.");
  return { risk: flags.length ? "red" : reasons.length ? "yellow" : "green", reasons };
}

export function screenSupplier(plots: Plot[]): Risk {
  const statuses = plots.map((plot) => screenPlot(plot).risk);
  if (statuses.includes("red")) return "red";
  return statuses.length && statuses.every((risk) => risk === "green") ? "green" : "yellow";
}

function hundredths(tons: number) {
  return Math.round(tons * 100);
}

function positiveTons(tons: number) {
  const scaled = tons * 100;
  return Number.isSafeInteger(Math.round(scaled)) && scaled >= 1 && Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export function positiveTonsValue(tons: number) {
  return positiveTons(tons);
}

export type IssueCategory = "berat" | "bukti" | "risiko" | "kapasitas" | "pemasok";
export type LotIssue = { risk: "red" | "yellow"; category: IssueCategory; message: string };

export const issueCategoryLabels: Record<IssueCategory, string> = {
  berat: "Berat kiriman",
  bukti: "Data kurang",
  risiko: "Temuan risiko",
  kapasitas: "Kapasitas lahan",
  pemasok: "Hubungan pemasok",
};

export function validateLot(lot: Lot, data: DemoData) {
  const period = lot.date.slice(0, 4);
  const issues: LotIssue[] = [];
  const add = (risk: "red" | "yellow", category: IssueCategory, message: string) => issues.push({ risk, category, message });
  const candidates = lot.allocations.filter(({ tons }) => positiveTons(tons));
  const total = candidates.reduce((sum, row) => sum + hundredths(row.tons), 0);
  const knownSupplier = data.suppliers.some((supplier) => supplier.id === lot.supplierId);

  if (!knownSupplier) add("yellow", "pemasok", "Pemasok lot belum tercatat dalam registri.");
  const missingRefs = [
    !lot.receivingRef.trim() && "referensi penerimaan pabrik",
    !lot.transportRef.trim() && "dokumen angkutan",
    !lot.species.trim() && "jenis kayu",
  ].filter(Boolean);
  if (missingRefs.length) add("yellow", "bukti", `Lengkapi ${missingRefs.join(", ")}.`);
  if (!positiveTons(lot.weight)) add("red", "berat", "Berat lot harus lebih dari 0 ton dengan maksimal dua angka desimal.");
  if (!lot.allocations.length) add("yellow", "bukti", "Belum ada lahan sumber yang dialokasikan.");
  else if (total !== hundredths(lot.weight)) {
    add("red", "berat", `Total ${formatNumber(total / 100)} ton tidak sama dengan berat kiriman ${formatNumber(lot.weight)} ton.`);
  }

  const totalsByPlot = new Map<string, number>();
  for (const { plotId, tons } of lot.allocations) {
    if (!positiveTons(tons)) add("red", "berat", `${plotId || "Baris alokasi"}: tonase harus lebih dari 0 ton dengan maksimal dua angka desimal.`);
    if (!totalsByPlot.has(plotId)) totalsByPlot.set(plotId, 0);
    if (positiveTons(tons)) totalsByPlot.set(plotId, (totalsByPlot.get(plotId) ?? 0) + hundredths(tons));
  }

  const sources = [...totalsByPlot].map(([plotId, tons]) => {
    const plot = data.plots.find((item) => item.id === plotId);
    const otherLots = data.lots.flatMap((other) => {
      if (other.id === lot.id || other.date.slice(0, 4) !== period) return [];
      const used = other.allocations.reduce((sum, allocation) => (
        allocation.plotId === plotId && positiveTons(allocation.tons) ? sum + hundredths(allocation.tons) : sum
      ), 0);
      return used ? [{ id: other.id, used }] : [];
    });
    const used = otherLots.reduce((sum, other) => sum + other.used, 0);
    const screening = plot ? screenPlot(plot) : undefined;
    let overCapacity = false;

    if (!plot) add("yellow", "bukti", `${plotId || "Lahan sumber"} belum tercatat dalam registri.`);
    else {
      if (plot.supplierId !== lot.supplierId) {
        const owner = data.suppliers.find((item) => item.id === plot.supplierId);
        add("red", "pemasok", `${plot.id} milik ${owner?.name ?? "pemasok lain"}, bukan pemasok lot ini.`);
      }
      for (const flag of plotFlags(plot)) add("red", "risiko", `${plot.id} masuk area ${flag.name.toLowerCase()} (simulasi).`);
      const completeness = plotCompleteness(plot);
      if (completeness.missing.length) add("yellow", "bukti", `${plot.id}: belum lengkap (${completeness.missing.join(", ").toLowerCase()}).`);
      if (!completeness.reviewed) add("yellow", "bukti", `${plot.id}: sumber belum ditinjau pemeriksa.`);
      const available = hundredths(plot.annualCapacity) - used;
      if (tons > available) {
        overCapacity = true;
        add("red", "kapasitas", `${plot.id}: ${formatNumber(tons / 100)} ton melebihi sisa kapasitas ${formatNumber(Math.max(0, available) / 100)} ton (tahun ${period}).`);
      }
    }
    return {
      plotId, plot, screening, overCapacity,
      tons: tons / 100, usedByOthers: used / 100,
      available: plot ? Math.max(0, hundredths(plot.annualCapacity) - used) / 100 : 0,
      otherLots: otherLots.map(({ id }) => id),
    };
  });

  const risk: Risk = issues.some((issue) => issue.risk === "red") ? "red" : issues.length ? "yellow" : "green";
  const missing = issues.filter((issue) => issue.category === "bukti").map(({ message }) => message);
  const productLinked = Boolean(lot.exportGroup.trim());
  return { period, total: total / 100, issues, sources, risk, missing, productLinked };
}

export type LotValidation = ReturnType<typeof validateLot>;
