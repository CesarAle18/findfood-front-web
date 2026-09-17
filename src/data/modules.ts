import type { ModuleKey } from "../domain/models";
export interface ModuleConfig {
  title: string;
  description: string;
  singular: string;
  columns: [string, string][];
  filter: [string, string];
  secondaryFilter?: [string, string];
  create?: boolean;
}
export const modules: Record<ModuleKey, ModuleConfig> = {
  donaciones: {
    title: "Gestión de donaciones",
    description: "Consulta, filtra y gestiona las donaciones registradas.",
    singular: "donación",
    columns: [
      ["id", "ID"],
      ["name", "Donante"],
      ["products", "Productos"],
      ["weight", "Peso"],
      ["expiry", "Vence"],
      ["urgency", "Urgencia"],
      ["status", "Estado"],
    ],
    filter: ["status", "Estado"],
    secondaryFilter: ["urgency", "Urgencia"],
    create: true,
  },
  usuarios: {
    title: "Usuarios",
    description: "Administra usuarios, roles y estado de acceso.",
    singular: "usuario",
    columns: [
      ["name", "Nombre"],
      ["email", "Correo"],
      ["role", "Rol"],
      ["status", "Estado"],
      ["phone", "Teléfono"],
      ["last", "Último acceso"],
    ],
    filter: ["role", "Rol"],
    secondaryFilter: ["status", "Estado"],
    create: true,
  },
  almacenes: {
    title: "Almacenes",
    description: "Administra las áreas de almacenamiento y su capacidad.",
    singular: "almacén",
    columns: [
      ["id", "Código"],
      ["name", "Nombre"],
      ["regime", "Régimen"],
      ["capacity", "Capacidad"],
      ["owner", "Responsable"],
      ["status", "Estado"],
    ],
    filter: ["regime", "Régimen"],
    secondaryFilter: ["status", "Estado"],
    create: true,
  },
  voluntarios: {
    title: "Voluntarios",
    description: "Consulta y revisa personas interesadas en ser voluntarias.",
    singular: "postulante",
    columns: [
      ["name", "Nombre"],
      ["city", "Ciudad"],
      ["vehicle", "Vehículo"],
      ["capacity", "Capacidad"],
      ["cold", "Refrigeración"],
      ["availability", "Disponibilidad"],
      ["documents", "Documentación"],
      ["status", "Estado"],
    ],
    filter: ["city", "Ciudad"],
    secondaryFilter: ["vehicle", "Vehículo"],
  },
  inventario: {
    title: "Inventario FEFO",
    description:
      "Prioriza la salida de alimentos según su fecha de vencimiento.",
    singular: "lote",
    columns: [
      ["priority", "Prioridad"],
      ["id", "Lote"],
      ["name", "Producto"],
      ["weight", "Peso"],
      ["regime", "Régimen"],
      ["expiry", "Vencimiento"],
      ["status", "Estado"],
    ],
    filter: ["regime", "Régimen"],
    secondaryFilter: ["status", "Disponibilidad"],
  },
  recepciones: {
    title: "Recepciones",
    description:
      "Consulta y gestiona las donaciones que llegan al banco de alimentos.",
    singular: "recepción",
    columns: [
      ["id", "Recepción"],
      ["donation", "Donación"],
      ["name", "Donante"],
      ["volunteer", "Voluntario"],
      ["arrival", "Llegada"],
      ["result", "Resultado"],
      ["status", "Estado"],
    ],
    filter: ["status", "Estado"],
    secondaryFilter: ["result", "Resultado"],
    create: true,
  },
  reportes: {
    title: "Reporte de auditorías",
    description: "Trazabilidad de acciones realizadas en la plataforma.",
    singular: "registro",
    columns: [
      ["date", "Fecha / Hora"],
      ["name", "Actor"],
      ["module", "Módulo"],
      ["action", "Acción"],
      ["entity", "Entidad"],
      ["before", "Valores anteriores"],
      ["after", "Valores nuevos"],
      ["ip", "IP"],
    ],
    filter: ["name", "Usuario"],
    secondaryFilter: ["module", "Módulo"],
  },
};
