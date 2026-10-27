import { useSyncExternalStore } from "react";
export type AuditEntry = { id: string; fecha: string; actor: string; modulo: string; accion: string; entidad: string; metodo: string; detalles?: Record<string, string> };
const event = "findfood:audit";
const memory = new Map<string, string>();
const key = (user: string) => `findfood:audit:${user}`;
function snapshot(user: string) {
  try { return memory.get(user) ?? localStorage.getItem(key(user)) ?? "[]"; }
  catch { return memory.get(user) ?? "[]"; }
}
export function parseAudit(raw: string): AuditEntry[] {
  try { const rows: unknown = JSON.parse(raw); return Array.isArray(rows) ? rows.filter((r): r is AuditEntry => r && ["id", "fecha", "actor", "modulo", "accion", "entidad", "metodo"].every((k) => typeof r[k] === "string")) : []; }
  catch { return []; }
}
const modules: Record<string, string> = { admin: "Usuarios", me: "Perfil", inventario: "Inventario", donaciones: "Donaciones", rutas: "Rutas", recepciones: "Recepción", distribuciones: "Distribuciones", incidencias: "Incidencias", alertas: "Inventario", almacenes: "Almacenes", configuracion: "Configuración", asignaciones: "Asignaciones", evidencias: "Evidencias" };
export function recordAudit(user: string, actor: string, path: string, method: string, body?: BodyInit | null, result?: unknown) {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  if (parts.includes("notificaciones")) return;
  const last = parts.at(-1) ?? "";
  const verbs: Record<string, string> = { aprobar: "Aprobó", rechazar: "Rechazó", cancelar: "Canceló", confirmar: "Confirmó", iniciar: "Inició", finalizar: "Finalizó", completar: "Completó", ajustar: "Ajustó inventario", reasignar: "Reasignó", activar: "Activó", desactivar: "Desactivó", resolver: "Resolvió", atender: "Atendió" };
  const entry: AuditEntry = { id: crypto.randomUUID(), fecha: new Date().toISOString(), actor, modulo: modules[parts[0]] ?? "Operación", accion: verbs[last] ?? ({ POST: "Creó / ejecutó acción", PATCH: "Editó", PUT: "Actualizó", DELETE: "Eliminó" }[method] ?? method), entidad: path.split("?")[0], metodo: method };
  let request: Record<string, unknown> = {};
  try { if (typeof body === "string") request = JSON.parse(body) ?? {}; } catch { /* Non-JSON requests have no structured details. */ }
  const response = result && typeof result === "object" ? result as Record<string, unknown> : {};
  entry.detalles = Object.fromEntries(["id", "codigo", "donacion_id", "estado", "motivo_id"].flatMap((field) => {
    const value = response[field] ?? request[field];
    return typeof value === "string" || typeof value === "number" ? [[field, String(value)]] : [];
  }));
  if (parts[0] === "recepciones" && method === "POST") entry.accion = "Registró recepción";
  const raw = JSON.stringify([entry, ...parseAudit(snapshot(user))].slice(0, 2000));
  try { localStorage.setItem(key(user), raw); memory.delete(user); }
  catch { memory.set(user, raw); }
  window.dispatchEvent(new Event(event));
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback); window.addEventListener("storage", callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); };
}
export function useAudit(user: string) {
  return parseAudit(useSyncExternalStore(subscribe, () => snapshot(user)));
}
