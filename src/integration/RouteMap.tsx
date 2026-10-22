import { useState } from "react";
import { Map, Polyline, useMap } from "@vis.gl/react-google-maps";
import { Card } from "../components/ui";
import { useRead } from "./read";
import type { Row } from "./actions";
import { textValue } from "./read-format";
import { integrationConfig, mapsEnabled } from "./config";
import { MapsProvider, NumberedMarker, VehicleMarker } from "./maps";
import { type LivePosition, type LiveStatus, type Seguimiento, useGlide, useLivePosition, useSeguimiento } from "./live-position";

type Point = { lat: number; lng: number; label: string };
type Stop = { stop: Row; point: Point | null };
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
  // Posición en vivo del voluntario, solo con el mapa de Google y mientras la ruta está en curso.
  const enVivo = read.data?.estado === "EN_CURSO" && mapsEnabled();
  const live = useLivePosition(enVivo ? id : null);
  const seguimiento = useSeguimiento(enVivo ? id : null, live.position);
  if (read.loading) return <p role="status">Cargando mapa de la ruta…</p>;
  if (read.error) return <div><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar mapa</button></div>;
  const data = read.data ?? {};
  const stops = (Array.isArray(data.paradas) ? [...data.paradas] as Row[] : [])
    .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));
  const markers: Stop[] = stops.map((stop) => ({ stop, point: point(stop) }));
  const valid = markers.flatMap((m) => m.point ? [m.point] : []);
  const geometry = (data.geometria ?? data.geometry) as { type?: string; coordinates?: unknown[] } | undefined;
  const track = geometry?.type === "LineString" && Array.isArray(geometry.coordinates)
    ? geometry.coordinates.flatMap((c) => {
      const p = Array.isArray(c) ? point({ lng: c[0], lat: c[1] }) : null;
      return p ? [p] : [];
    }) : [];
  const path = track.length > 1 ? track : valid;
  if (![...path, ...valid].length) return <p role="status">Esta ruta no incluye coordenadas para mostrar el mapa.</p>;
  const view = { label: `Mapa de la ruta ${textValue(data.codigo ?? id)}`, summary: `${textValue(data.estado)} · ${textValue(data.distancia_total_km)} km`, path, valid, markers, dashed: track.length < 2 };
  return <>
    {mapsEnabled() ? <MapsProvider><GoogleRouteMap {...view} live={live.position} seguimiento={seguimiento} /></MapsProvider> : <OsmRouteMap {...view} />}
    {live.status && <p className={live.status === "conectado" ? "live-status" : "muted"} role="status">{liveText(live.status, live.position)}</p>}
    {seguimiento?.parada && <p className="next-stop">{nextStopText(seguimiento)}</p>}
    <p className="muted">{track.length < 2 ? "Paradas conectadas en orden. La API no incluye el trazado GPS del recorrido." : data.proveedor_ruteo === "GOOGLE" ? "Trazado por calles calculado con Google." : "Trazado entregado por la API."}</p>
    {markers.some((m) => !m.point) && <p role="status">Algunas paradas no tienen coordenadas y no aparecen en el mapa.</p>}
    <ol className="route-stop-list">{markers.map(({ stop }, i) => <li key={String(stop.id ?? i)}><strong>{textValue(stop.direccion)}</strong><span>{textValue(stop.tipo)} · {textValue(stop.estado)}</span></li>)}</ol>
  </>;
}

type RouteView = { label: string; summary: string; path: Point[]; valid: Point[]; markers: Stop[]; dashed: boolean };

function liveText(status: LiveStatus, position: LivePosition | null) {
  if (status === "sin-permiso") return "Tu cuenta no tiene permiso para ver la ubicación en vivo de esta ruta.";
  if (status === "error") return "No se pudo conectar con la ubicación en vivo. Recarga la página para reintentar.";
  if (status === "conectando") return "Conectando con la ubicación en vivo…";
  if (!position) return "En vivo: esperando la posición del voluntario.";
  const hora = new Date(position.at).toLocaleTimeString("es-CO", { timeZone: "America/Bogota" });
  const velocidad = position.velocidad_kmh === null ? "" : ` · ${Math.round(position.velocidad_kmh)} km/h`;
  return `En vivo · última posición ${hora}${velocidad}`;
}
function nextStopText({ parada, tramo }: Seguimiento) {
  const destino = `Próxima parada ${parada!.orden}: ${parada!.direccion}`;
  if (!tramo) return `${destino}. Sin posición reciente del voluntario para estimar la llegada.`;
  const hora = new Date(tramo.llegada_estimada).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
  const km = tramo.distancia_km.toFixed(1).replace(".", ",");
  return `${destino} · llega ~${hora} (${tramo.duracion_min} min, ${km} km)${tramo.proveedor === "ESTIMADO" ? " · estimado sin tráfico" : ""}`;
}
const ROUTE_MAP = "route-map";
// Línea punteada cuando la API no trae trazado: solo une las paradas en orden.
const DASHES: google.maps.IconSequence[] = [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }];

function bounds(points: { lat: number; lng: number }[]): google.maps.LatLngBoundsLiteral {
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  return { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) };
}

function GoogleRouteMap({ label, summary, path, valid, markers, dashed, live, seguimiento }: RouteView & { live: LivePosition | null; seguimiento: Seguimiento | null }) {
  const map = useMap(ROUTE_MAP);
  const vehicle = useGlide(live);
  // Camino del vehículo a la siguiente parada (como en las apps de transporte), sobre la ruta planificada.
  const tramo = seguimiento?.tramo?.trayecto.coordinates.map(([lng, lat]) => ({ lat, lng })) ?? [];
  const box = bounds([...path, ...valid, ...(live ? [live] : [])]);
  return <>
    <div className="route-map-tools">
      <span>{summary}</span>
      <div className="card-actions"><button className="button secondary" disabled={!map} onClick={() => map?.fitBounds(box, 40)}>Centrar ruta</button></div>
    </div>
    <div className="route-map-canvas google-map" role="region" aria-label={label}>
      <Map id={ROUTE_MAP} mapId={integrationConfig.mapId || undefined} defaultBounds={{ ...box, padding: 40 }} gestureHandling="cooperative" streetViewControl={false} mapTypeControl={false}>
        <Polyline path={path} strokeColor="#16785c" strokeWeight={4} strokeOpacity={dashed ? 0 : 1} icons={dashed ? DASHES : undefined} />
        {tramo.length > 1 && <Polyline path={tramo} strokeColor="#1f5fbf" strokeWeight={6} strokeOpacity={0.85} zIndex={5} />}
        {markers.map(({ stop, point: p }, index) => p && <NumberedMarker key={String(stop.id ?? index)} position={p} label={String(index + 1)} title={`${index + 1}. ${p.label} · ${textValue(stop.estado)}`} />)}
        {vehicle && live && <VehicleMarker position={vehicle} rumbo={live.rumbo} title="Voluntario (en vivo)" />}
      </Map>
    </div>
  </>;
}

// Respaldo sin llave de Google: teselas de OpenStreetMap con la proyección propia.
function OsmRouteMap({ label, summary, path, valid, markers, dashed }: RouteView) {
  const [zoomDelta, setZoomDelta] = useState(0);
  const projected = [...path, ...valid].map(project);
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
      <span>{summary}</span>
      <div className="card-actions">
        <button className="button secondary" aria-label="Alejar mapa" disabled={zoom <= 1} onClick={() => setZoomDelta(zoom - 1 - fit)}>−</button>
        <button className="button secondary" aria-label="Acercar mapa" disabled={zoom >= 18} onClick={() => setZoomDelta(zoom + 1 - fit)}>+</button>
        <button className="button secondary" onClick={() => setZoomDelta(0)}>Centrar ruta</button>
      </div>
    </div>
    <div className="route-map-canvas">
      <svg viewBox="0 0 800 360" role="img" aria-label={label}>
        {tiles}
        <polyline points={path.map((p) => { const xy = screen(p); return `${xy.x},${xy.y}`; }).join(" ")} fill="none" stroke="white" strokeWidth="8" />
        <polyline points={path.map((p) => { const xy = screen(p); return `${xy.x},${xy.y}`; }).join(" ")} fill="none" stroke="#16785c" strokeWidth="4" strokeDasharray={dashed ? "8 6" : undefined} />
        {markers.map(({ stop, point: p }, index) => {
          if (!p) return null;
          const xy = screen(p);
          return <g key={String(stop.id ?? index)}><title>{index + 1}. {p.label} · {textValue(stop.estado)}</title><circle cx={xy.x} cy={xy.y} r="15" fill="#16785c" stroke="white" strokeWidth="3" /><text x={xy.x} y={xy.y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{index + 1}</text></g>;
        })}
      </svg>
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
  </>;
}
