import { useState } from "react";
import { Badge, Card, Drawer, Icon } from "../components/ui";
import { useRead } from "./read";
import { useSession } from "./session-context";
import type { Page } from "./contracts";
import { DataDetails, ReadBody } from "./ReadDisplay";
import { textValue, fieldValue, at } from "./read-format";
import { ActionButtons } from "./ActionForm";
import { createAction, recordActions } from "./actions";
import { SettingsLive } from "./SettingsLive";
import { ReceptionLive, DistributionCreate } from "./StockForms";
import { EvidencePanel } from "./EvidencePanel";
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
  "/distribuciones": {
    title: "Distribuciones",
    endpoint: "/distribuciones",
    paginated: true,
    detail: "/distribuciones",
    columns: [
      ["codigo", "Código"],
      ["estado", "Estado"],
      ["nombre_destino", "Destino"],
      ["numero_beneficiarios", "Beneficiarios"],
      ["fecha_distribucion", "Fecha"],
    ],
  },
  "/incidencias": {
    title: "Incidencias",
    endpoint: "/incidencias",
    paginated: true,
    detail: "/incidencias",
    columns: [
      ["descripcion", "Descripción"],
      ["estado", "Estado"],
      ["nivel", "Nivel"],
      ["created_at", "Fecha"],
    ],
  },
  "/alertas": {
    title: "Alertas",
    endpoint: "/alertas?solo_abiertas=false",
    columns: [
      ["lote_inventario.codigo_lote", "Lote"],
      ["mensaje", "Mensaje"],
      ["nivel", "Nivel"],
      ["generada_at", "Generada"],
      ["atendida_at", "Atendida"],
    ],
  },
  "/donaciones": {
    title: "Donaciones",
    endpoint: "/donaciones",
    paginated: true,
    detail: "/donaciones",
    donation: true,
    columns: [
      ["codigo", "Código"],
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
      ["kg_en_inventario", "Existencias actuales (kg)"],
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
function Records({ config }: { config: ListConfig }) {
  const auth = useSession()!;
  const path = config.endpoint.split("?")[0];
  const mutationPath =
    path === "/admin/verificaciones"
      ? "/pendientes"
      : path === "/inventario/lotes"
        ? "/inventario"
        : path;
  const create = createAction(mutationPath);
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
  const selectedRow =
    selected &&
    (rows.find(
      (row) => row[config.idField || "id"] === selected[config.idField || "id"],
    ) ||
      selected);
  const warehouseWeights =
    path === "/almacenes"
      ? rows.map((row) =>
          row.kg_en_inventario == null ||
          String(row.kg_en_inventario).trim() === ""
            ? NaN
            : Number(row.kg_en_inventario),
        )
      : [];
  return (
    <>
      {path === "/almacenes" && (
        <Card title="Existencias de los almacenes">
          <p>
            La capacidad es el límite de almacenamiento. Las existencias
            corresponden al peso de los lotes disponibles o reservados, sin
            filtro de fechas.
          </p>
          {!read.loading && !read.error && (
            <p className="inventory-total">
              Total en inventario{" "}
              <strong>
                {warehouseWeights.every(Number.isFinite)
                  ? `${warehouseWeights.reduce((sum, kg) => sum + kg, 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`
                  : "Peso no disponible"}
              </strong>
            </p>
          )}
        </Card>
      )}
      {config.endpoint.startsWith("/admin/usuarios?rol=") && (
        <p className="integration-banner">
          Esta lista muestra los datos de cuenta disponibles. El vehículo y la
          capacidad se consultan en el detalle de las verificaciones.
        </p>
      )}
      {config.title === "Inventario" && (
        <div className="card-actions">
          <a className="button secondary" href="#/distribuciones">
            Distribuciones
          </a>
          <a className="button secondary" href="#/alertas">
            Alertas de inventario
          </a>
          <a className="button secondary" href="#/incidencias">
            Incidencias
          </a>
        </div>
      )}
      {config.title === "Distribuciones" && (
        <DistributionCreate onSaved={read.refresh} />
      )}
      {path === "/me/notificaciones" && (
        <ActionButtons
          actions={[
            {
              key: "notice-all",
              label: "Marcar todas como leídas",
              roles: ["ADMIN", "ASESOR_BANCO"],
              endpoint: "/me/notificaciones/leer-todas",
              method: "POST",
              fields: [],
              body: () => ({}),
            },
          ]}
          onSaved={read.refresh}
        />
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
          {create && (
            <ActionButtons actions={[create]} onSaved={read.refresh} />
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
                            fieldValue(key, at(row, key))
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
                        {path === "/me/notificaciones" && !row.leida_at && (
                          <ActionButtons
                            actions={[
                              {
                                key: "notice-read",
                                label: "Marcar leída",
                                roles: ["ADMIN", "ASESOR_BANCO"],
                                endpoint: `/me/notificaciones/${encodeURIComponent(String(row.id))}/leer`,
                                method: "POST",
                                fields: [],
                                body: () => ({}),
                              },
                            ]}
                            onSaved={read.refresh}
                          />
                        )}
                        {config.donation && (
                          <a
                            className="table-action"
                            href={`#/asignaciones?id=${encodeURIComponent(String(row.id))}`}
                          >
                            Asignar
                          </a>
                        )}
                        {config.donation &&
                          auth.profile?.roles.includes("ASESOR_BANCO") &&
                          row.estado === "ENTREGADA" && (
                            <a
                              className="table-action"
                              href={`#/recepcion?id=${encodeURIComponent(String(row.id))}`}
                            >
                              Recibir
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
      {selectedRow && (
        <Drawer
          title={`Detalle · ${config.title}`}
          close={window.location.hash}
          onClose={() => setSelected(null)}
        >
          <ActionButtons
            actions={recordActions(mutationPath, selectedRow)}
            onSaved={() => {
              setSelected(null);
              read.refresh();
            }}
          />
          {config.detail ? (
            <DetailBody
              path={mutationPath}
              row={selectedRow}
              endpoint={`${config.detail}/${encodeURIComponent(String(selectedRow[config.idField || "id"]))}`}
            />
          ) : (
            <DataDetails value={selectedRow} />
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
  if (path === "/configuracion") return <SettingsLive />;
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
      <ActionButtons
        actions={recordActions("/donaciones", { id }).filter(
          (a) => a.key === "donation-reassign",
        )}
        onSaved={() => {}}
      />
      {path === "/asignaciones" && (
        <Card title="Voluntarios candidatos">
          <ReadBody key={id} endpoint={`${donation}/candidatos`} />
        </Card>
      )}
      {path === "/recepcion" && <ReceptionLive id={id} />}
    </div>
  );
}
function DetailBody({
  path,
  row,
  endpoint,
}: {
  path: string;
  row: Row;
  endpoint: string;
}) {
  const read = useRead<Row>(endpoint);
  return (
    <>
      <button className="button secondary" type="button" onClick={read.refresh}>
        Actualizar detalle
      </button>
      <ReadBody endpoint={endpoint} read={read} />
      {path === "/donaciones" && (
        <>
          <h3>Historial</h3>
          <ReadBody endpoint={`${endpoint}/historial`} />
        </>
      )}
      {path === "/rutas" &&
        Array.isArray(read.data?.paradas) &&
        (read.data.paradas as Row[]).map((stop) => (
          <section key={String(stop.id)}>
            <h3>
              Parada {String(stop.orden)} · {String(stop.direccion)}
            </h3>

            <EvidencePanel parent="parada_id" id={String(stop.id)} />
          </section>
        ))}
      {["/donaciones", "/recepciones", "/incidencias"].includes(path) && (
        <EvidencePanel
          parent={
            path === "/donaciones"
              ? "donacion_id"
              : path === "/recepciones"
                ? "recepcion_id"
                : "incidencia_id"
          }
          id={String(row.id)}
        />
      )}
    </>
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
