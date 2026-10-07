import { useEffect, useState } from "react";
import { Card, Metrics } from "../components/ui";
import type { Kpis } from "./contracts";
import { dashboardService } from "./services";
import { errorMessage } from "./http";
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
            "Peso recibido",
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
                  <td colSpan={4}>No hay almacenes registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
