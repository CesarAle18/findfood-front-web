import { ApiError, apiRequest } from "./http";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session-context";
import { useRead } from "./read";
import { GoogleRouteMap } from "./GoogleRouteMap";
import { textValue } from "./read-format";
type Position = { lat: number; lng: number };
type Marker = Position & { label: string; order: number };
type Tracking = { unavailable?: boolean; parada: { direccion: string } | null; origen: Position | null; tramo: { trayecto: { coordinates: number[][] }; llegada_estimada: string; distancia_km: number; duracion_min: number; proveedor: string } | null };
const unavailableRoutes = new Set<string>();
async function loadTracking(endpoint: string, signal: AbortSignal): Promise<Tracking> {
  const key = endpoint.split("?")[0];
  const unavailable: Tracking = { unavailable: true, parada: null, origen: null, tramo: null };
  if (unavailableRoutes.has(key)) return unavailable;
  try {
    return await apiRequest<Tracking>(endpoint, { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      unavailableRoutes.add(key);
      return unavailable;
    }
    throw error;
  }
}
function position(value: unknown): Position | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.lat !== "number" || typeof row.lng !== "number") return null;
  return Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 && Number.isFinite(row.lng) && Math.abs(row.lng) <= 180 ? { lat: row.lat, lng: row.lng } : null;
}
export function RouteTracking({ id, active, path, markers, label }: { id: string; active: boolean; path: Position[]; markers: Marker[]; label: string }) {
  const token = useSession()?.session?.access_token;
  const sample = useRef<(Position & { received: number }) | null>(null);
  const [live, setLive] = useState<Position | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!active || !token || !supabase) return;
    const client = supabase;
    let disposed = false;
    const channel = client.channel(`ruta:${id}`, { config: { private: true } });
    void client.realtime.setAuth(token).then(() => {
      if (disposed) return;
      channel.on("broadcast", { event: "*" }, ({ payload }) => {
        const p = position(payload) ?? position(payload?.ubicacion);
        if (p) sample.current = { ...p, received: Date.now() };
      }).subscribe((state) => { if (!disposed) setStatus(state); });
    }).catch(() => { if (!disposed) setStatus("CHANNEL_ERROR"); });
    const timer = window.setInterval(() => {
      const p = sample.current;
      setLive(p && Date.now() - p.received < 60000 ? { lat: p.lat, lng: p.lng } : null);
    }, 5000);
    return () => { disposed = true; sample.current = null; window.clearInterval(timer); void client.removeChannel(channel); };
  }, [active, id, token]);
  const query = live ? `?${new URLSearchParams({ lat: String(live.lat), lng: String(live.lng) })}` : "";
  const read = useRead<Tracking>(active ? `/rutas/${encodeURIComponent(id)}/seguimiento${query}` : null, 15000, loadTracking);
  const tracking = read.data;
  const track = tracking?.tramo?.trayecto.coordinates.flatMap((c) => { const p = position({ lat: c[1], lng: c[0] }); return p ? [p] : []; }) ?? [];
  const origin = active ? live ?? tracking?.origen : null;
  return <>{active && <div className="route-tracking-status">
    {tracking?.unavailable ? null : read.error ? <p role="alert">{read.error} <button className="table-action" onClick={read.refresh}>Reintentar seguimiento</button></p> : tracking?.tramo ? <p>Próxima parada: <strong>{tracking.parada?.direccion}</strong> · Llegada estimada: {textValue(tracking.tramo.llegada_estimada)} · {textValue(tracking.tramo.distancia_km)} km {tracking.tramo.proveedor === "ESTIMADO" ? "(trayecto aproximado)" : ""}</p> : <p role="status">{read.loading ? "Consultando seguimiento…" : "Esperando una ubicación reciente del vehículo."}</p>}
    <p className="muted">{live && status === "SUBSCRIBED" ? "Posición recibida en vivo." : origin ? "Última ubicación reciente disponible." : "Sin posición en vivo. El mapa muestra el trazado de la ruta."}</p>
  </div>}<GoogleRouteMap path={active && track.length > 1 ? track : path} markers={origin ? [...markers, { ...origin, label: "Vehículo", order: 0 }] : markers} label={label} /></>;
}


