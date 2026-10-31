import type { Row } from "./actions";
import { nonEmptyDetails } from "./donation-display";

export function advisorDetails(value: unknown, collection = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => advisorDetails(item, collection));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Row).filter(([key]) =>
    key !== "id" && !key.endsWith("_id") && !["lat", "lng", "lon", "latitud", "longitud", "metadata", "ruta", "ubicacion", "ubicacion_base", "geometria", "geometry", "score_urgencia", "proveedor_ruteo", "confirmacion_manual", "flota_banco"].includes(key) &&
    !(collection === "tipo_alimento" && key === "codigo"));
  return nonEmptyDetails(Object.fromEntries(entries.flatMap(([key, item]) => {
    if (["created_by", "creado_por"].includes(key)) {
      if (!item || typeof item !== "object") return [];
      const user = item as Row;
      const name = [user.nombres, user.apellidos].filter(Boolean).join(" ") || user.nombre;
      return name ? [["registrado_por", name]] : [];
    }
    return [[key, advisorDetails(item, key)]];
  })));
}
