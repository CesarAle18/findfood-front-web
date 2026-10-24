import { useRef, useState } from "react";
import { apiRequest, errorMessage } from "./http";
export type EvidenceParent = "donacion_id" | "parada_id" | "recepcion_id" | "incidencia_id";
type PendingEvidence = { id: string; ruta: string; capturada_at: string; mime_type: string; tamano_bytes: number; tipo: string };
export function EvidenceUpload({ parent, id, type, onSaved }: { parent: EvidenceParent; id: string; type: string; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<PendingEvidence | null>(null);
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    let record = pending;
    try {
      if (!record) {
        const file = input.current?.files?.[0];
        if (!file) throw new Error("Selecciona una fotografía.");
        const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
        const extension = extensions[file.type];
        if (!extension) throw new Error("Usa una imagen JPG, PNG, WebP o HEIC.");
        if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("La fotografía debe pesar entre 1 byte y 25 MB.");
        const upload = await apiRequest<{ ruta: string; url_subida: string }>("/evidencias/upload-url", { method: "POST", body: JSON.stringify({ proposito: "EVIDENCIA", extension }) });
        const response = await fetch(upload.url_subida, { method: "PUT", headers: { "Content-Type": file.type }, body: file, signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error("No se pudo subir la fotografía. Intenta nuevamente.");
        record = { id: crypto.randomUUID(), ruta: upload.ruta, capturada_at: new Date().toISOString(), tipo: type, mime_type: file.type, tamano_bytes: file.size };
        setPending(record);
      }
      await apiRequest("/evidencias", { method: "POST", body: JSON.stringify({ ...record, [parent]: id }) });
      setPending(null);
      if (input.current) input.current.value = "";
      setMessage("Evidencia registrada."); onSaved();
      window.dispatchEvent(new Event("findfood:data-changed"));
    } catch (e) { setError(errorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="form-stack evidence-upload"><label>Fotografía de evidencia<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" disabled={busy || Boolean(pending)} /></label>{pending && <p>La fotografía ya se subió. Reintenta para completar su registro.</p>}<button className="button secondary" disabled={busy} onClick={() => void save()}>{busy ? "Guardando evidencia…" : pending ? "Reintentar registro de evidencia" : "Adjuntar evidencia"}</button>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}</div>;
}
