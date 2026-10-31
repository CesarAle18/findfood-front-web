import { useRef, useState } from "react";
import { Badge, Card, Field } from "../components/ui";
import { useRead } from "./read";
import { apiRequest, errorMessage } from "./http";
interface Parameter {
  clave: string;
  valor: string;
}
const criteria = [
  [
    "PESO_PROXIMIDAD",
    "Proximidad",
    "Prioriza voluntarios más cercanos al punto de recogida.",
  ],
  [
    "PESO_URGENCIA",
    "Urgencia",
    "Da mayor peso a donaciones con menor tiempo disponible.",
  ],
  [
    "PESO_CONFIABILIDAD",
    "Confiabilidad",
    "Considera el historial de asignaciones completadas.",
  ],
  [
    "PESO_HOLGURA",
    "Holgura de carga",
    "Evalúa qué tan bien se ajusta la carga al vehículo.",
  ],
];
export function AssignmentSettings() {
  const read = useRead<Parameter[]>("/admin/parametros");
  if (read.loading)
    return (
      <Card>
        <p role="status">Cargando configuración de asignación…</p>
      </Card>
    );
  if (read.error)
    return (
      <Card>
        <p className="integration-error" role="alert">
          {read.error}
        </p>
        <button className="button" onClick={read.refresh}>
          Reintentar
        </button>
      </Card>
    );
  const rows = read.data || [];
  const keys = [...criteria.map(([key]) => key), "MAX_PARADAS_POR_RUTA"];
  if (keys.some((key) => !rows.some((row) => row.clave === key)))
    return (
      <Card>
        <p role="alert">
          Faltan parámetros de asignación en la API. Revisa la configuración
          inicial del sistema.
        </p>
        <button className="button secondary" onClick={read.refresh}>
          Reintentar
        </button>
      </Card>
    );
  return <AssignmentEditor initial={rows} />;
}
function AssignmentEditor({ initial }: { initial: Parameter[] }) {
  const initialValues = () => ({
    weights: criteria.map(
      ([key]) =>
        Math.round(
          Number(initial.find((row) => row.clave === key)!.valor) * 10000,
        ) / 100,
    ),
    stops: Number(
      initial.find((row) => row.clave === "MAX_PARADAS_POR_RUTA")!.valor,
    ),
  });
  const [baseline, setBaseline] = useState(initialValues),
    [weights, setWeights] = useState(() => initialValues().weights.map(Math.round)),
    [stops, setStops] = useState(() => Math.max(2, initialValues().stops));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const total =
    weights.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
  const valid =
    total === 100 &&
    weights.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 100,
    ) &&
    Number.isInteger(stops) &&
    stops >= 2 &&
    stops <= 5;
  const dirty =
    stops !== baseline.stops ||
    weights.some((value, index) => value !== baseline.weights[index]);
  const update = (index: number, value: number) => {
    setSaved(false);
    setError("");
    setWeights((previous) =>
      previous.map((old, i) => (i === index ? value : old)),
    );
  };
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || !valid || !dirty) return;
        lock.current = true;
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          const valores = [
            ...criteria.map(([clave], index) => ({
              clave,
              valor: (weights[index] / 100).toFixed(4),
            })),
            { clave: "MAX_PARADAS_POR_RUTA", valor: String(stops) },
          ];
          const result = await apiRequest<Parameter[]>("/admin/parametros", {
            method: "PUT",
            body: JSON.stringify({ valores }),
          });
          const next = {
            weights: criteria.map(
              ([key]) =>
                Math.round(
                  Number(result.find((row) => row.clave === key)!.valor) *
                    10000,
                ) / 100,
            ),
            stops: Number(
              result.find((row) => row.clave === "MAX_PARADAS_POR_RUTA")!.valor,
            ),
          };
          setBaseline(next);
          setWeights(next.weights);
          setStops(next.stops);
          setSaved(true);
          window.dispatchEvent(new Event("findfood:data-changed"));
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <div className="two-column assignment-layout">
        <Card title="Criterios del motor de asignación">
          <p className="muted">
            Configura la importancia de cada criterio con porcentajes enteros.
            <br />
            En la interfaz se muestran como porcentajes y deben sumar 100%.
          </p>
          {criteria.map(([, name, description], index) => (
            <div className="weight" key={name}>
              <strong>{name}</strong>
              <p>{description}</p>
              <div className="weight-control">
                <input
                  aria-label={`${name} en porcentaje`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  disabled={busy}
                  value={Number.isFinite(weights[index]) ? weights[index] : 0}
                  onChange={(e) => update(index, Number(e.target.value))}
                />
                <Field
                  label={`${name} (%)`}
                  aria-label={`${name} (%)`}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  disabled={busy}
                  value={Number.isFinite(weights[index]) ? weights[index] : ""}
                  onChange={(e) =>
                    update(
                      index,
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>
          ))}
          <div className={`total ${valid ? "" : "invalid"}`}>
            <strong>Total configurado</strong>
            <span>
              {Number.isFinite(total)
                ? `${total}%`
                : "—"}
            </span>
            <Badge>
              {valid ? "Configuración válida" : "Ajusta la suma a 100%"}
            </Badge>
          </div>
        </Card>
        <div className="stack">
          <Card title="Cómo funciona" className="soft">
            <p>Cada criterio acepta un porcentaje entero entre 0 y 100.</p>
            <p>Por ejemplo:</p>
            <p>
              <b>Proximidad: 30%</b>
              <br />
              <b>Confiabilidad: 25%</b>
            </p>
            <p>
              La suma de los cuatro criterios debe ser 100% para mantener una
              ponderación consistente.
            </p>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setWeights([30, 30, 25, 15]);
                setSaved(false);
                setError("");
              }}
            >
              Restablecer valores predeterminados
            </button>
          </Card>
          <Card title="Rutas y paradas">
            <h3>Máximo de paradas por voluntario</h3>
            <p className="muted">
              Define cuántas recogidas puede contener una ruta.
            </p>
            <div className="stepper">
              <button
                type="button"
                aria-label="Disminuir paradas"
                disabled={busy || stops <= 2}
                onClick={() => {
                  setStops((n) => Math.max(2, n - 1));
                  setSaved(false);
                }}
              >
                −
              </button>
              <output aria-label="Máximo de paradas">{stops}</output>
              <button
                type="button"
                aria-label="Aumentar paradas"
                disabled={busy || stops >= 5}
                onClick={() => {
                  setStops((n) => Math.min(5, n + 1));
                  setSaved(false);
                }}
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
      {error && (
        <p role="alert" className="integration-error">
          {error}
        </p>
      )}
      {saved && <p role="status">Configuración guardada.</p>}
      <div className="save-bar">
        <div>
          <strong>
            {dirty ? "Cambios pendientes" : "Sin cambios pendientes"}
          </strong>
          <p>
            Los nuevos parámetros se aplicarán a las próximas asignaciones y
            rutas.
          </p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy || !dirty}
          onClick={() => {
            setWeights(baseline.weights.map(Math.round));
            setStops(Math.max(2, baseline.stops));
            setError("");
            setSaved(false);
          }}
        >
          Cancelar
        </button>
        <button
          className="button"
          type="submit"
          disabled={busy || !valid || !dirty}
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
