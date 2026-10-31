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
