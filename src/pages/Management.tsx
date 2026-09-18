import { useState } from "react";
import type { ModuleKey, Entity } from "../domain/models";
import { modules } from "../data/modules";
import { useData } from "../state/data-context";
import { href } from "../state/navigation";
import {
  Badge,
  Card,
  DemoButton,
  Details,
  Drawer,
  Field,
  Icon,
  LinkButton,
  Metrics,
  Photo,
  PrototypeForm,
  Select,
} from "../components/ui";

export function Management({ module }: { module: ModuleKey }) {
  const { entities } = useData();
  const config = modules[module];
  const rows = entities[module];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [second, setSecond] = useState("");
  const visible = rows.filter(
    (row) =>
      Object.values(row)
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es")) &&
      (!filter || row[config.filter[0]] === filter) &&
      (!second ||
        !config.secondaryFilter ||
        row[config.secondaryFilter[0]] === second),
  );
  const options = (field: string) => [
    ...new Set(rows.map((row) => row[field])),
  ];
  return (
    <>
      {module === "almacenes" && (
        <Metrics
          items={[
            ["Almacenes activos", "6", "5 operativos"],
            ["Capacidad total", "8.500 kg", "73% ocupada"],
            ["Refrigerados", "2", "1.900 kg"],
          ]}
        />
      )}
      {module === "recepciones" && (
        <Metrics
          items={[
            ["Pendientes", "8", "Por recibir"],
            ["En recepción", "3", "En revisión"],
            ["Completadas hoy", "14", "Recepciones registradas"],
            ["Con novedad", "2", "Revisar"],
          ]}
        />
      )}
      {module === "reportes" && (
        <Metrics
          items={[
            ["Total de registros", "1.248", "+12% este mes"],
            ["Usuarios únicos", "18", "+5%"],
            ["Módulos auditados", "9", "Sin cambios"],
            ["Acciones críticas", "42", "+25%"],
          ]}
        />
      )}
      {module === "inventario" && (
        <Metrics
          items={[
            ["Stock disponible", "1.245 kg", "En almacenes"],
            ["Vencen pronto", "128 kg", "Próximas 48 horas"],
            ["Lotes activos", "42", "Disponibles"],
            ["Refrigerados", "320 kg", "Cadena de frío"],
          ]}
        />
      )}
      <Card className="table-card">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Buscar registros"
              placeholder={
                module === "donaciones"
                  ? "Buscar por donante, producto o ID…"
                  : `Buscar ${config.singular}…`
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label={config.filter[1]}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{config.filter[1]}: Todos</option>
            {options(config.filter[0]).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          {config.secondaryFilter && (
            <select
              aria-label={config.secondaryFilter[1]}
              value={second}
              onChange={(e) => setSecond(e.target.value)}
            >
              <option value="">{config.secondaryFilter[1]}: Todos</option>
              {options(config.secondaryFilter[0]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          )}
          {module === "usuarios" && (
            <LinkButton to="#/pendientes" secondary>
              Voluntarios pendientes
            </LinkButton>
          )}
          {module === "voluntarios" && (
            <LinkButton to="#/pendientes" secondary>
              Ver pendientes
            </LinkButton>
          )}
          {config.create && (
            <LinkButton to={href("/" + module, "nuevo")}>
              +{" "}
              {module === "donaciones" || module === "recepciones"
                ? "Nueva"
                : "Nuevo"}{" "}
              {config.singular}
            </LinkButton>
          )}
          {module === "reportes" && (
            <DemoButton secondary>Exportar reporte</DemoButton>
          )}
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          aria-label={`Tabla de ${config.title}`}
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
              {visible.map((row) => (
                <tr key={row.id}>
                  {config.columns.map(([key]) => (
                    <td key={key}>
                      {["status", "urgency", "result", "regime"].includes(
                        key,
                      ) ? (
                        <Badge>{row[key]}</Badge>
                      ) : (
                        row[key]
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      <a
                        aria-label={`Ver ${row.id}`}
                        href={
                          module === "recepciones"
                            ? `#/recepcion?id=${row.id}`
                            : href("/" + module, "detalle", row.id)
                        }
                      >
                        {module === "recepciones" ? "Ver recepción" : "Ver"}
                      </a>
                      {config.create && module !== "recepciones" && (
                        <>
                          <span>·</span>
                          <a
                            aria-label={`Editar ${row.id}`}
                            href={href("/" + module, "editar", row.id)}
                          >
                            Editar
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <div className="empty">
              <Icon name="search" size={28} />
              <h3>No hay coincidencias</h3>
              <p>Prueba con otro término o restablece los filtros.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("");
                  setSecond("");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
        <div className="table-footer">
          Mostrando {visible.length} de {rows.length} registros de ejemplo
        </div>
      </Card>
      {module === "inventario" && (
        <div className="info">
          <Icon name="clock" />
          <div>
            <strong>Criterio activo: First Expired, First Out (FEFO)</strong>
            <p>
              Los productos sin fecha de vencimiento se ubican al final de la
              cola.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
export function EntityPanel({
  module,
  panel,
  id,
  base,
}: {
  module: ModuleKey;
  panel: string;
  id: string | null;
  base: string;
}) {
  const { entities } = useData();
  const config = modules[module];
  const entity = id ? entities[module].find((row) => row.id === id) : undefined;
  const close = href(base);
  if (panel !== "nuevo" && !entity)
    return (
      <Drawer title="Registro no encontrado" close={close}>
        <p>El registro solicitado no está en los datos de demostración.</p>
      </Drawer>
    );
  const editing = panel === "editar" || panel === "nuevo";
  const title = editing
    ? `${panel === "nuevo" ? "Nuevo" : "Editar"} ${config.singular}`
    : `Detalle de ${config.singular}`;
  return (
    <Drawer
      title={title}
      close={close}
      footer={
        editing ? (
          <>
            <LinkButton to={close} secondary>
              Cancelar
            </LinkButton>
            <DemoButton>
              {panel === "nuevo" ? "Crear" : "Guardar"} {config.singular}
            </DemoButton>
          </>
        ) : (
          <>
            <LinkButton to={close} secondary>
              Cerrar
            </LinkButton>
            {module === "voluntarios" ? (
              <>
                <DemoButton danger>Rechazar</DemoButton>
                <DemoButton>Aceptar</DemoButton>
              </>
            ) : (
              config.create && (
                <LinkButton to={href(base, "editar", entity?.id)}>
                  Editar {config.singular}
                </LinkButton>
              )
            )}
          </>
        )
      }
    >
      {editing ? (
        <EntityForm module={module} entity={entity} />
      ) : (
        entity && <EntityDetails module={module} entity={entity} />
      )}
    </Drawer>
  );
}
function EntityDetails({
  module,
  entity: e,
}: {
  module: ModuleKey;
  entity: Entity;
}) {
  return (
    <>
      <div className="entity-summary">
        <div className="avatar large">
          {e.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <h3>{e.name}</h3>
          <p>{e.email || e.id}</p>
        </div>
        <Badge>{e.status}</Badge>
      </div>
      {module === "donaciones" ? (
        <Details
          items={[
            ["Donante", e.name],
            ["Productos", e.products],
            ["Peso estimado", e.weight],
            ["Régimen térmico", "Refrigerado"],
            ["Ventana de recogida", "05/09/2026 · 16:00–18:00"],
            ["Fecha de vencimiento", e.expiry],
            ["Ubicación", "Chapinero, Bogotá D.C."],
            ["Estado actual", e.status],
          ]}
        />
      ) : module === "voluntarios" ? (
        <>
          <h3>Datos personales</h3>
          <Details
            items={[
              ["Nombre completo", e.name],
              ["Correo electrónico", e.email],
              ["Teléfono", e.phone],
              ["Documento", "1234567890"],
            ]}
          />
          <h3>Información del vehículo</h3>
          <Details
            items={[
              ["Tipo de vehículo", e.vehicle],
              ["Capacidad de carga", e.capacity],
              ["Cadena de frío", e.cold],
              ["Disponibilidad", e.availability],
              ["Zona de operación", e.city],
            ]}
          />
          <h3>Documentos adjuntos</h3>
          <div className="photo-grid">
            {["Documento de identidad", "Vehículo", "Licencia"].map((label) => (
              <Photo key={label} label={label} />
            ))}
          </div>
        </>
      ) : (
        <>
          <h3>Información general</h3>
          <Details
            items={modules[module].columns.map(([key, label]) => [
              label,
              e[key],
            ])}
          />
          {module === "usuarios" && e.role === "Voluntario" && (
            <>
              <h3>Información de voluntariado</h3>
              <Details
                items={[
                  ["Tipo de vehículo", "Camioneta"],
                  ["Capacidad", "500 kg"],
                  ["Refrigeración", "Sí dispone"],
                  ["Disponibilidad", "Lun–Vie · 08:00–18:00"],
                ]}
              />
              <h3>Documentación</h3>
              <ul className="check-list">
                <li>Documento de identidad</li>
                <li>Licencia de conducción</li>
                <li>Foto del vehículo</li>
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
function EntityForm({
  module,
  entity: e,
}: {
  module: ModuleKey;
  entity?: Entity;
}) {
  const { entities } = useData();
  const [receiptId, setReceiptId] = useState(entities.recepciones[0]?.id || "");
  const receipt = entities.recepciones.find((row) => row.id === receiptId);
  const [volunteerId, setVolunteerId] = useState("");
  const selectedVolunteerId = volunteerId || entities.voluntarios.find(person => person.name === receipt?.volunteer)?.id || entities.voluntarios[0]?.id || "";
  const [products, setProducts] = useState([{ id: 1, name: e?.products || "", quantity: e?.weight?.replace(" kg", "") || "", unit: "KG", expiry: "", cold: "Refrigerado" }]);
  const updateProduct = (id: number, field: string, value: string) => setProducts(current => current.map(product => product.id === id ? { ...product, [field]: value } : product));
  return (
    <PrototypeForm>
      {module === "usuarios" ? (
        <>
          <Field
            label="Nombre completo *"
            defaultValue={e?.name}
            placeholder="Ej. Ana Torres"
          />
          <Field
            label="Correo electrónico *"
            type="email"
            defaultValue={e?.email}
            placeholder="usuario@findfood.org"
          />
          <Field
            label="Teléfono"
            type="tel"
            defaultValue={e?.phone}
            placeholder="+57 300 155 4567"
          />
          <Select label="Rol *" defaultValue={e?.role || ""}>
            <option value="">Selecciona un rol</option>
            {["Administrador", "Asesor", "Voluntario", "Donante"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
          <Select label="Estado" defaultValue={e?.status || "Activo"}>
            <option>Activo</option>
            <option>Inactivo</option>
          </Select>
          <label className="field">
            <span>Notas</span>
            <textarea placeholder="Notas adicionales sobre el usuario…" />
          </label>
        </>
      ) : module === "almacenes" ? (
        <>
          <Field
            label="Nombre del almacén *"
            defaultValue={e?.name}
            placeholder="Ej. Cámara refrigerada 3"
          />
          <Field label="Código *" defaultValue={e?.id} placeholder="ALM-007" />
          <Select label="Régimen térmico *" defaultValue={e?.regime || ""}>
            <option value="">Seleccionar</option>
            {["Seco", "Refrigerado"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
          <Field
            label="Capacidad máxima *"
            defaultValue={e?.capacity}
            placeholder="Ej. 1200 kg"
          />
          <Select label="Responsable *" defaultValue={e?.owner || ""}>
            <option value="">Seleccionar usuario</option>
            {[
              "Ana Martínez",
              "Laura Gómez",
              "Carlos Ruiz",
              "Diana Rojas",
              "Juan Morales",
              "Sofía López",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
          <Field
            label="Ubicación / dirección *"
            placeholder="Ej. Bodega norte · Nivel 1"
          />
          <Select label="Estado" defaultValue={e?.status || "Activo"}>
            <option>Activo</option>
            <option>Inactivo</option>
          </Select>
        </>
      ) : module === "recepciones" ? (
        <>
          <Select
            label="Donación"
            value={receiptId}
            onChange={(event) => { setReceiptId(event.target.value); setVolunteerId(""); }}
          >
            {entities.recepciones.map((row) => (
              <option key={row.id} value={row.id}>
                {row.donation} · {row.name}
              </option>
            ))}
          </Select>
          <Select label="Voluntario" value={selectedVolunteerId} onChange={event => setVolunteerId(event.target.value)}>
            {entities.voluntarios.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
          <Field
            label="Hora de llegada"
            value={receipt?.arrival || ""}
            readOnly
          />
          <LinkButton to={`#/recepcion?id=${encodeURIComponent(receiptId)}&voluntario=${encodeURIComponent(selectedVolunteerId)}`}>
            Revisar recepción de ejemplo
          </LinkButton>
        </>
      ) : (
        <>
          <Field
            label="Donante *"
            defaultValue={e?.name}
            placeholder="Nombre del donante"
          />
          {products.map((product, index) => <fieldset className="donation-product" key={product.id}>
            <legend>Producto {index + 1}</legend>
            <Field label="Producto *" value={product.name} onChange={event => updateProduct(product.id, "name", event.target.value)} placeholder="Ej. Lácteos" />
            <div className="form-row">
              <Field label="Cantidad / peso *" type="number" min="0" value={product.quantity} onChange={event => updateProduct(product.id, "quantity", event.target.value)} />
              <Select label="Unidad" value={product.unit} onChange={event => updateProduct(product.id, "unit", event.target.value)}>{["KG", "L", "ML", "G"].map(unit => <option key={unit}>{unit}</option>)}</Select>
            </div>
            <Field label="Fecha de vencimiento" type="date" value={product.expiry} onChange={event => updateProduct(product.id, "expiry", event.target.value)} />
            <Select label="Cadena de frío" value={product.cold} onChange={event => updateProduct(product.id, "cold", event.target.value)}><option>Refrigerado</option><option>No requiere</option></Select>
            <Photo label="Fotografía del producto" />
            <button type="button" className="button secondary" disabled={products.length === 1} aria-label={`Quitar producto ${index + 1}`} onClick={() => setProducts(current => current.filter(item => item.id !== product.id))}>Quitar producto</button>
          </fieldset>)}
          <button type="button" className="button secondary" onClick={() => setProducts(current => [...current, { id: Math.max(...current.map(product => product.id)) + 1, name: "", quantity: "", unit: "KG", expiry: "", cold: "No requiere" }])}>Añadir otro producto</button>
          <div className="form-row">
            <Field label="Recogida desde" type="time" defaultValue="16:00" />
            <Field label="Hasta" type="time" defaultValue="18:00" />
          </div>
          <Field label="Ubicación" placeholder="Dirección de recogida" />
        </>
      )}
      <p className="muted small">
        Formulario de demostración. Los cambios no se guardan.
      </p>
    </PrototypeForm>
  );
}
