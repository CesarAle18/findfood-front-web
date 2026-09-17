import { useState } from "react";
import {
  Badge,
  Card,
  DemoButton,
  Details,
  Field,
  Icon,
  LinkButton,
  MapPreview,
  Metrics,
  Photo,
  Select,
} from "../components/ui";
import { useData } from "../state/data-context";
import { href } from "../state/navigation";

export function Dashboard() {
  const values = [115, 145, 120, 185, 150, 205, 240];
  return (
    <>
      <Metrics
        items={[
          ["Donaciones activas", "28", "+12% esta semana"],
          ["Kilos recuperados", "1.245 kg", "+8% esta semana"],
          ["Recogidas completadas", "18", "+5% esta semana"],
          ["Voluntarios activos", "32", "7 disponibles"],
        ]}
      />
      <div className="dashboard-grid">
        <Card
          title="Recuperación de alimentos"
          action={<span className="muted small">Últimos 7 días</span>}
        >
          <div className="chart">
            <svg
              viewBox="0 0 680 230"
              role="img"
              aria-label="Kilos recuperados en siete días: 115, 145, 120, 185, 150, 205, 240"
            >
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1f7a5a" stopOpacity=".2" />
                  <stop offset="100%" stopColor="#1f7a5a" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[50, 100, 150, 200].map((y) => (
                <line key={y} x1="20" y1={y} x2="660" y2={y} stroke="#e6ede8" />
              ))}
              <path
                d={`M20 210 ${values.map((v, i) => `L${20 + i * 106} ${210 - v * 0.7}`).join(" ")} L656 210Z`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={values
                  .map((v, i) => `${20 + i * 106},${210 - v * 0.7}`)
                  .join(" ")}
                fill="none"
                stroke="#1f7a5a"
                strokeWidth="3"
              />
              {values.map((v, i) => (
                <circle
                  key={i}
                  cx={20 + i * 106}
                  cy={210 - v * 0.7}
                  r="4"
                  fill="#fff"
                  stroke="#1f7a5a"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="chart-labels">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </Card>
        <Card
          title="Donaciones prioritarias"
          action={<a href="#/donaciones">Ver todas</a>}
        >
          {[
            ["DON-1048", "Lácteos · vence hoy", "Urgente"],
            ["DON-1047", "Preparados · 4 h restantes", "Alta"],
            ["DON-1046", "Panadería · 8 h restantes", "Media"],
          ].map(([id, detail, urgency]) => (
            <a
              className="priority-row"
              key={id}
              href={href("/donaciones", "detalle", id)}
            >
              <div>
                <strong>{id}</strong>
                <p>{detail}</p>
              </div>
              <Badge>{urgency}</Badge>
            </a>
          ))}
        </Card>
        <Card
          title="Operación en Bogotá"
          action={<a href="#/rutas">Ver rutas</a>}
        >
          <MapPreview />
        </Card>
        <Card title="Actividad reciente">
          {[
            ["15:42", "Recogida completada", "Panadería Delicias"],
            ["15:28", "Oferta aceptada", "Carlos Ruiz · R-045"],
            ["15:05", "Nueva donación", "Supermercado La 14"],
            ["14:54", "Lote ingresado", "INV-00982 · Refrigerado"],
          ].map(([time, title, detail]) => (
            <div className="activity" key={time}>
              <small>{time}</small>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
export function Assignments() {
  const [selected, setSelected] = useState(0);
  const names = ["Carlos Ruiz", "Laura Gómez", "Andrés Peña", "Diana Rojas"];
  return (
    <>
      <Card title="Donación seleccionada">
        <div className="assignment-summary">
          <strong>DON-1048 · Supermercado La 14</strong>
          <span>
            Peso estimado <b>45 kg</b>
          </span>
          <span>
            Refrigeración <b>Requerida</b>
          </span>
          <Badge>Urgente</Badge>
        </div>
      </Card>
      <div className="chips">
        {[
          "Capacidad ≥ 45 kg",
          "Refrigeración: Sí",
          "Disponibilidad: 16:00–18:00",
          "Verificado: Sí",
          "Cercanía ≤ radio",
        ].map((t) => (
          <span key={t}>
            <Icon name="check" size={15} />
            {t}
          </span>
        ))}
      </div>
      <div className="two-column">
        <Card title="Candidatos factibles">
          {names.map((name, i) => (
            <button
              key={name}
              className={`candidate ${selected === i ? "selected" : ""}`}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <span className="rank">{i + 1}</span>
              <span className="candidate-main">
                <strong>{name}</strong>
                <small>
                  {["2,8", "3,4", "4,1", "5,0"][i]} km · confiabilidad{" "}
                  {[98, 95, 92, 96][i]}%
                </small>
                <small>{[120, 80, 100, 70][i]} kg · Refrigerado</small>
              </span>
              <span className="score">
                <small>Puntaje</small>
                <strong>{["0,91", "0,86", "0,78", "0,73"][i]}</strong>
              </span>
            </button>
          ))}
          <div className="card-actions">
            <DemoButton>Ofertar a {names[selected]}</DemoButton>
          </div>
        </Card>
        <div className="stack">
          <Card title="Desglose del puntaje">
            {[
              "Proximidad",
              "Urgencia",
              "Confiabilidad",
              "Holgura de carga",
            ].map((label, i) => (
              <div className="score-line" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>
                    {[95 - selected * 5, 100, 98 - selected, 72][i]}%
                  </strong>
                </div>
                <progress
                  max="100"
                  value={[95 - selected * 5, 100, 98 - selected, 72][i]}
                />
              </div>
            ))}
          </Card>
          <Card title="Oferta en cascada" className="soft">
            <p>
              Si el candidato rechaza o no responde, el sistema pasa
              automáticamente al siguiente.
            </p>
            <Badge>Plazo: 10 min</Badge>
          </Card>
        </div>
      </div>
    </>
  );
}
const routes = [
  { id: "R-045", name: "Carlos Ruiz", stops: 4, status: "En progreso" },
  { id: "R-046", name: "Laura Gómez", stops: 3, status: "Programada" },
  { id: "R-047", name: "Andrés Peña", stops: 5, status: "Programada" },
];
export function Routes() {
  const [selected, setSelected] = useState(0);
  const route = routes[selected];
  return (
    <div className="route-grid">
      <div className="stack">
        <Card title="Rutas del día">
          {routes.map((r, i) => (
            <button
              className={`route-choice ${selected === i ? "selected" : ""}`}
              aria-pressed={selected === i}
              key={r.id}
              onClick={() => setSelected(i)}
            >
              <span>
                <strong>{r.id}</strong>
                <small>
                  {r.name} · {r.stops} paradas
                </small>
              </span>
              <Badge>{r.status}</Badge>
            </button>
          ))}
        </Card>
        <Card title="Resumen">
          <Details
            items={[
              ["Distancia total", "28,4 km"],
              ["Tiempo estimado", "2 h 35 min"],
              ["Peso estimado", "120 kg"],
            ]}
          />
        </Card>
      </div>
      <div className="stack">
        <Card title={`Ruta ${route.id} · seguimiento en tiempo real`}>
          <MapPreview stops={route.stops} />
        </Card>
        <Card title="Paradas">
          {Array.from({ length: route.stops }, (_, i) => (
            <div className="stop" key={i}>
              <span className="rank">{i + 1}</span>
              <div>
                <strong>
                  {
                    [
                      "Supermercado La 14",
                      "Restaurante El Buen Sabor",
                      "Panadería Delicias",
                      "Frutería NutriFresh",
                      "Mercado Central",
                    ][i]
                  }
                </strong>
                <small>
                  {
                    [
                      "08:30–09:00",
                      "09:45–10:15",
                      "11:00–11:30",
                      "12:00–12:30",
                      "13:00–13:30",
                    ][i]
                  }
                </small>
              </div>
              <Badge>
                {selected === 0
                  ? ["Completada", "Completada", "En camino", "Pendiente"][i]
                  : "Pendiente"}
              </Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
export function Pending() {
  const { entities } = useData();
  const applicants = entities.voluntarios.filter(
    (v) => v.status !== "Aprobado",
  );
  return (
    <>
      <div className="section-head">
        <Badge>Todos {applicants.length}</Badge>
        <LinkButton secondary to="#/voluntarios">
          Lista de voluntarios
        </LinkButton>
      </div>
      <div className="applicant-grid">
        {applicants.map((p) => (
          <Card key={p.id}>
            <div className="entity-summary">
              <div className="avatar large">
                {p.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <h2>{p.name}</h2>
                <p>{p.city} · 2,8 km</p>
              </div>
              <a
                href={href("/pendientes", "detalle", p.id)}
                className="icon-button"
                aria-label={`Ver detalle de ${p.name}`}
              >
                <Icon name="eye" />
              </a>
            </div>
            <p>
              {p.vehicle} · {p.capacity} ·{" "}
              {p.cold === "Sí" ? "Refrigerado" : "Sin refrigeración"}
            </p>
            <div className="section-head">
              <span className="muted">Estado</span>
              <Badge>{p.status}</Badge>
            </div>
            <div className="card-actions">
              <DemoButton>Aceptar</DemoButton>
              <DemoButton secondary>Rechazar</DemoButton>
              <a href={href("/pendientes", "detalle", p.id)}>Ver detalle</a>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
export function Reception({ id }: { id: string | null }) {
  const { entities } = useData();
  const row = id
    ? entities.recepciones.find((r) => r.id === id)
    : entities.recepciones[0];
  if (!row)
    return (
      <Card title="Recepción no encontrada">
        <LinkButton to="#/recepciones">Volver</LinkButton>
      </Card>
    );
  return (
    <>
      <Card title="Entrega en recepción">
        <div className="assignment-summary">
          <strong>{row.donation} · Ruta R-045</strong>
          <span>
            Voluntario <b>{row.volunteer}</b>
          </span>
          <span>
            Hora llegada <b>{row.arrival}</b>
          </span>
          <Badge>{row.status}</Badge>
        </div>
      </Card>
      <div className="two-column">
        <div className="stack">
          <Card title="Productos recibidos">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Producto",
                      "Declarado",
                      "Real (kg)",
                      "Vence",
                      "Decisión",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Leche", "15 kg", "14.5", "07/09/26"],
                    ["Yogurt", "10 kg", "9.8", "08/09/26"],
                    ["Frutas", "20 kg", "16", "06/09/26"],
                  ].map(([name, weight, real, expiry], i) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{weight}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          defaultValue={real}
                          aria-label={`Peso real de ${name}`}
                          className="tiny-input"
                        />
                      </td>
                      <td>{expiry}</td>
                      <td>
                        <select
                          aria-label={`Decisión para ${name}`}
                          defaultValue={i === 2 ? "Parcial" : "Aceptar"}
                        >
                          <option>Aceptar</option>
                          <option>Parcial</option>
                          <option>Rechazar</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Observaciones">
            <textarea
              aria-label="Observaciones"
              defaultValue="La caja de frutas presenta daño parcial. Se aceptan 16 kg y se rechazan 4 kg."
            />
          </Card>
          <Card title="Resultado de la recepción">
            <Select label="Resultado">
              <option>Aceptar parcial</option>
              <option>Aceptar todo</option>
              <option>Rechazar</option>
            </Select>
            <Select label="Almacén">
              <option>Cámara refrigerada 1</option>
              <option>Bodega seca principal</option>
            </Select>
            <div className="card-actions">
              <LinkButton to="#/recepciones" secondary>
                Volver
              </LinkButton>
              <DemoButton>Confirmar recepción</DemoButton>
            </div>
          </Card>
        </div>
        <Card title="Evidencia georreferenciada">
          <Photo />
          <Details
            items={[
              ["Ubicación", "Bogotá D.C. · 4.65, -74.06"],
              ["Marca de tiempo", "05/09/2026 · " + row.arrival],
              ["Responsable", "Ana Morales"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
export function Settings() {
  const [weights, setWeights] = useState([30, 30, 25, 15]);
  const [stops, setStops] = useState(5);
  const total = weights.reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="tabs">
        <span className="active">Asignación</span>
      </div>
      <div className="two-column">
        <Card title="Criterios del motor de asignación">
          <p className="muted">
            Configura la importancia relativa de cada criterio entre 0 y 1. En
            la interfaz se muestran como porcentajes y deben sumar 100%.
          </p>
          {[
            [
              "Proximidad",
              "Prioriza voluntarios más cercanos al punto de recogida.",
            ],
            [
              "Urgencia",
              "Da mayor peso a donaciones con menor tiempo disponible.",
            ],
            [
              "Confiabilidad",
              "Considera el historial de asignaciones completadas.",
            ],
            [
              "Holgura de carga",
              "Evalúa qué tan bien se ajusta la carga al vehículo.",
            ],
          ].map(([name, detail], i) => (
            <div className="weight" key={name}>
              <div>
                <strong>{name}</strong>
                <p>{detail}</p>
              </div>
              <div className="weight-control">
                <input
                  aria-label={`${name} en porcentaje`}
                  type="range"
                  min="0"
                  max="100"
                  value={weights[i]}
                  onChange={(e) =>
                    setWeights((w) =>
                      w.map((v, j) => (i === j ? Number(e.target.value) : v)),
                    )
                  }
                />
                <output>
                  {weights[i]}% <small>{(weights[i] / 100).toFixed(2)}</small>
                </output>
              </div>
            </div>
          ))}
          <div className={`total ${total !== 100 ? "invalid" : ""}`}>
            <strong>Total configurado</strong>
            <span>
              {total}% · {(total / 100).toFixed(2)}
            </span>
            <Badge>
              {total === 100 ? "Configuración válida" : "Ajusta la suma a 100%"}
            </Badge>
          </div>
          <button
            className="text-button"
            onClick={() => setWeights([30, 30, 25, 15])}
          >
            Restablecer valores predeterminados
          </button>
        </Card>
        <div className="stack">
          <Card title="Cómo funciona" className="soft">
            <p>
              Cada criterio acepta un valor entre 0 y 1. En la interfaz se
              muestra como porcentaje:
            </p>
            <p>
              <b>0.30 = 30%</b>
              <br />
              <b>0.25 = 25%</b>
            </p>
            <p>
              La suma de los cuatro criterios debe ser 1.00 para mantener una
              ponderación consistente.
            </p>
          </Card>
          <Card title="Rutas y paradas">
            <h3>Máximo de paradas por voluntario</h3>
            <p className="muted">
              Define cuántas recogidas puede contener una ruta.
            </p>
            <div className="stepper">
              <button
                aria-label="Disminuir paradas"
                disabled={stops === 1}
                onClick={() => setStops((n) => Math.max(1, n - 1))}
              >
                −
              </button>
              <output>{stops}</output>
              <button
                aria-label="Aumentar paradas"
                onClick={() => setStops((n) => n + 1)}
              >
                +
              </button>
            </div>
            <p>
              Valor actual: <b>{stops} paradas máximas</b>
            </p>
            <p className="muted">
              Este límite se aplica al agrupar donaciones compatibles dentro de
              una misma ruta.
            </p>
          </Card>
        </div>
      </div>
      <div className="save-bar">
        <div>
          <strong>Cambios pendientes</strong>
          <p>
            Los nuevos parámetros se aplicarán a las próximas asignaciones y
            rutas.
          </p>
        </div>
        <LinkButton to="#/inicio" secondary>
          Cancelar
        </LinkButton>
        <DemoButton>Guardar cambios</DemoButton>
      </div>
    </>
  );
}
export function Password({ recovery = false }: { recovery?: boolean }) {
  return (
    <div className="two-column">
      <Card title="Seguridad de la cuenta">
        <div className="form-stack">
          {!recovery && (
            <Field
              label="Contraseña actual *"
              type="password"
              placeholder="Ingresa tu contraseña actual"
              autoComplete="current-password"
            />
          )}
          <Field
            label="Nueva contraseña *"
            type="password"
            placeholder="Ingresa tu nueva contraseña"
            autoComplete="new-password"
          />
          <Field
            label="Confirmar nueva contraseña *"
            type="password"
            placeholder="Confirma tu nueva contraseña"
            autoComplete="new-password"
          />
          <div className="card-actions">
            <LinkButton to={recovery ? "#/login" : "#/inicio"} secondary>
              Cancelar
            </LinkButton>
            <DemoButton>Actualizar contraseña</DemoButton>
          </div>
        </div>
      </Card>
      <div className="stack">
        <Card title="Requisitos de contraseña">
          <ul className="check-list">
            {[
              "Mínimo 8 caracteres",
              "Una letra mayúscula",
              "Una letra minúscula",
              "Un número",
              "Un carácter especial",
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
        <Card title="Consejo de seguridad" className="soft">
          <p>
            Evita reutilizar contraseñas de otros servicios. El cambio quedará
            registrado en auditoría.
          </p>
        </Card>
      </div>
    </div>
  );
}
