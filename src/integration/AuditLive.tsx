import { useState } from "react";
import { Card, Drawer } from "../components/ui";
import { useSession } from "./session-context";
import { useAudit, type AuditEntry } from "./audit";
import { textValue } from "./read-format";
import { DataDetails } from "./ReadDisplay";
export function AuditLive() {
  const auth = useSession()!;
  const entries = useAudit(auth.session!.user.id);
  const [actor, setActor] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const date = (value: string) => new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const visible = entries.filter((e) => (!actor || e.actor === actor) && (!module || e.modulo === module) && (!action || e.accion === action) && (!from || date(e.fecha) >= from) && (!to || date(e.fecha) <= to));
  function download() {
    const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const csv = [["Fecha / Hora", "Actor", "Módulo", "Acción", "Entidad"], ...visible.map((e) => [textValue(e.fecha), e.actor, e.modulo, e.accion, e.entidad])].map((r) => r.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "reporte-auditorias.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="form-stack">
    <div className="summary-grid">{[["Total de registros", visible.length], ["Usuarios únicos", new Set(visible.map((e) => e.actor)).size], ["Módulos auditados", new Set(visible.map((e) => e.modulo)).size], ["Eliminaciones y rechazos", visible.filter((e) => e.metodo === "DELETE" || e.accion === "Rechazó").length]].map(([label, value]) => <Card key={label}><span className="muted">{label}</span><strong className="summary-value">{value}</strong>{label === "Usuarios únicos" && <small className="muted">Cuentas distintas que realizaron las acciones filtradas. Cada cuenta se cuenta una sola vez.</small>}</Card>)}</div>
    <Card><div className="audit-filters">
      <label>Desde<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>Hasta<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
      {([ ["Usuario", actor, setActor, "actor"], ["Módulo", module, setModule, "modulo"], ["Acción", action, setAction, "accion"] ] as const).map(([label, value, setter, field]) => <label key={label}>{label}<select aria-label={label} value={value} onChange={(e) => setter(e.target.value)}><option value="">Todos</option>{[...new Set(entries.map((e) => e[field]))].sort().map((v) => <option key={v}>{v}</option>)}</select></label>)}
      <button className="button" onClick={download} disabled={!visible.length}>Exportar reporte</button>
    </div></Card>
    <Card className="table-card"><p className="muted audit-scope">Acciones exitosas registradas desde este navegador y esta cuenta. Se conservan hasta 2.000 registros.</p><div className="table-scroll"><table aria-label="Reporte de auditorías"><thead><tr>{["Fecha / Hora", "Actor", "Módulo", "Acción", "Entidad", "Acciones"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((e) => <tr key={e.id}><td>{textValue(e.fecha)}</td><td>{e.actor}</td><td>{e.modulo}</td><td>{e.accion}</td><td className="audit-entity">{e.entidad}</td><td><button className="table-action" onClick={() => setSelected(e)}>Ver</button></td></tr>)}{!visible.length && <tr><td colSpan={6}>No hay acciones registradas para estos filtros. Las nuevas acciones aparecerán aquí al realizarlas.</td></tr>}</tbody></table></div></Card>
    {selected && <Drawer title="Detalle de la acción" close="#/reportes" onClose={() => setSelected(null)}><DataDetails value={{ fecha: selected.fecha, actor: selected.actor, modulo: selected.modulo, accion: selected.accion, entidad: selected.entidad, metodo: selected.metodo, ...(selected.detalles ?? {}) }} /></Drawer>}
  </div>;
}


