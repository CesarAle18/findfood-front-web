import { useEffect, useId, useRef, useState } from "react";
import { AdvancedMarker, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { Field } from "../components/ui";
import type { Input } from "./actions";
import { integrationConfig, mapsEnabled } from "./config";
import type { GeoSuggestion, Point } from "./contracts";
import { ApiError, errorMessage } from "./http";
import { MapsProvider } from "./maps";
import { GEO_UNAVAILABLE, geoService } from "./services";

const DELAY_MS = 300;
// Seis decimales (≈ 10 cm): coincide con el step de los campos de latitud y longitud.
const fixed = (p: Point): Point => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });

// Dirección con sugerencias de Google (vía la API). Elegir una llena la dirección y las coordenadas;
// el pin del mini-mapa ajusta el punto, que es el que se guarda y el que usan los filtros de cercanía.
export function PlaceField({ field, value, point, disabled, change, onPlace, onPoint }: {
  field: Input;
  value: string;
  point: Point | null;
  disabled: boolean;
  change: (v: string) => void;
  onPlace: (direccion: string, p: Point) => void;
  onPoint: (p: Point) => void;
}) {
  const listId = useId();
  const session = useRef<string | null>(null);
  const [found, setFound] = useState<{ query: string; items: GeoSuggestion[] }>({ query: "", items: [] });
  const [chosen, setChosen] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const query = value.trim();
  useEffect(() => {
    if (!available || disabled || query.length < 3 || query === chosen) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      session.current ??= crypto.randomUUID();
      geoService.suggest(query, session.current, controller.signal)
        .then((r) => setFound({ query, items: r.sugerencias.slice(0, 5) }))
        .catch((err) => {
          if (controller.signal.aborted) return;
          if (err instanceof ApiError && err.type === GEO_UNAVAILABLE) setAvailable(false);
        });
    }, DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [available, disabled, query, chosen]);
  const suggestions = available && found.query === query && query !== chosen ? found.items : [];
  async function choose(s: GeoSuggestion) {
    setError("");
    // Elegir cierra la sesión de cobro de Google; la siguiente búsqueda abre otra.
    const sesion = session.current ?? crypto.randomUUID();
    session.current = null;
    try {
      const place = await geoService.place(s.place_id, sesion);
      setChosen(place.direccion.trim());
      onPlace(place.direccion, fixed(place.ubicacion));
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return <div className="form-stack place-field">
    <Field label={field.label} required={field.required} minLength={field.min} maxLength={field.maxLength} disabled={disabled} value={value}
      autoComplete="off" aria-autocomplete="list" aria-controls={listId} aria-expanded={suggestions.length > 0}
      onChange={(e) => change(e.target.value)} />
    {suggestions.length > 0 && <ul id={listId} className="place-suggestions" aria-label="Sugerencias de dirección">
      {suggestions.map((s) => <li key={s.place_id}><button type="button" disabled={disabled} onClick={() => void choose(s)}>
        <strong>{s.principal}</strong>{s.secundario && <span>{s.secundario}</span>}
      </button></li>)}
    </ul>}
    {!available && <p className="muted" role="status">La búsqueda de direcciones no está disponible: escribe la dirección y las coordenadas.</p>}
    {error && <p className="integration-error" role="alert">{error}</p>}
    {mapsEnabled() && point && <MapsProvider><PinMap point={point} disabled={disabled} onPoint={onPoint} /></MapsProvider>}
  </div>;
}

const PLACE_MAP = "place-map";
function PinMap({ point, disabled, onPoint }: { point: Point; disabled: boolean; onPoint: (p: Point) => void }) {
  const map = useMap(PLACE_MAP);
  const { lat, lng } = point;
  // Sigue al punto (sugerencia elegida o coordenadas escritas) sin impedir mover el mapa.
  useEffect(() => { map?.panTo({ lat, lng }); }, [map, lat, lng]);
  const drop = (e: google.maps.MapMouseEvent) => { if (e.latLng) onPoint(fixed(e.latLng.toJSON())); };
  return <div className="place-map" role="region" aria-label="Mapa para ajustar el punto del almacén">
    <Map id={PLACE_MAP} defaultCenter={point} defaultZoom={17} mapId={integrationConfig.mapId || undefined} gestureHandling="cooperative" streetViewControl={false} mapTypeControl={false}>
      {integrationConfig.mapId
        ? <AdvancedMarker position={point} draggable={!disabled} onDragEnd={drop} title="Punto del almacén" />
        : <Marker position={point} draggable={!disabled} onDragEnd={drop} title="Punto del almacén" />}
    </Map>
    <p className="muted">Arrastra el pin hasta la entrada del almacén.</p>
  </div>;
}
