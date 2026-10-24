import { useState } from "react";
import { RouteTracking } from "./RouteTracking";
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
  const read = useRead<Row>(`/rutas/${encodeURIComponent(id)}`, 15000);
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
  return <>
    <p>{textValue(data.estado)} · {textValue(data.distancia_total_km)} km</p>
    <RouteTracking key={id + String(data.estado)} id={id} active={data.estado === "EN_CURSO"} path={path} markers={markers.flatMap((m, index) => m.point ? [{ ...m.point, order: index + 1 }] : [])} label={`Mapa de la ruta ${textValue(data.codigo ?? id)}`} />
    <p className="muted">{track.length > 1 ? "Trazado entregado por la API." : "Paradas conectadas en orden. La API no incluye el trazado GPS del recorrido."}</p>
    {markers.some((m) => !m.point) && <p role="status">Algunas paradas no tienen coordenadas y no aparecen en el mapa.</p>}
    <ol className="route-stop-list">{markers.map(({ stop }, i) => <li key={String(stop.id ?? i)}><strong>{textValue(stop.direccion)}</strong><span>{textValue(stop.tipo)} · {textValue(stop.estado)}</span></li>)}</ol>
  </>;
}


