import { useState } from "react";
import { Card } from "../components/ui";
import { useRead } from "./read";
import type { Row } from "./actions";
import { textValue } from "./read-format";

type Point = { lat: number; lng: number; label: string };
function point(row: Row): Point | null {
  if (row.lat == null || row.lng == null || row.lat === "" || row.lng === "") return null;
  const lat = Number(row.lat), lng = Number(row.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85.05112878 && Math.abs(lng) <= 180
    ? { lat, lng, label: String(row.direccion ?? row.nombre ?? "Parada") } : null;
}
// Web Mercator, in world pixels at zoom zero.
function project(p: Point) {
  const sin = Math.sin(p.lat * Math.PI / 180);
  return { x: (p.lng + 180) / 360 * 256, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 256 };
}

export function RouteMap({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState("");
  const route = rows.find((r) => String(r.id) === selected) ?? rows[0];
  return <Card title="Mapa de la ruta" className="route-map-card">
    <label className="route-picker">Ruta seleccionada
      <select aria-label="Ruta seleccionada" value={String(route?.id ?? "")} onChange={(e) => setSelected(e.target.value)} disabled={!rows.length}>
        {!rows.length && <option value="">Sin rutas disponibles</option>}
        {rows.map((r) => <option key={String(r.id)} value={String(r.id)}>{textValue(r.codigo ?? r.id)} · {textValue(r.estado)}</option>)}
      </select>
    </label>
    {route ? <RouteMapDetail key={String(route.id)} id={String(route.id)} /> : <p>No hay rutas para mostrar.</p>}
  </Card>;
}

function RouteMapDetail({ id }: { id: string }) {
  const read = useRead<Row>(`/rutas/${encodeURIComponent(id)}`);
  const [zoomDelta, setZoomDelta] = useState(0);
  if (read.loading) return <p role="status">Cargando mapa de la ruta…</p>;
  if (read.error) return <div><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar mapa</button></div>;
  const data = read.data ?? {};
  const stops = (Array.isArray(data.paradas) ? [...data.paradas] as Row[] : [])
    .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));
  const markers = stops.map((stop) => ({ stop, point: point(stop) }));
  const valid = markers.flatMap((m) => m.point ? [m.point] : []);
  const geometry = (data.geometria ?? data.geometry) as { type?: string; coordinates?: unknown[] } | undefined;
  const track = geometry?.type === "LineString" && Array.isArray(geometry.coordinates)
    ? geometry.coordinates.flatMap((c) => {
      const p = Array.isArray(c) ? point({ lng: c[0], lat: c[1] }) : null;
      return p ? [p] : [];
    }) : [];
  const path = track.length > 1 ? track : valid;
  const points = [...path, ...valid];
  if (!points.length) return <p role="status">Esta ruta no incluye coordenadas para mostrar el mapa.</p>;
  const projected = points.map(project);
  const minX = Math.min(...projected.map((p) => p.x)), maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y)), maxY = Math.max(...projected.map((p) => p.y));
  const fit = Math.min(16, Math.max(1, Math.floor(Math.log2(Math.min(680 / Math.max(maxX - minX, 0.001), 260 / Math.max(maxY - minY, 0.001))))));
  const zoom = Math.max(1, Math.min(18, fit + zoomDelta)), scale = 2 ** zoom;
  const left = (minX + maxX) / 2 * scale - 400, top = (minY + maxY) / 2 * scale - 180;
  const screen = (p: Point) => { const xy = project(p); return { x: xy.x * scale - left, y: xy.y * scale - top }; };
  const tiles = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + 800) / 256); x++) {
    for (let y = Math.floor(top / 256); y <= Math.floor((top + 360) / 256); y++) {
      if (y < 0 || y >= scale) continue;
      const tileX = ((x % scale) + scale) % scale;
      tiles.push(<image key={`${zoom}/${x}/${y}`} href={`https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`} x={x * 256 - left} y={y * 256 - top} width="256" height="256" />);
    }
  }
  return <>
    <div className="route-map-tools">
      <span>{textValue(data.estado)} · {textValue(data.distancia_total_km)} km</span>
      <div className="card-actions">
        <button className="button secondary" aria-label="Alejar mapa" disabled={zoom <= 1} onClick={() => setZoomDelta(zoom - 1 - fit)}>−</button>
        <button className="button secondary" aria-label="Acercar mapa" disabled={zoom >= 18} onClick={() => setZoomDelta(zoom + 1 - fit)}>+</button>
        <button className="button secondary" onClick={() => setZoomDelta(0)}>Centrar ruta</button>
      </div>
    </div>
    <div className="route-map-canvas">
      <svg viewBox="0 0 800 360" role="img" aria-label={`Mapa de la ruta ${textValue(data.codigo ?? id)}`}>
        {tiles}
        <polyline points={path.map((p) => { const xy = screen(p); return `${xy.x},${xy.y}`; }).join(" ")} fill="none" stroke="white" strokeWidth="8" />
        <polyline points={path.map((p) => { const xy = screen(p); return `${xy.x},${xy.y}`; }).join(" ")} fill="none" stroke="#16785c" strokeWidth="4" strokeDasharray={track.length > 1 ? undefined : "8 6"} />
        {markers.map(({ stop, point: p }, index) => {
          if (!p) return null;
          const xy = screen(p);
          return <g key={String(stop.id ?? index)}><title>{index + 1}. {p.label} · {textValue(stop.estado)}</title><circle cx={xy.x} cy={xy.y} r="15" fill="#16785c" stroke="white" strokeWidth="3" /><text x={xy.x} y={xy.y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{index + 1}</text></g>;
        })}
      </svg>
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
    <p className="muted">{track.length > 1 ? "Trazado entregado por la API." : "Paradas conectadas en orden. La API no incluye el trazado GPS del recorrido."}</p>
    {markers.some((m) => !m.point) && <p role="status">Algunas paradas no tienen coordenadas y no aparecen en el mapa.</p>}
    <ol className="route-stop-list">{markers.map(({ stop }, i) => <li key={String(stop.id ?? i)}><strong>{textValue(stop.direccion)}</strong><span>{textValue(stop.tipo)} · {textValue(stop.estado)}</span></li>)}</ol>
  </>;
}
