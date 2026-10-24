import { integrationConfig } from "./config";
import { useEffect, useRef, useState } from "react";

type Position = { lat: number; lng: number };
type MapInstance = { fitBounds(bounds: Bounds, padding: number): void; getZoom(): number | undefined; setZoom(zoom: number): void };
type Bounds = { extend(point: Position): void };
type MapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  LatLngBounds: new () => Bounds;
  Polyline: new (options: Record<string, unknown>) => { setMap(map: null): void };
  marker: { AdvancedMarkerElement: new (options: Record<string, unknown>) => { map: MapInstance | null } };
};
type MapsWindow = Window & { google?: { maps: MapsApi }; findfoodMapsReady?: () => void };
let loading: Promise<MapsApi> | undefined;
function loadMaps(): Promise<MapsApi> {
  const host = window as MapsWindow;
  if (host.google?.maps.marker) return Promise.resolve(host.google.maps);
  if (loading) return loading;
  const key = integrationConfig.mapsKey;
  if (!key) return Promise.reject(new Error("Configura VITE_GOOGLE_MAPS_API_KEY en .env.local y reinicia el servidor."));
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 20000);
    const fail = () => {
      window.clearTimeout(timeout);
      delete host.findfoodMapsReady;
      script.remove();
      loading = undefined;
      reject(new Error("No se pudo cargar Google Maps. Revisa la conexión, la clave y que Maps JavaScript API esté habilitada."));
    };
    host.findfoodMapsReady = () => {
      window.clearTimeout(timeout);
      delete host.findfoodMapsReady;
      if (host.google?.maps) resolve(host.google.maps);
      else fail();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: "async", callback: "findfoodMapsReady", libraries: "marker", v: "weekly", language: "es", region: "CO" })}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

export function GoogleRouteMap({ path, markers, label }: { path: Position[]; markers: (Position & { label: string; order: number })[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const centerRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scene = JSON.stringify({ path, markers });
  useEffect(() => {
    const { path, markers } = JSON.parse(scene) as { path: Position[]; markers: (Position & { label: string; order: number })[] };
    let disposed = false;
    const cleanup: (() => void)[] = [];
    loadMaps().then((maps) => {
      if (disposed || !container.current) return;
      const firstRender = !mapRef.current;
      const map = mapRef.current ?? new maps.Map(container.current, {
        center: path[0] ?? markers[0], zoom: 12,
        mapId: integrationConfig.mapsId || "DEMO_MAP_ID",
        streetViewControl: false, mapTypeControl: false,
      });
      mapRef.current = map;
      const bounds = new maps.LatLngBounds();
      [...path, ...markers].forEach((p) => bounds.extend(p));
      const center = () => {
        map.fitBounds(bounds, 60);
        if (path.length + markers.length === 1) map.setZoom(15);
      };
      centerRef.current = center;
      if (firstRender) center();
      const line = new maps.Polyline({ map, path, strokeColor: "#16785c", strokeWeight: 5, strokeOpacity: 1 });
      cleanup.push(() => line.setMap(null));
      markers.forEach((p) => {
        const content = document.createElement("div");
        content.className = "google-route-marker";
        content.textContent = p.order === 0 ? "●" : String(p.order);
        const marker = new maps.marker.AdvancedMarkerElement({ map, position: p, title: `${p.order}. ${p.label}`, content });
        cleanup.push(() => { marker.map = null; });
      });
      setReady(true);
    }).catch((reason: unknown) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : "No se pudo cargar Google Maps.");
    });
    return () => {
      disposed = true;
      cleanup.forEach((fn) => fn());
      centerRef.current = null;
    };
  }, [scene, attempt]);
  useEffect(() => () => { mapRef.current = null; }, []);
  return <>
    <div className="route-map-tools"><div className="card-actions">
      <button className="button secondary" aria-label="Alejar mapa" disabled={!ready} onClick={() => { const map = mapRef.current; if (map) map.setZoom(Math.max(1, (map.getZoom() ?? 12) - 1)); }}>−</button>
      <button className="button secondary" aria-label="Acercar mapa" disabled={!ready} onClick={() => { const map = mapRef.current; if (map) map.setZoom(Math.min(22, (map.getZoom() ?? 12) + 1)); }}>+</button>
      <button className="button secondary" disabled={!ready} onClick={() => centerRef.current?.()}>Centrar ruta</button>
    </div></div>
    {error && <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => { setError(""); setReady(false); setAttempt((n) => n + 1); }}>Reintentar mapa</button></div>}
    {!ready && !error && <p role="status">Cargando Google Maps…</p>}
    <div ref={container} className="route-map-canvas google-route-map" aria-label={label} />
  </>;
}



