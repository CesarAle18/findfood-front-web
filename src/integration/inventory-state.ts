import type { Row } from "./actions";

export function expiry(row: Row): number {
  if (!row.fecha_vencimiento) return Infinity;
  const value = String(row.fecha_vencimiento);
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}(T00:00:00(?:\.000)?Z)?$/.test(value) ? `${value.slice(0, 10)}T23:59:59.999-05:00` : value);
  return Number.isFinite(time) ? time : Infinity;
}

export function inventoryState(row: Row, now = Date.now()): string {
  if (["DESCARTADO", "AGOTADO", "VENCIDO"].includes(String(row.estado))) return String(row.estado);
  if (expiry(row) < now) return "VENCIDO";
  if (Number(row.cantidad_disponible ?? row.peso_disponible_kg) <= 0) return "AGOTADO";
  return String(row.estado || "DISPONIBLE");
}

export function available(row: Row, now = Date.now()): boolean {
  return Number(row.cantidad_disponible ?? row.peso_disponible_kg) > 0 && inventoryState(row, now) === "DISPONIBLE";
}
