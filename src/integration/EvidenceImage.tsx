import { useState } from "react";

export function EvidenceImage({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const simulated = new URL(url).hostname === "storage.simulado";
  return (
    <div className="evidence-image">
      {simulated ? (
        <p role="status">
          La API está usando almacenamiento simulado. Este enlace no contiene
          una imagen real.
        </p>
      ) : (
        <>
          {!failed && (
            <img
              src={url}
              alt={label}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          )}
          {failed && (
            <p role="status">
              No se pudo mostrar la imagen. El enlace puede haber vencido o el
              formato no admite vista previa. Actualiza la consulta para volver
              a intentarlo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
