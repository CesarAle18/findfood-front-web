import type { ReactNode } from "react";
import { AdvancedMarker, APIProvider, Marker } from "@vis.gl/react-google-maps";
import { integrationConfig } from "./config";
import type { Point } from "./contracts";

// Maps JavaScript API con la llave del panel (restringida por referrer), en español y región CO.
export function MapsProvider({ children }: { children: ReactNode }) {
  return <APIProvider apiKey={integrationConfig.mapsKey} language="es" region="CO">{children}</APIProvider>;
}

// Con Map ID usa marcadores avanzados (HTML propio); sin él, el marcador clásico con etiqueta.
export function NumberedMarker({ position, label, title }: { position: Point; label: string; title: string }) {
  return integrationConfig.mapId
    ? <AdvancedMarker position={position} title={title}><span className="map-pin">{label}</span></AdvancedMarker>
    : <Marker position={position} title={title} label={{ text: label, color: "white", fontWeight: "bold" }} />;
}

// Vehículo del voluntario en vivo: flecha girada según el rumbo, o un punto si no hay rumbo.
export function VehicleMarker({ position, rumbo, title }: { position: Point; rumbo: number | null; title: string }) {
  return integrationConfig.mapId
    ? <AdvancedMarker position={position} title={title} zIndex={10} anchorLeft="-50%" anchorTop="-50%">
      <span className="map-vehicle" style={rumbo === null ? undefined : { transform: `rotate(${rumbo}deg)` }}>{rumbo === null ? "" : "▲"}</span>
    </AdvancedMarker>
    : <Marker position={position} title={title} zIndex={10} icon={{
      path: rumbo === null ? google.maps.SymbolPath.CIRCLE : google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: rumbo === null ? 8 : 6, rotation: rumbo ?? 0,
      fillColor: "#1f5fbf", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
    }} />;
}
