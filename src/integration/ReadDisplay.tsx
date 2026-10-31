import { useRead } from "./read";
import type { Row } from "./actions";
import { textValue, fieldLabel, fieldValue, readingUrl } from "./read-format";
import { EvidenceImage } from "./EvidenceImage";
import { useSession } from "./session-context";
import { advisorDetails } from "./advisor-display";
export function DataDetails({
  value,
  depth = 0,
  collection = "",
}: {
  value: unknown;
  depth?: number;
  collection?: string;
}) {
  const profile = useSession()?.profile;
  if (profile?.roles.includes("ASESOR_BANCO") && !profile.roles.includes("ADMIN")) value = advisorDetails(value, collection);
  if (value == null) return <p>No hay información disponible.</p>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="detail-records">
        {value.map((item, index) => {
          const noun = ["items", "productos"].includes(collection)
            ? "Producto"
            : collection === "paradas"
              ? "Parada"
              : "Registro";
          const title = `${noun} ${index + 1}`;
          return (
            <section className="detail-record" aria-label={title} key={index}>
              <h4>{title}</h4>
              <DataDetails value={item} depth={depth + 1} collection={collection} />
            </section>
          );
        })}
      </div>
    ) : (
      <p>Sin registros.</p>
    );
  if (typeof value !== "object") return <p>{textValue(value)}</p>;
  const entries = Object.entries(value as Row);
  const fields = entries.filter(
    ([, item]) => item === null || typeof item !== "object",
  );
  const groups = entries.filter(
    ([, item]) => item !== null && typeof item === "object",
  );
  if (!entries.length) return <p>Sin información.</p>;
  return (
    <div className="detail-content">
      {fields.length > 0 && (
        <table
          className="detail-table"
          aria-label={depth ? "Datos del registro" : "Información general"}
        >
          <thead>
            <tr>
              <th scope="col">Campo</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([key, item]) => (
              <tr key={key}>
                <th scope="row">{fieldLabel(key)}</th>
                <td>
                  {((collection === "documentos" &&
                    ["frente", "reverso", "selfie"].includes(key)) || [
                    "foto_url",
                    "url_foto_vehiculo",
                    "url_lectura",
                    "url_documento_frente",
                    "url_documento_reverso",
                    "url_selfie",
                  ].includes(key)) ? (
                    readingUrl(item) ? (
                      <EvidenceImage
                        key={String(item)}
                        url={readingUrl(item)!}
                        label={fieldLabel(key)}
                      />
                    ) : (
                      <span>Sin enlace de lectura disponible.</span>
                    )
                  ) : typeof item === "string" && /^https?:\/\//.test(item) ? (
                    <a href={item} target="_blank" rel="noreferrer">
                      Abrir {fieldLabel(key).toLowerCase()}
                    </a>
                  ) : (
                    fieldValue(key, item)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {groups.map(([key, item]) => (
        <section
          className="detail-group"
          key={key}
          aria-label={fieldLabel(key)}
        >
          <h3>{fieldLabel(key)}</h3>
          <DataDetails value={item} depth={depth + 1} collection={key} />
        </section>
      ))}
    </div>
  );
}
export function ReadBody({
  endpoint,
  read: provided,
  transform,
}: {
  endpoint: string;
  transform?: (value: unknown) => unknown;
  read?: {
    data?: unknown;
    error?: string;
    loading: boolean;
    refresh: () => void;
  };
}) {
  const ownRead = useRead<unknown>(provided ? null : endpoint);
  const read = provided || ownRead;
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
  return <DataDetails value={transform ? transform(read.data) : read.data} />;
}
