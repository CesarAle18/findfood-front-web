import { useEffect, useState } from "react";
import { Card, Metrics } from "../components/ui";
import type { Kpis } from "./contracts";
import { apiRequest, errorMessage } from "./http";
import { useRead } from "./read";

interface WarehouseStock {
  id: string;
  nombre: string;
  kg_en_inventario: number | string;
}

function InventorySummary() {
  // El servicio agrega todos los lotes de cada almacén, sin paginación ni filtro de fechas.
  const read = useRead<WarehouseStock[]>("/almacenes");
  const warehouses = read.data;
  const invalid = warehouses?.some(
    (warehouse) =>
      warehouse.kg_en_inventario == null ||
      String(warehouse.kg_en_inventario).trim() === "" ||
      !Number.isFinite(Number(warehouse.kg_en_inventario)),
  );
  const total = warehouses?.reduce(
    (sum, warehouse) => sum + Number(warehouse.kg_en_inventario),
    0,
  );
  const formatKg = (weight: number) =>
    `${weight.toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`;
  return (
    <Card title="Inventario actual">
      <p>
        Existencias disponibles y reservadas de todos los almacenes, sin filtro
        de fechas.
      </p>
      {read.loading ? (
        <p role="status">Cargando inventario…</p>
      ) : read.error || invalid ? (
        <div className="form-stack">
          <p role="alert">
            {read.error ||
              "El servicio no devolvió un peso válido para todos los almacenes."}
          </p>
          <button className="button secondary" onClick={read.refresh}>
            Reintentar inventario
          </button>
        </div>
      ) : (
        warehouses && (
          <>
            <p className="inventory-total">
              Total en inventario <strong>{formatKg(total!)}</strong>
            </p>
            <div className="table-scroll">
              <table aria-label="Inventario por almacén">
                <thead>
                  <tr>
                    <th scope="col">Almacén</th>
                    <th scope="col">Peso en inventario</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((warehouse) => (
                    <tr key={warehouse.id}>
                      <td>{warehouse.nombre}</td>
                      <td>{formatKg(Number(warehouse.kg_en_inventario))}</td>
                    </tr>
                  ))}
                  {!warehouses.length && (
                    <tr>
                      <td colSpan={2}>No hay almacenes registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <a className="button secondary" href="#/inventario">
              Ver inventario
            </a>
          </>
        )
      )}
    </Card>
  );
}
export function DashboardLive() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState("");
  return <div className="form-stack"><Card><form className="audit-filters dashboard-period" onSubmit={(event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("desde", new Date(`${from}T00:00:00-05:00`).toISOString());
    if (to) params.set("hasta", new Date(Date.parse(`${to}T00:00:00-05:00`) + 86400000).toISOString());
    setRange(params.toString());
  }}><label>Desde<input type="date" aria-label="Indicadores desde" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label><label>Hasta<input type="date" aria-label="Indicadores hasta" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label><button className="button" type="submit">Consultar periodo</button><button className="button secondary" type="button" onClick={() => { setFrom(""); setTo(""); setRange(""); }}>Últimos 30 días</button></form></Card><DashboardSummary key={range} range={range} /><Card title="Operación del banco"><div className="card-actions"><a className="button secondary" href="#/alertas">Consultar alertas</a></div></Card></div>;
}
function DashboardSummary({ range }: { range: string }) {
  const [data, setData] = useState<Kpis | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Kpis>(`/kpis/resumen${range ? `?${range}` : ""}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [attempt, range]);
  useEffect(() => {
    const refresh = () => setAttempt((n) => n + 1);
    window.addEventListener("findfood:data-changed", refresh);
    return () => window.removeEventListener("findfood:data-changed", refresh);
  }, []);
  if (error)
    return (
      <Card title="No fue posible cargar el resumen">
        <p role="alert">{error}</p>
        <button
          className="button"
          onClick={() => {
            setError("");
            setData(null);
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </button>
      </Card>
    );
  if (!data)
    return (
      <Card>
        <p role="status">Cargando indicadores…</p>
      </Card>
    );
  return (
    <>
      <Metrics
        items={[
          [
            "Donaciones creadas",
            String(data.donaciones.creadas),
            "Periodo consultado",
          ],
          [
            "Donaciones recibidas",
            String(data.donaciones.recibidas),
            "Periodo consultado",
          ],
          [
            "Alimentos recuperados",
            `${data.donaciones.kg_recuperados.toLocaleString("es-CO")} kg`,
            "Peso recibido en el periodo",
          ],
          [
            "Aceptación de ofertas",
            data.asignacion.tasa_aceptacion === null
              ? "Sin datos"
              : `${(data.asignacion.tasa_aceptacion * 100).toFixed(1)} %`,
            `${data.asignacion.ofertas} ofertas`,
          ],
        ]}
      />
      <details className="dashboard-extra"><summary>Ver indicadores adicionales</summary>
      <Metrics items={[
        ["Tasa de expiración", data.asignacion.tasa_expiracion == null ? "Sin datos" : `${(data.asignacion.tasa_expiracion * 100).toFixed(1)} %`, "Sobre donaciones publicadas"],
        ["Ofertas por donación", data.asignacion.ofertas_por_donacion == null ? "Sin datos" : data.asignacion.ofertas_por_donacion.toFixed(2), "Promedio del periodo"],
        ["Merma y vencimiento", `${data.inventario.kg_merma.toLocaleString("es-CO")} kg`, "Salidas del periodo"],
      ]} />
      <Card title="Donaciones por estado"><div className="table-scroll"><table aria-label="Donaciones por estado"><thead><tr><th>Estado</th><th>Cantidad</th></tr></thead><tbody>{([ ["Publicadas", "publicadas"], ["Recibidas", "recibidas"], ["Rechazadas", "rechazadas"], ["Expiradas", "expiradas"], ["Canceladas", "canceladas"] ] as const).map(([label, key]) => <tr key={key}><td>{label}</td><td>{data.donaciones[key] ?? "—"}</td></tr>)}</tbody></table></div><p className="muted">Publicadas cuenta las donaciones creadas en el periodo que llegaron a publicarse; los otros estados corresponden a su estado actual para las donaciones creadas en el periodo.</p></Card>
      </details>
      <InventorySummary />
      <Card title="Recepciones por almacén">
        <p>
          Periodo: {new Date(data.desde).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })} a{" "}
          {new Date(data.hasta).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Almacén</th>
                <th>Recepciones</th>
                <th>Kg recibidos</th>
                <th>Kg rechazados</th>
              </tr>
            </thead>
            <tbody>
              {data.por_sede.map((sede) => (
                <tr key={sede.id}>
                  <td>{sede.nombre}</td>
                  <td>{sede.recepciones}</td>
                  <td>{sede.kg_recibidos}</td>
                  <td>{sede.kg_rechazados}</td>
                </tr>
              ))}
              {!data.por_sede.length && (
                <tr>
                  <td colSpan={4}>
                    Sin datos de recepciones por almacén para este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}





