import type { AuditEntry } from "./audit";
import { auditAction, auditDescription, auditValues } from "./audit-presentation";
import { DataDetails } from "./ReadDisplay";

export function AuditDetails({ entry }: { entry: AuditEntry }) {
  const { valores_anteriores, valores_nuevos, ...details } = entry.detalles ?? {};
  return <div className="form-stack">
    <DataDetails value={{ fecha: entry.fecha, actor: entry.actor, roles: entry.roles?.join(", ") || "Sistema", modulo: entry.modulo, accion: auditAction(entry.accion), descripcion: auditDescription(entry), ...auditValues(details) as object }} />
    {([ ["Valores anteriores", valores_anteriores], ["Valores nuevos", valores_nuevos] ] as const).map(([title, raw]) => {
      if (raw === undefined) return null;
      const value = auditValues(raw);
      return <section key={title} aria-label={title}><h3>{title}</h3>{value == null ? <p>Sin valores registrados.</p> : <DataDetails value={value} />}</section>;
    })}
  </div>;
}
