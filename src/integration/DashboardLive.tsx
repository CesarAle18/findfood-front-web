import { useEffect, useState } from "react";
import { Card, Metrics } from "../components/ui";
import type { Kpis } from "./contracts";
import { dashboardService } from "./services";
import { errorMessage } from "./http";
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
  const [data, setData] = useState<Kpis | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    dashboardService
      .get(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [attempt]);
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
      <InventorySummary />
      <Card title="Recepciones por almacén">
        <p>
          Periodo: {new Date(data.desde).toLocaleDateString("es-CO")} a{" "}
          {new Date(data.hasta).toLocaleDateString("es-CO")}
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
