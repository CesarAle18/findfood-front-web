import type { AuditEntry } from "./audit";

const actions: Record<string, string> = {
  "Creó / ejecutó acción": "Crear", "Editó": "Editar", "Actualizó": "Actualizar", "Eliminó": "Eliminar",
  "Aprobó": "Aprobar", "Rechazó": "Rechazar", "Canceló": "Cancelar", "Confirmó": "Confirmar", "Inició": "Iniciar", "Finalizó": "Finalizar", "Completó": "Completar", "Ajustó inventario": "Ajustar inventario", "Reasignó": "Reasignar", "Activó": "Activar", "Desactivó": "Desactivar", "Resolvió": "Resolver", "Atendió": "Atender", "Registró recepción": "Registrar recepción",
  CREAR: "Crear", INSERT: "Crear", CREATE: "Crear", ACTUALIZAR: "Actualizar", UPDATE: "Actualizar", ELIMINAR: "Eliminar", DELETE: "Eliminar", CAMBIO_ESTADO: "Cambiar estado", AJUSTE: "Ajustar inventario", MERMA: "Registrar merma", VENCIMIENTO: "Registrar vencimiento", ENTRADA: "Registrar entrada", SALIDA: "Registrar salida", DEVOLUCION: "Registrar devolución",
};
export function auditAction(value: string): string {
  return actions[value] ?? value.toLocaleLowerCase("es").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
export function auditDescription(entry: AuditEntry): string {
  if (entry.descripcion) return entry.descripcion;
  const details = entry.detalles ?? {};
  const parts = entry.entidad.split("/").filter(Boolean);
  const subjects: Record<string, string> = { usuarios: "usuario", verificaciones: "solicitud de voluntariado", donaciones: "donación", almacenes: "almacén", recepciones: "recepción", parametros: "parámetros de asignación", banco: "banco de alimentos", rutas: "ruta", lotes: "lote de inventario" };
  const subject = subjects[parts[1]] ?? subjects[parts[0]] ?? entry.modulo.toLocaleLowerCase("es");
  const reference = details.codigo ?? details.nombre ?? details.id ?? parts.find((part) => /^[0-9a-f]{8}-/i.test(part));
  return `${auditAction(entry.accion)} ${subject}${reference ? ` (${reference})` : ""}${details.estado ? `. Resultado: ${details.estado.toLocaleLowerCase("es").replaceAll("_", " ")}` : ""}${details.donacion_id ? `. Donación: ${details.donacion_id}` : ""}.`;
}

export function auditValues(value: unknown, key = "", depth = 0): unknown {
  if (depth > 15) return "Información demasiado extensa para mostrar.";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (["true", "false"].includes(trimmed) && ["activo", "perecedero", "requiere_refrigeracion", "tiene_flota_propia"].includes(key)) return trimmed === "true";
    if (trimmed === "null") return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"')) {
      try { return auditValues(JSON.parse(trimmed), key, depth + 1); }
      catch { return "No fue posible interpretar los valores registrados."; }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => auditValues(item, key, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, auditValues(item, field, depth + 1)]));
  return value;
}

