import type { Row } from "./actions";

export function notificationTarget(row: Row): string | null {
  const data = row.data && typeof row.data === "object" ? row.data as Row : {};
  const type = `${row.tipo ?? ""} ${row.titulo ?? ""}`.toLocaleLowerCase("es");
  if (/venc|inventario|lote/.test(type)) return "#/alertas";
  if (row.donacion_id ?? data.donacion_id) return `#/donaciones?id=${encodeURIComponent(String(row.donacion_id ?? data.donacion_id))}`;
  if (data.ruta_id) return `#/rutas?id=${encodeURIComponent(String(data.ruta_id))}`;
  if (/ruta/.test(type)) return "#/rutas";
  if (/donaci/.test(type)) return "#/donaciones";
  return null;
}
