import { useState } from "react";
import { Badge, Card, Drawer, Icon } from "../components/ui";
import { useRead } from "./read";
import { useSession } from "./session-context";
import type { Page } from "./contracts";
import { roleLabels, statusLabels } from "./contracts";
import { DashboardLive } from "./DashboardLive";

type Row = Record<string, unknown>;
type Column = [string, string];
interface ListConfig {
  title: string;
  endpoint: string;
  paginated?: boolean;
  columns: Column[];
  detail?: string;
  idField?: string;
  admin?: boolean;
  donation?: boolean;
}
const configs: Record<string, ListConfig> = {
  "/donaciones": {
    title: "Donaciones",
    endpoint: "/donaciones",
    paginated: true,
    detail: "/donaciones",
    donation: true,
    columns: [
      ["codigo", "Código"],
      ["titulo", "Título"],
      ["estado", "Estado"],
      ["peso_estimado_kg", "Peso estimado (kg)"],
      ["almacen_destino.nombre", "Almacén"],
      ["ventana_recogida_inicio", "Recogida desde"],
    ],
  },
  "/rutas": {
    title: "Rutas",
    endpoint: "/rutas",
    paginated: true,
    detail: "/rutas",
    columns: [
      ["codigo", "Código"],
      ["estado", "Estado"],
      ["fecha_programada", "Fecha"],
      ["paradas", "Paradas"],
      ["distancia_total_km", "Distancia (km)"],
      ["almacen_destino.nombre", "Almacén"],
    ],
  },
  "/recepciones": {
    title: "Recepciones",
    endpoint: "/recepciones",
    paginated: true,
    detail: "/recepciones",
    columns: [
      ["donacion.codigo", "Donación"],
      ["estado", "Estado"],
      ["peso_recibido_kg", "Recibido (kg)"],
      ["peso_rechazado_kg", "Rechazado (kg)"],
      ["almacen.nombre", "Almacén"],
      ["fecha_recepcion", "Fecha"],
    ],
  },
  "/inventario": {
    title: "Inventario",
    endpoint: "/inventario/lotes",
    paginated: true,
    detail: "/inventario/lotes",
    idField: "lote_id",
    columns: [
      ["codigo_lote", "Lote"],
      ["tipo_alimento", "Producto"],
      ["almacen", "Almacén"],
      ["cantidad_disponible", "Cantidad disponible"],
      ["unidad", "Unidad"],
      ["peso_disponible_kg", "Peso disponible (kg)"],
      ["fecha_vencimiento", "Vencimiento"],
    ],
  },
  "/almacenes": {
    title: "Almacenes",
    endpoint: "/almacenes",
    columns: [
      ["nombre", "Nombre"],
      ["direccion", "Dirección"],
      ["tipo", "Almacenamiento"],
      ["capacidad_kg", "Capacidad (kg)"],
      ["kg_en_inventario", "Inventario (kg)"],
      ["activo", "Activo"],
    ],
  },
  "/voluntarios": {
    title: "Lista de voluntarios",
    endpoint: "/admin/usuarios?rol=VOLUNTARIO",
    paginated: true,
    admin: true,
    columns: [
      ["nombres", "Nombres"],
      ["apellidos", "Apellidos"],
      ["email", "Correo"],
      ["telefono", "Teléfono"],
      ["estado", "Estado"],
    ],
  },
  "/pendientes": {
    title: "Voluntarios pendientes",
    endpoint: "/admin/verificaciones?estado=PENDIENTE",
    paginated: true,
    admin: true,
    detail: "/admin/verificaciones",
    columns: [
      ["usuario.nombres", "Nombres"],
      ["usuario.apellidos", "Apellidos"],
      ["usuario.email", "Correo"],
      ["usuario.telefono", "Teléfono"],
      ["voluntario.tipo_vehiculo.nombre", "Vehículo"],
      ["voluntario.capacidad_carga_kg", "Capacidad (kg)"],
      ["estado", "Estado"],
    ],
  },
};
const notifications: ListConfig = {
  title: "Notificaciones",
  endpoint: "/me/notificaciones",
  paginated: true,
  columns: [
    ["titulo", "Título"],
    ["cuerpo", "Mensaje"],
    ["created_at", "Fecha"],
    ["leida_at", "Leída el"],
  ],
};
const labels: Record<string, string> = {
  ...roleLabels,
  ...statusLabels,
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
  asignacion: "Asignación",
  contacto: "Contacto",
  almacen_destino: "Almacén de destino",
  usuario: "Usuario",
  voluntario: "Voluntario",
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
const at = (row: Row, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Row)[key] : undefined,
      row,
    );
function textValue(value: unknown): string {
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
function fieldLabel(key: string) {
  return (
    labels[key] ||
    key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())
  );
}
function DataDetails({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return <p>No hay información disponible.</p>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="form-stack">
        {value.map((item, index) => (
          <section key={index}>
            <DataDetails value={item} depth={depth + 1} />
          </section>
        ))}
      </div>
    ) : (
      <p>Sin registros.</p>
    );
  if (typeof value !== "object") return <p>{textValue(value)}</p>;
  return (
    <dl className="details api-details">
      {Object.entries(value as Row).map(([key, item]) => (
        <div key={key}>
          <dt>{fieldLabel(key)}</dt>
          <dd>
            {typeof item === "object" && item !== null && depth < 4 ? (
              <DataDetails value={item} depth={depth + 1} />
            ) : typeof item === "string" && /^https?:\/\//.test(item) ? (
              <a href={item} target="_blank" rel="noreferrer">
                Abrir {fieldLabel(key).toLowerCase()}
              </a>
            ) : (
              textValue(item)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ReadBody({ endpoint }: { endpoint: string }) {
  const read = useRead<unknown>(endpoint);
  if (read.loading) return <p role="status">Cargando información…</p>;
  if (read.error)
    return (
      <div className="form-stack">
        <p className="integration-error" role="alert">
          {read.error}
        </p>
        <button className="button secondary" onClick={read.refresh}>
          Reintentar
        </button>
      </div>
    );
  return <DataDetails value={read.data} />;
}
function Records({ config }: { config: ListConfig }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const endpoint =
    config.endpoint +
    (config.paginated
      ? `${config.endpoint.includes("?") ? "&" : "?"}limite=20&desplazamiento=${offset}`
      : "");
  const read = useRead<Row[] | Page<Row>>(endpoint);
  const data = read.data;
  const rows = Array.isArray(data) ? data : data?.datos || [];
  const total = Array.isArray(data) ? data.length : data?.total || 0;
  const visible = rows.filter((row) =>
    config.columns.some(([key]) =>
      textValue(at(row, key))
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
    ),
  );
  return (
    <>
      {config.endpoint.startsWith("/admin/usuarios?rol=") && (
        <p className="integration-banner">
          Esta lista muestra los datos de cuenta disponibles. El vehículo y la
          capacidad se consultan en el detalle de las verificaciones.
        </p>
      )}
      <Card className="table-card">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Buscar en esta página"
              placeholder="Buscar en esta página…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {config.title === "Lista de voluntarios" && (
            <a className="button secondary" href="#/pendientes">
              Ver pendientes
            </a>
          )}
          <button className="button secondary" onClick={read.refresh}>
            Actualizar lista
          </button>
        </div>
        {read.loading ? (
          <p className="integration-state" role="status">
            Cargando {config.title.toLowerCase()}…
          </p>
        ) : read.error ? (
          <div className="integration-state">
            <p role="alert" className="integration-error">
              {read.error}
            </p>
            <button className="button" onClick={read.refresh}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              aria-label={`Tabla de ${config.title.toLowerCase()}`}
            >
              <table>
                <thead>
                  <tr>
                    {config.columns.map(([key, label]) => (
                      <th key={key} scope="col">
                        {label}
                      </th>
                    ))}
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, index) => (
                    <tr key={String(row[config.idField || "id"] ?? index)}>
                      {config.columns.map(([key]) => (
                        <td key={key}>
                          {key === "estado" ? (
                            <Badge>{textValue(at(row, key))}</Badge>
                          ) : (
                            textValue(at(row, key))
                          )}
                        </td>
                      ))}
                      <td>
                        <button
                          className="table-action"
                          onClick={() => setSelected(row)}
                        >
                          Ver
                        </button>
                        {config.donation && (
                          <a
                            className="table-action"
                            href={`#/asignaciones?id=${encodeURIComponent(String(row.id))}`}
                          >
                            Asignar
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={config.columns.length + 1}>
                        No se encontraron registros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="integration-pagination">
              <span>
                {total
                  ? `${offset + 1}–${offset + rows.length} de ${total} registros`
                  : "0 registros"}
              </span>
              {config.paginated && (
                <div className="card-actions">
                  <button
                    className="button secondary"
                    disabled={!offset}
                    onClick={() => {
                      setOffset(Math.max(0, offset - 20));
                      setSearch("");
                    }}
                  >
                    Anterior
                  </button>
                  <button
                    className="button secondary"
                    disabled={offset + rows.length >= total}
                    onClick={() => {
                      setOffset(offset + 20);
                      setSearch("");
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      {selected && (
        <Drawer
          title={`Detalle · ${config.title}`}
          close={window.location.hash}
          onClose={() => setSelected(null)}
        >
          {config.detail ? (
            <ReadBody
              key={String(selected[config.idField || "id"])}
              endpoint={`${config.detail}/${encodeURIComponent(String(selected[config.idField || "id"]))}`}
            />
          ) : (
            <DataDetails value={selected} />
          )}
        </Drawer>
      )}
    </>
  );
}
export function ReadScreen({ path, id }: { path: string; id: string | null }) {
  const auth = useSession()!;
  const config = configs[path];
  if (
    (config?.admin || path === "/configuracion") &&
    !auth.profile?.roles.includes("ADMIN")
  )
    return (
      <Card>
        <p role="alert">Esta consulta requiere el rol Administrador.</p>
      </Card>
    );
  if (config) return <Records key={path} config={config} />;
  if (path === "/reportes")
    return (
      <>
        <p className="integration-banner">
          Resumen de indicadores de la API. La bitácora de auditoría no dispone
          de un endpoint de consulta.
        </p>
        <DashboardLive />
      </>
    );
  if (path === "/configuracion") return <SettingsRead />;
  if (!id)
    return (
      <Card>
        <p>
          Selecciona una donación desde la lista para consultar esta pantalla.
        </p>
        <a className="button" href="#/donaciones">
          Ver donaciones
        </a>
      </Card>
    );
  const donation = `/donaciones/${encodeURIComponent(id)}`;
  return (
    <div className="form-stack">
      <Card title="Donación seleccionada">
        <ReadBody key={id} endpoint={donation} />
      </Card>
      {path === "/asignaciones" && (
        <Card title="Voluntarios candidatos">
          <ReadBody key={id} endpoint={`${donation}/candidatos`} />
        </Card>
      )}
      {path === "/recepcion" && (
        <p className="integration-banner">
          Consulta de la donación para recepción. El registro de una recepción
          se conectará en una próxima etapa.
        </p>
      )}
    </div>
  );
}
function SettingsRead() {
  const [tab, setTab] = useState("banco");
  return (
    <Card>
      <div className="tabs">
        {[
          ["banco", "Banco de alimentos"],
          ["parametros", "Parámetros"],
          ["catalogos", "Catálogos"],
        ].map(([code, label]) => (
          <button
            key={code}
            aria-pressed={tab === code}
            className={tab === code ? "active" : ""}
            onClick={() => setTab(code)}
          >
            {label}
          </button>
        ))}
      </div>
      <ReadBody
        key={tab}
        endpoint={tab === "catalogos" ? "/catalogos" : `/admin/${tab}`}
      />
    </Card>
  );
}
export function NotificationsRead({ close }: { close: string }) {
  return (
    <Drawer title="Notificaciones" close={close}>
      <Records config={notifications} />
    </Drawer>
  );
}
export function LiveBell({ href }: { href: string }) {
  const read = useRead<Page<Row> & { no_leidas: number }>(
    "/me/notificaciones?limite=1&desplazamiento=0",
  );
  return (
    <a
      className="notification-button"
      href={href}
      aria-label={
        read.error
          ? "Abrir notificaciones; no se pudo consultar el contador"
          : `Abrir notificaciones${read.data ? `, ${read.data.no_leidas} sin leer` : ""}`
      }
    >
      <Icon name="bell" />
      {read.data && read.data.no_leidas > 0 && (
        <span>{read.data.no_leidas}</span>
      )}
    </a>
  );
}
