import { useState } from "react";
import { Card, Drawer } from "../components/ui";
import type { AuditEntry } from "./audit";
import { textValue } from "./read-format";
import { DataDetails } from "./ReadDisplay";
import { useRead } from "./read";
import { loadGlobalAudit } from "./audit-read";
import { auditAction, auditDescription } from "./audit-presentation";

export function AuditLive() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [actor, setActor] = useState("");
  const [role, setRole] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const params = new URLSearchParams();
  if (from) params.set("desde", new Date(`${from}T00:00:00-05:00`).toISOString());
  if (to) params.set("hasta", new Date(Date.parse(`${to}T00:00:00-05:00`) + 86400000).toISOString());
  const read = useRead<AuditEntry[]>(`/admin/auditoria?${params}`, 0, loadGlobalAudit);
  const entries = read.data ?? [];
  const visible = entries.filter((entry) => (!actor || entry.actor === actor) && (!role || entry.roles?.includes(role)) && (!module || entry.modulo === module) && (!action || auditAction(entry.accion) === action));
  function download() {
    const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const csv = [["Fecha / Hora", "Actor", "Roles", "Módulo", "Acción", "Descripción"], ...visible.map((entry) => [textValue(entry.fecha), entry.actor, entry.roles?.join(", ") ?? "", entry.modulo, auditAction(entry.accion), auditDescription(entry)])].map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "reporte-auditorias.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="form-stack">
    <div className="summary-grid">{[["Total de registros", visible.length], ["Usuarios únicos", new Set(visible.map((entry) => entry.actor)).size], ["Módulos auditados", new Set(visible.map((entry) => entry.modulo)).size], ["Eliminaciones y rechazos", visible.filter((entry) => ["Eliminar", "Rechazar"].includes(auditAction(entry.accion))).length]].map(([label, value]) => <Card key={label}><span className="muted">{label}</span><strong className="summary-value">{read.loading || read.error ? "—" : value}</strong></Card>)}</div>
    <Card><div className="audit-filters">
      <label>Desde<input type="date" value={from} max={to && to < today ? to : today} onChange={(event) => { setFrom(event.target.value); setLimit(20); }} /></label>
      <label>Hasta<input type="date" value={to} max={today} min={from || undefined} onChange={(event) => { setTo(event.target.value); setLimit(20); }} /></label>
      {([ ["Usuario", actor, setActor, entries.map((entry) => entry.actor)], ["Rol", role, setRole, entries.flatMap((entry) => entry.roles ?? [])], ["Módulo", module, setModule, entries.map((entry) => entry.modulo)], ["Acción", action, setAction, entries.map((entry) => auditAction(entry.accion))] ] as const).map(([label, value, setter, options]) => <label key={label}>{label}<select aria-label={label} value={value} onChange={(event) => { setter(event.target.value); setLimit(20); }}><option value="">Todos</option>{[...new Set(options)].sort().map((option) => <option key={option}>{option}</option>)}</select></label>)}
      <button className="button secondary" onClick={read.refresh}>Actualizar reporte</button>
      <button className="button" onClick={download} disabled={read.loading || !!read.error || !visible.length}>Exportar reporte</button>
    </div></Card>
    <Card className="table-card"><p className="muted audit-scope">Movimientos registrados en el servidor de usuarios de todos los roles, incluidas las operaciones de los asesores del banco.</p>
      {read.loading ? <p className="integration-state" role="status">Consultando auditoría global…</p> : read.error ? <div className="integration-state"><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar reporte</button></div> : <>
        <div className="table-scroll"><table aria-label="Reporte de auditorías"><thead><tr>{["Fecha / Hora", "Actor", "Roles", "Módulo", "Acción", "Descripción", "Acciones"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{visible.slice(0, limit).map((entry) => <tr key={entry.id}><td>{textValue(entry.fecha)}</td><td>{entry.actor}</td><td>{entry.roles?.join(", ") || "Sistema"}</td><td>{entry.modulo}</td><td>{auditAction(entry.accion)}</td><td>{auditDescription(entry)}</td><td><button className="table-action" onClick={() => setSelected(entry)}>Ver</button></td></tr>)}{!visible.length && <tr><td colSpan={7}>No hay movimientos registrados para estos filtros.</td></tr>}</tbody></table></div>
        <div className="integration-pagination"><span>{Math.min(limit, visible.length)} de {visible.length} registros</span>{limit < visible.length && <button className="button secondary" onClick={() => setLimit((value) => value + 20)}>Mostrar más</button>}</div>
      </>}
    </Card>
    {selected && <Drawer title="Detalle de la acción" close="#/reportes" onClose={() => setSelected(null)}><DataDetails value={{ fecha: selected.fecha, actor: selected.actor, roles: selected.roles?.join(", ") || "Sistema", modulo: selected.modulo, accion: auditAction(selected.accion), descripcion: auditDescription(selected), ...(selected.detalles ?? {}) }} /></Drawer>}
  </div>;
}
