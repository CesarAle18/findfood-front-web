import { useRead } from "./read";
import { DataDetails } from "./ReadDisplay";
import { EvidenceImage } from "./EvidenceImage";
import type { Row } from "./actions";
import { textValue, readingUrl } from "./read-format";

export function EvidencePanel({
  parent,
  id,
}: {
  parent: "donacion_id" | "parada_id" | "recepcion_id" | "incidencia_id";
  id: string;
}) {
  const read = useRead<Row[]>(
    `/evidencias?${parent}=${encodeURIComponent(id)}`,
  );
  return (
    <section
      className="form-stack evidence-panel"
      aria-label="Evidencias registradas"
    >
      <div className="evidence-toolbar">
        <h3>Evidencias</h3>
        <button
          type="button"
          className="button secondary"
          onClick={read.refresh}
        >
          Actualizar enlaces
        </button>
      </div>
      {read.loading ? (
        <p role="status">Cargando evidencias…</p>
      ) : read.error ? (
        <p role="alert" className="integration-error">
          {read.error}
        </p>
      ) : !Array.isArray(read.data) ? (
        <p role="alert">La API no devolvió una lista válida de evidencias.</p>
      ) : read.data.length === 0 ? (
        <>
          <p>No hay evidencias registradas para este registro.</p>
          {parent === "donacion_id" && (
            <p>
              Las fotos de los productos se consultan en Productos del detalle.
            </p>
          )}
        </>
      ) : (
        <div className="detail-records">
          {read.data.map((row, index) => {
            const url = readingUrl(row.url_lectura);
            const metadata = Object.fromEntries(
              Object.entries(row).filter(([key]) => key !== "url_lectura"),
            );
            return (
              <section
                className="detail-record"
                key={String(row.id ?? index)}
                aria-label={`Evidencia ${index + 1}`}
              >
                <h4>
                  Evidencia {index + 1} · {textValue(row.tipo)}
                </h4>
                {url ? (
                  <EvidenceImage
                    key={url}
                    url={url}
                    label={`Evidencia ${index + 1}`}
                  />
                ) : (
                  <p role="status">
                    La evidencia está registrada, pero su enlace de lectura no
                    está disponible. Pulsa Actualizar enlaces para volver a
                    consultarla.
                  </p>
                )}
                <DataDetails value={metadata} />
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}


