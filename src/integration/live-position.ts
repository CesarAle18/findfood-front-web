import { useEffect, useRef, useState } from "react";
import type { Point } from "./contracts";
import { apiRequest } from "./http";
import { supabase } from "./supabase";

// Evento `posicion` del canal privado `ruta:<id>` de Supabase Realtime (arquitectura §9.2).
// Solo lo emite el voluntario de la ruta; las políticas de realtime.messages dejan escuchar al
// personal activo. Las posiciones no se guardan en la base de datos.
export const LIVE_EVENT = "posicion";
export interface LivePosition extends Point {
  rumbo: number | null;
  velocidad_kmh: number | null;
  precision_m: number | null;
  at: string;
}
export type LiveStatus = "conectando" | "conectado" | "sin-permiso" | "error";

const finite = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export function parsePosition(payload: unknown): LivePosition | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  const lat = finite(p.lat), lng = finite(p.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat, lng,
    rumbo: finite(p.rumbo),
    velocidad_kmh: finite(p.velocidad_kmh),
    precision_m: finite(p.precision_m),
    at: typeof p.at === "string" ? p.at : new Date().toISOString(),
  };
}

// Escucha la posición en vivo de una ruta mientras `rutaId` no sea null.
export function useLivePosition(rutaId: string | null) {
  const [state, setState] = useState<{ rutaId: string; status: LiveStatus; position: LivePosition | null } | null>(null);
  useEffect(() => {
    if (!rutaId || !supabase) return;
    const client = supabase;
    const update = (patch: Partial<{ status: LiveStatus; position: LivePosition | null }>) =>
      setState((s) => ({ rutaId, status: "conectando", position: null, ...(s?.rutaId === rutaId ? s : {}), ...patch }));
    const channel = client
      .channel(`ruta:${rutaId}`, { config: { private: true } })
      .on("broadcast", { event: LIVE_EVENT }, ({ payload }) => {
        const position = parsePosition(payload);
        if (position) update({ position });
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") update({ status: "conectado" });
        else if (status === "CHANNEL_ERROR")
          update({ status: /unauthori[sz]ed|permission|denied/i.test(err?.message ?? "") ? "sin-permiso" : "error" });
        else if (status === "TIMED_OUT") update({ status: "error" });
      });
    return () => { void client.removeChannel(channel); };
  }, [rutaId]);
  const current = rutaId && state?.rutaId === rutaId ? state : null;
  return {
    status: rutaId ? current?.status ?? "conectando" : null,
    position: current?.position ?? null,
  };
}

// Desliza el marcador entre posiciones (llegan cada pocos segundos) en lugar de saltar.
export function useGlide(target: Point | null, ms = 1000): Point | null {
  const [shown, setShown] = useState<Point | null>(target);
  const from = useRef<Point | null>(target);
  const lat = target?.lat, lng = target?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const start = from.current ?? { lat, lng };
    const t0 = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const p = { lat: start.lat + (lat - start.lat) * k, lng: start.lng + (lng - start.lng) * k };
      from.current = p;
      setShown(p);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lat, lng, ms]);
  return target ? shown ?? target : null;
}

// GET /rutas/:id/seguimiento: camino y llegada estimada a la siguiente parada (Google o estimado).
export interface Seguimiento {
  parada: { id: string; orden: number; tipo: string; direccion: string; lat: number; lng: number } | null;
  origen: (Point & { fuente: "CONSULTA" | "ULTIMA_UBICACION" }) | null;
  tramo: {
    trayecto: { type: "LineString"; coordinates: [number, number][] };
    distancia_km: number;
    duracion_min: number;
    llegada_estimada: string;
    proveedor: "GOOGLE" | "ESTIMADO";
  } | null;
}
const SEGUIMIENTO_MS = 30_000;

// Consulta el seguimiento cada 30 s con la última posición en vivo (la API recalcula con Google
// como máximo cada 2 min por ruta). También al llegar la primera posición.
export function useSeguimiento(rutaId: string | null, live: LivePosition | null) {
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);
  const hasLive = live !== null;
  const [state, setState] = useState<{ rutaId: string; data: Seguimiento } | null>(null);
  useEffect(() => {
    if (!rutaId) return;
    const controller = new AbortController();
    const load = () => {
      const p = liveRef.current;
      const query = p ? `?${new URLSearchParams({ lat: String(p.lat), lng: String(p.lng) })}` : "";
      apiRequest<Seguimiento>(`/rutas/${encodeURIComponent(rutaId)}/seguimiento${query}`, { signal: controller.signal })
        .then((data) => setState({ rutaId, data }))
        // Complementario: si falla, el mapa y la posición en vivo siguen funcionando.
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, SEGUIMIENTO_MS);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [rutaId, hasLive]);
  return rutaId && state?.rutaId === rutaId ? state.data : null;
}
