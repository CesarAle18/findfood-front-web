import type { Role } from "./contracts";
import { canAssignDonation } from "./donation-display";
export type Values = Record<string, string>;
export type Row = Record<string, unknown>;
export interface Source {
  endpoint: string;
  key?: string;
  label?: string;
  states?: string[];
}
export interface Input {
  key: string;
  label: string;
  type?: "number" | "select" | "checkbox" | "textarea" | "multi";
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  step?: number;
  options?: [string, string][];
  source?: Source;
}
export interface Action {
  key: string;
  label: string;
  roles: Role[];
  endpoint: string;
  method: "POST" | "PATCH" | "PUT";
  fields: Input[];
  initial?: Values;
  description?: string;
  body?: (v: Values) => Row;
}
const admin: Role[] = ["ADMIN"],
  advisor: Role[] = ["ASESOR_BANCO"],
  staff: Role[] = ["ADMIN", "ASESOR_BANCO"];
const str = (key: string, label: string, min = 1, maxLength = 100): Input => ({
  key,
  label,
  required: true,
  min,
  maxLength,
});
const num = (key: string, label: string, min = 0, max?: number): Input => ({
  key,
  label,
  type: "number",
  required: true,
  min,
  max,
  step: 0.01,
});
const note = (
  key = "observacion",
  label = "Observación",
  required = false,
  min = 0,
  maxLength = 1000,
): Input => ({ key, label, type: "textarea", required, min, maxLength });
const bool = (key: string, label: string): Input => ({
  key,
  label,
  type: "checkbox",
});
const choice = (
  key: string,
  label: string,
  options: [string, string][],
): Input => ({ key, label, type: "select", required: true, options });
const catalog = (
  key: string,
  label: string,
  collection: string,
  scope?: string,
): Input => ({
  key,
  label,
  type: "select",
  required: true,
  source: {
    endpoint: `/catalogos?incluir=${collection}${scope ? `&ambito=${scope}` : ""}`,
    key: collection,
  },
});
const id = (row: Row) => encodeURIComponent(String(row.id ?? row.lote_id));
const remark = (v: Values) =>
  v.observacion.trim() ? { observacion: v.observacion.trim() } : {};
const initial = (row: Row, keys: string[]): Values =>
  Object.fromEntries(keys.map((key) => [key, String(row[key] ?? "")]));
const location = [
  num("lat", "Latitud", -90, 90),
  num("lng", "Longitud", -180, 180),
].map((f) => ({ ...f, step: 0.000001 }));
const thermal: [string, string][] = [
  ["SECO", "Seco"],
  ["REFRIGERADO", "Refrigerado"],
];
export function recordActions(path: string, row: Row): Action[] {
  const prefix = `${path}/${id(row)}`;
  if (path === "/almacenes")
    return [
      {
        key: "warehouse-edit",
        label: "Editar almacén",
        roles: staff,
        endpoint: prefix,
        method: "PATCH",
        description: "La capacidad en kg corresponde al régimen de esta sede.",
        fields: [
          str("nombre", "Nombre", 2, 80),
          str("direccion", "Dirección", 5, 255),
          choice("tiene_refrigeracion", "¿La sede tiene refrigeración?", [["true", "Sí"], ["false", "No"]]),
          num("capacidad_kg", "Capacidad (kg)", 1),
          bool("activo", "Almacén activo"),
        ],
        initial: { ...initial(row, ["nombre", "direccion", "capacidad_kg", "activo"]), tiene_refrigeracion: String(row.tipo === "REFRIGERADO") },
        body: (v) => ({
          nombre: v.nombre.trim(),
          ...(v.direccion.trim() !== String(row.direccion ?? "") ? { direccion: v.direccion.trim() } : {}),
          ...((v.tiene_refrigeracion === "true" ? "REFRIGERADO" : "SECO") !== row.tipo ? { tipo: v.tiene_refrigeracion === "true" ? "REFRIGERADO" : "SECO" } : {}),
          capacidad_kg: Number(v.capacidad_kg),
          activo: v.activo === "true",
        }),
      },
    ];
  if (
    path === "/donaciones" &&
    !["CANCELADA", "RECIBIDA"].includes(String(row.estado))
  )
    return [
      {
        key: "donation-cancel",
        label: "Cancelar donación",
        roles: admin,
        endpoint: `${prefix}/cancelar`,
        method: "POST",
        fields: [
          catalog("motivo_id", "Motivo", "motivos", "CANCELACION_DONACION"),
          note(),
        ],
        body: (v) => ({ motivo_id: Number(v.motivo_id), ...remark(v) }),
      },
      ...(canAssignDonation(row) ? [{
        key: "donation-reassign",
        label: "Reasignar donación",
        roles: staff,
        endpoint: `${prefix}/reasignar`,
        method: "POST" as const,
        description:
          "El motor volverá a evaluar candidatos y ofrecerá la donación según sus reglas de asignación.",
        fields: [note()],
        body: remark,
      }] : []),
    ];
  if (path === "/pendientes" && row.estado === "PENDIENTE")
    return [
      {
        key: "verify-approve",
        label: "Aprobar voluntario",
        roles: admin,
        endpoint: `/admin/verificaciones/${id(row)}/aprobar`,
        method: "POST",
        fields: [],
        body: () => ({}),
      },
      {
        key: "verify-reject",
        label: "Rechazar solicitud",
        roles: admin,
        endpoint: `/admin/verificaciones/${id(row)}/rechazar`,
        method: "POST",
        fields: [
          catalog("motivo_id", "Motivo", "motivos", "RECHAZO_VERIFICACION"),
          note(),
        ],
        body: (v) => ({ motivo_id: Number(v.motivo_id), ...remark(v) }),
      },
    ];
  if (path === "/inventario")
    return [
      {
        key: "lot-adjust",
        label: "Ajustar inventario",
        roles: advisor,
        endpoint: `/inventario/lotes/${id(row)}/ajuste`,
        method: "POST",
        fields: [
          choice("tipo", "Tipo de ajuste", [
            ["AJUSTE", "Ajuste"],
            ["MERMA", "Merma"],
            ["VENCIMIENTO", "Vencimiento"],
          ]),
          num("cantidad", "Cantidad en unidades del lote", -99999999),
          note("motivo", "Motivo", true, 3, 500),
        ],
        body: (v) => {
          const quantity = Number(v.cantidad);
          if (!quantity || (v.tipo !== "AJUSTE" && quantity < 0))
            throw new Error(
              "La cantidad debe ser distinta de cero; para merma o vencimiento debe ser positiva.",
            );
          return { tipo: v.tipo, cantidad: quantity, motivo: v.motivo.trim() };
        },
      },
    ];
  if (path === "/incidencias")
    return [
      ...(row.estado === "ABIERTA"
        ? [
            {
              key: "incident-review",
              label: "Revisar incidencia",
              roles: staff,
              endpoint: `${prefix}/revisar`,
              method: "POST" as const,
              fields: [],
              body: () => ({}),
            },
          ]
        : []),
      ...(["ABIERTA", "EN_REVISION"].includes(String(row.estado))
        ? [
            {
              key: "incident-resolve",
              label: "Resolver incidencia",
              roles: admin,
              endpoint: `${prefix}/resolver`,
              method: "POST" as const,
              fields: [note("resolucion", "Resolución", true, 5, 2000)],
            },
          ]
        : []),
    ];
  if (path === "/distribuciones" && row.estado === "BORRADOR")
    return ["confirmar", "anular"].map((operation) => ({
      key: `distribution-${operation}`,
      label:
        operation === "confirmar"
          ? "Confirmar distribución"
          : "Anular distribución",
      roles: advisor,
      endpoint: `${prefix}/${operation}`,
      method: "POST",
      fields: [],
      body: () => ({}),
    }));
  if (path === "/alertas" && !row.atendida_at)
    return [
      {
        key: "alert-attend",
        label: "Atender alerta",
        roles: advisor,
        endpoint: `${prefix}/atender`,
        method: "POST",
        fields: [note("accion_tomada", "Acción tomada", true, 3)],
      },
    ];
  if (
    path === "/usuarios" &&
    row.id &&
    !["PENDIENTE_CONFIRMACION"].includes(String(row.estado))
  )
    return row.estado === "SUSPENDIDO"
      ? [
          {
            key: "user-reactivate",
            label: "Reactivar cuenta",
            roles: admin,
            endpoint: `/admin/usuarios/${id(row)}/reactivar`,
            method: "POST",
            fields: [],
            body: () => ({}),
          },
        ]
      : [
          {
            key: "user-suspend",
            label: "Suspender cuenta",
            roles: admin,
            endpoint: `/admin/usuarios/${id(row)}/suspender`,
            method: "POST",
            fields: [
              note("descripcion", "Motivo de suspensión", true, 5, 2000),
            ],
          },
        ];
  return [];
}
export function createAction(path: string): Action | null {
  if (path === "/rutas") return {
    key: "route-create", label: "Planificar ruta de flota", roles: advisor, endpoint: "/rutas", method: "POST",
    description: "Selecciona donaciones publicadas o expiradas. La API verifica la flota, la sede, las ventanas y el límite de paradas, y calcula el recorrido.",
    fields: [{ key: "donacion_ids", label: "Donaciones de la ruta", type: "multi", required: true, source: { endpoint: "/donaciones", states: ["PUBLICADA", "EXPIRADA"] } }],
    body: (v) => {
      const ids: string[] = JSON.parse(v.donacion_ids || "[]");
      if (!ids.length || ids.length > 5) throw new Error("Selecciona entre 1 y 5 donaciones. Se aplicará el límite configurado del banco.");
      return { donacion_ids: ids };
    },
  };
  if (path === "/almacenes")
    return {
      key: "warehouse-create",
      label: "Nuevo almacén",
      roles: admin,
      endpoint: path,
      method: "POST",
      fields: [
        str("nombre", "Nombre", 2, 80),
        str("direccion", "Dirección", 5, 255),
        ...location,
        choice("tipo", "Almacenamiento", thermal),
        num("capacidad_kg", "Capacidad (kg)", 1),
      ],
      body: (v) => ({
        nombre: v.nombre.trim(),
        direccion: v.direccion.trim(),
        ubicacion: { lat: Number(v.lat), lng: Number(v.lng) },
        tipo: v.tipo,
        capacidad_kg: Number(v.capacidad_kg),
      }),
    };
  if (path === "/incidencias")
    return {
      key: "incident-create",
      label: "Nueva incidencia",
      roles: staff,
      endpoint: path,
      method: "POST",
      fields: [
        {
          key: "donacion_id",
          label: "Donación afectada",
          type: "select",
          required: true,
          source: { endpoint: "/donaciones" },
        },
        catalog("tipo_incidencia_id", "Tipo de incidencia", "tipos_incidencia"),
        note("descripcion", "Descripción", true, 5, 2000),
      ],
      body: (v) => ({
        donacion_id: v.donacion_id,
        tipo_incidencia_id: Number(v.tipo_incidencia_id),
        descripcion: v.descripcion.trim(),
      }),
    };
  return null;
}
export function bankAction(row: Row = {}): Action {
  return {
    key: "bank-save",
    label: "Guardar banco",
    roles: admin,
    endpoint: "/admin/banco",
    method: "PUT",
    initial: initial(row, [
      "nombre",
      "direccion",
      "ciudad",
      "tiene_flota_propia",
    ]),
    fields: [
      str("nombre", "Nombre", 2, 150),
      str("direccion", "Dirección", 5, 255),
      str("ciudad", "Ciudad", 1, 80),
      bool("tiene_flota_propia", "Flota propia"),
    ],
    body: (v) => {
      const lat = Number(row.lat), lng = Number(row.lng);
      if (row.lat == null || row.lng == null || row.lat === "" || row.lng === "" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error("No se pudo recuperar la ubicación guardada del banco. Actualiza la información antes de guardar.");
      }
      return {
      nombre: v.nombre.trim(),
      direccion: v.direccion.trim(),
      ciudad: v.ciudad.trim(),
      ubicacion: { lat, lng },
      tiene_flota_propia: v.tiene_flota_propia === "true",
      };
    },
  };
}
export function parameterAction(row: Row): Action {
  return {
    key: "parameter-save",
    label: `Editar ${String(row.clave)}`,
    roles: admin,
    endpoint: `/admin/parametros/${encodeURIComponent(String(row.clave))}`,
    method: "PUT",
    fields: [str("valor", "Valor", 1, 2000)],
    initial: initial(row, ["valor"]),
    description:
      "Los cuatro pesos deben sumar 1; la API valida cada cambio. El máximo de paradas está entre 1 y 5.",
  };
}
export function foodAction(row?: Row): Action {
  return {
    key: row ? "food-edit" : "food-create",
    label: row ? "Editar alimento" : "Nuevo tipo de alimento",
    roles: admin,
    endpoint: row
      ? `/admin/tipos-alimento/${id(row)}`
      : "/admin/tipos-alimento",
    method: row ? "PATCH" : "POST",
    initial: row
      ? initial(row, [
          "nombre",
          "requiere_refrigeracion",
          "tipo_almacenamiento",
          "perecedero",
          "activo",
          "vida_util_dias",
        ])
      : undefined,
    fields: [
      ...(!row
        ? [
            catalog(
              "categoria_alimento_id",
              "Categoría",
              "categorias_alimento",
            ),
            catalog("unidad_medida_id", "Unidad", "unidades_medida"),
            str("codigo", "Código", 2, 40),
          ]
        : []),
      str("nombre", "Nombre", 2, 100),
      bool("requiere_refrigeracion", "Requiere refrigeración"),
      choice("tipo_almacenamiento", "Almacenamiento", thermal),
      bool("perecedero", "Perecedero"),
      { ...num("vida_util_dias", "Vida útil (días)", 1), required: false, step: 1 },
      ...(row ? [bool("activo", "Activo")] : []),
    ],
    body: (v) => ({
      ...(v.vida_util_dias ? { vida_util_dias: Number(v.vida_util_dias) } : {}),
      nombre: v.nombre.trim(),
      requiere_refrigeracion: v.requiere_refrigeracion === "true",
      tipo_almacenamiento: v.tipo_almacenamiento,
      perecedero: v.perecedero === "true",
      ...(row
        ? { activo: v.activo === "true" }
        : {
            categoria_alimento_id: Number(v.categoria_alimento_id),
            unidad_medida_id: Number(v.unidad_medida_id),
            codigo: v.codigo.trim().toUpperCase(),
          }),
    }),
  };
}


