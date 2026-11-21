"use client";

import { latLngBounds, type LeafletEventHandlerFnMap } from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { demoLayers, type Plot, type Risk } from "@/lib/mock-data";
import { riskLabels, screenPlot } from "@/lib/screening";

const colors: Record<Risk, string> = { green: "#237443", yellow: "#ad750d", red: "#b53c30" };
const demoRiver: [number, number][] = [[-1.692, 103.765], [-1.706, 103.788], [-1.713, 103.811], [-1.692, 103.835], [-1.697, 103.859], [-1.685, 103.888], [-1.691, 103.916], [-1.675, 103.945], [-1.68, 103.967]];

export type PlotMapProps = {
  plots: Plot[];
  /** Lahan yang menjadi fokus tampilan peta. Kosong berarti seluruh lahan. */
  focus: Plot[];
  /** Lahan milik pemasok terpilih; lahan lain ditampilkan redup. */
  highlightIds: string[];
  viewRevision: number;
  selectedPlotId: string | null;
  visibleLayers: string[];
  onPlotSelect: (plot: Plot) => void;
};

function FitPlots({ plots, viewRevision }: { plots: Plot[]; viewRevision: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = latLngBounds(plots.flatMap((plot) => plot.geometry.coordinates[0].map(([x, y]): [number, number] => [y, x])));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14, animate: false });
  }, [map, plots, viewRevision]);
  return null;
}

/** Leaflet menghitung ukuran saat dibuat; perbarui saat kontainer berubah ukuran (sidebar, rotasi layar). */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function PlotMap({ plots, focus, highlightIds, viewRevision, selectedPlotId, visibleLayers, onPlotSelect }: PlotMapProps) {
  const [tileError, setTileError] = useState(false);
  // Next menyembunyikan halaman (bukan membongkarnya) saat pindah menu, lalu menampilkannya lagi.
  // Peta Leaflet dibuang saat halaman tersembunyi dan dibuat baru saat tampil, supaya elemen peta
  // lama tidak dipakai ulang ("Map container is being reused by another instance").
  const [active, setActive] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- peta harus dibuat ulang tiap halaman tampil lagi
    setActive(true);
    return () => setActive(false);
  }, []);
  const tileEvents: LeafletEventHandlerFnMap = { tileerror: () => setTileError(true) };
  return (
    <div className="plot-map-frame">
      {active && <MapContainer center={[-1.706, 103.86]} zoom={12} scrollWheelZoom={false} className="plot-map" aria-label="Peta lahan sumber dan layer pemeriksaan simulasi">
        {!tileError && <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={tileEvents} />}
        {tileError && <Polyline positions={demoRiver} pathOptions={{ color: "#9fbbc0", weight: 7, opacity: 0.8 }} interactive={false} />}
        <FitPlots plots={focus.length ? focus : plots} viewRevision={viewRevision} />
        <ResizeWatcher />
        {demoLayers.filter((layer) => visibleLayers.includes(layer.id)).map((layer) => (
          <GeoJSON key={layer.id} data={layer.geometry} style={{ color: layer.color, fillOpacity: 0.16, dashArray: "5 5", weight: 2, interactive: false }}>
            <Tooltip sticky>{layer.name} · simulasi</Tooltip>
          </GeoJSON>
        ))}
        {plots.map((plot) => {
          const { risk } = screenPlot(plot);
          const selected = plot.id === selectedPlotId;
          const highlighted = !highlightIds.length || highlightIds.includes(plot.id);
          return (
            <GeoJSON
              key={`${plot.id}-${JSON.stringify(plot.geometry)}`}
              data={plot.geometry}
              style={{ color: selected ? "#11241a" : colors[risk], fillColor: colors[risk], fillOpacity: selected ? 0.7 : highlighted ? 0.42 : 0.12, opacity: highlighted ? 1 : 0.45, weight: selected ? 4 : highlighted ? 2.5 : 1.5 }}
              eventHandlers={{ click: () => onPlotSelect(plot) }}
            >
              <Tooltip direction="top"><strong>{plot.id}</strong> · {plot.owner}<br />{riskLabels[risk]}</Tooltip>
            </GeoJSON>
          );
        })}
      </MapContainer>}
      {tileError && <span className="map-offline">Peta dasar tidak termuat · batas skematis</span>}
      <span className="map-sim-label">Layer contoh · simulasi</span>
    </div>
  );
}
