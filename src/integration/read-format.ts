import { roleLabels, statusLabels } from "./contracts";
import type { Row } from "./actions";
const labels: Record<string, string> = {
  ...roleLabels,
  ...statusLabels,
  PUBLICACION: "Publicación",
  RECOGIDA: "Recogida",
  ENTREGA: "Entrega",
  RECEPCION: "Recepción",
  INCIDENCIA: "Incidencia",
  PUBLICADA: "Publicada",
  ASIGNADA: "Asignada",
  BORRADOR: "Borrador",
  EN_RECOLECCION: "En recolección",
  EN_TRANSITO: "En tránsito",
  ENTREGADA: "Entregada",
  RECIBIDA: "Recibida",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
  PLANIFICADA: "Planificada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  PENDIENTE: "Pendiente",
  ACEPTADA: "Aceptada",
  ACEPTADA_PARCIAL: "Aceptada parcialmente",
  APROBADA: "Aprobada",
  DISPONIBLE: "Disponible",
  RESERVADO: "Reservado",
  AGOTADO: "Agotado",
  VENCIDO: "Vencido",
  DESCARTADO: "Descartado",
  SECO: "Seco",
  REFRIGERADO: "Refrigerado",
  id: "ID",
  created_at: "Creado",
  updated_at: "Actualizado",
  items: "Productos",
  foto_url: "Fotografía del producto",
  url_lectura: "Enlace de lectura",
  capturada_at: "Fecha de captura",
  ruta: "Ruta del archivo",
  capacidad_kg: "Capacidad del almacén (kg)",
  kg_en_inventario: "Existencias actuales (kg)",
  titulo: "Título",
  descripcion: "Descripción",
  modo_recoleccion: "Modo de recolección",
  peso_estimado_kg: "Peso estimado (kg)",
  peso_recogido_kg: "Peso recogido (kg)",
  peso_recibido_kg: "Peso recibido (kg)",
  peso_disponible_kg: "Peso disponible (kg)",
  cantidad_disponible: "Cantidad disponible",
  tipo_alimento: "Tipo de alimento",
  unidad_medida: "Unidad de medida",
  fecha_vencimiento: "Fecha de vencimiento",
  fecha_vencimiento_min: "Vencimiento más próximo",
  requiere_refrigeracion: "Requiere refrigeración",
  ventana_recogida_inicio: "Inicio de recogida",
  ventana_recogida_fin: "Fin de recogida",
  asignacion: "Asignación",
  contacto: "Contacto",
  almacen_destino: "Almacén de destino",
  usuario: "Usuario",
  voluntario: "Voluntario",
  url_foto_vehiculo: "Foto del vehículo",
  url_documento_frente: "Documento (frente)",
  url_documento_reverso: "Documento (reverso)",
  url_selfie: "Selfie",
  categorias_alimento: "Categorías de alimentos",
  tipos_alimento: "Tipos de alimentos",
  unidades_medida: "Unidades de medida",
  tipos_vehiculo: "Tipos de vehículos",
  motivos: "Motivos",
  codigo: "Código",
  email: "Correo",
  direccion: "Dirección",
  telefono: "Teléfono",
  lat: "Latitud",
  lng: "Longitud",
};
export const at = (row: Row, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Row)[key] : undefined,
      row,
    );
export function textValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number")
    return value.toLocaleString("es-CO", { maximumFractionDigits: 3 });
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value))
      return new Date(value).toLocaleString("es-CO", {
        timeZone: "America/Bogota",
      });
    return labels[value] || value;
  }
  if (Array.isArray(value)) return value.map(textValue).join(", ");
  const row = value as Row;
  return textValue(row.nombre ?? row.codigo ?? row.titulo ?? row.id);
}
export function fieldLabel(key: string) {
  return (
    labels[key] ||
    key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())
  );
}

export function fieldValue(key: string, value: unknown) {
  if (
    (key.endsWith("_kg") || key === "kg_en_inventario") &&
    value != null &&
    value !== ""
  ) {
    const weight = Number(value);
    return Number.isFinite(weight) ? textValue(weight) : "No disponible";
  }
  return textValue(value);
}

export function readingUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
