import { useRead } from "./read";
import { useEffect, useState } from "react";
import { Badge, Card, Drawer, Icon } from "../components/ui";
import { apiRequest, errorMessage } from "./http";
import type { Row } from "./actions";
import type { Page } from "./contracts";
import { recordActions } from "./actions";
import { ActionButtons } from "./ActionForm";
import { DetailBody } from "./ReadViews";
import { fieldValue, textValue } from "./read-format";
import { available, expiry, inventoryState } from "./inventory-state";
function refrigerated(row: Row) {
  return row.requiere_refrigeracion === true || row.regimen === "REFRIGERADO" || row.tipo_almacenamiento === "REFRIGERADO";
}
export function InventoryLive() {
  const [result, setResult] = useState<{ rows?: Row[]; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [food, setFood] = useState("");
  const warehouses = useRead<Row[]>("/almacenes");
  const catalog = useRead<{ tipos_alimento: Row[] }>("/catalogos?incluir=tipos_alimento");
  const [regime, setRegime] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const refresh = () => { setResult({}); setAttempt((n) => n + 1); };
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { controller.abort(); setResult({ error: "La consulta de inventario tardó demasiado. Intenta nuevamente." }); }, 30000);
    async function load() {
      const all: Row[] = [];
      const ids = new Set<string>();
      let start = 0;
      while (!controller.signal.aborted) {
        const response = await apiRequest<Page<Row> | Row[]>(`/inventario/lotes?${new URLSearchParams({ limite: "100", desplazamiento: String(start), ...(warehouse ? { almacen_id: warehouse } : {}), ...(food ? { tipo_alimento_id: food } : {}) })}`, { signal: controller.signal });
        const batch = Array.isArray(response) ? response : response.datos;
        if (!Array.isArray(batch)) throw new Error("No fue posible leer los lotes del inventario.");
        let added = 0;
        for (const row of batch) {
          const id = String(row.lote_id ?? row.id ?? `${start + added}`);
          if (!ids.has(id)) { all.push(row); ids.add(id); added++; }
        }
        start += batch.length;
        if (Array.isArray(response) || start >= response.total) break;
        if (!batch.length || !added || !Number.isFinite(response.total) || start >= 10000) throw new Error("No fue posible completar la consulta del inventario.");
      }
      if (!controller.signal.aborted) setResult({ rows: all });
    }
    void load().catch((e: unknown) => { if (!controller.signal.aborted) setResult({ error: errorMessage(e) }); }).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [attempt, warehouse, food]);
  useEffect(() => {
    const changed = () => { setResult({}); setAttempt((n) => n + 1); };
    window.addEventListener("findfood:data-changed", changed);
    return () => window.removeEventListener("findfood:data-changed", changed);
  }, []);
  const rows = (result.rows ?? []).map<Row>((row) => {
    const type = catalog.data?.tipos_alimento.find((t) => String(t.id) === String(row.tipo_alimento_id));
    return { ...row, estado: inventoryState(row, now), ...(type ? { requiere_refrigeracion: type.requiere_refrigeracion, tipo_almacenamiento: type.tipo_almacenamiento } : {}) };
  }).sort((a, b) => expiry(a) - expiry(b));

  const stock = rows.filter((row) => available(row, now));
  const soon = stock.filter((r) => expiry(r) >= now && expiry(r) - now <= 86400000).length;
  const expired = rows.filter((r) => expiry(r) < now && Number(r.cantidad_disponible ?? r.peso_disponible_kg) > 0).length;
  const weights = stock.map((r) => r.peso_disponible_kg == null || r.peso_disponible_kg === "" ? NaN : Number(r.peso_disponible_kg));
  const filtered = rows.filter((r) => (!search || [r.codigo_lote, r.tipo_alimento, r.almacen].some((v) => textValue(v).toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")))) && (!onlyAvailable || available(r)) && (!regime || (regime === "REFRIGERADO" ? refrigerated(r) : r.requiere_refrigeracion === false || r.regimen === "SECO" || r.tipo_almacenamiento === "SECO")));
  const visible = filtered.slice(offset, offset + 20);
  const summary = [["Lotes disponibles", stock.length, "green"], ["Vencen en ≤ 24 h", soon, "red"], ["Refrigerados", stock.filter(refrigerated).length, "blue"], ["Peso disponible", weights.every(Number.isFinite) ? `${textValue(weights.reduce((a, b) => a + b, 0))} kg` : "No disponible", "amber"]];
  const loaded = Boolean(result.rows);
  return <div className="form-stack">
    <div className="summary-grid">{summary.map(([label, value, color]) => <Card key={label}><div className="summary-label"><span className="muted">{label}</span><span className={`summary-dot ${color}`} /></div><strong className="summary-value">{loaded ? value : "—"}</strong>{label === "Vencen en ≤ 24 h" && <span className="summary-chip">Atención prioritaria</span>}</Card>)}</div>
    <Card><div className="toolbar inventory-filters"><label className="search"><Icon name="search" /><input aria-label="Buscar producto o lote" placeholder="Buscar producto o lote…" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} /></label><label>Sede <select aria-label="Filtrar inventario por sede" value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setResult({}); setOffset(0); }}><option value="">Todas</option>{warehouses.data?.map((w) => <option key={String(w.id)} value={String(w.id)}>{textValue(w.nombre)}</option>)}</select></label><label>Tipo de alimento <select aria-label="Filtrar inventario por tipo" value={food} onChange={(e) => { setFood(e.target.value); setResult({}); setOffset(0); }}><option value="">Todos</option>{catalog.data?.tipos_alimento.map((t) => <option key={String(t.id)} value={String(t.id)}>{textValue(t.nombre)}</option>)}</select></label><label>Régimen <select value={regime} onChange={(e) => { setRegime(e.target.value); setOffset(0); }}><option value="">Todos</option><option value="SECO">Seco</option><option value="REFRIGERADO">Refrigerado</option></select></label><label className="inventory-availability"><input type="checkbox" checked={onlyAvailable} onChange={(e) => { setOnlyAvailable(e.target.checked); setOffset(0); }} />Solo disponibles</label><span className="summary-chip">Orden: FEFO</span><button className="button secondary" onClick={refresh}>Actualizar lista</button><a className="table-action" href="#/alertas">Alertas de inventario</a></div></Card>
    {(warehouses.error || catalog.error) && <p role="alert">No se pudieron cargar todas las opciones de filtro. <button className="table-action" onClick={() => { warehouses.refresh(); catalog.refresh(); }}>Reintentar filtros</button></p>}
    <Card className="table-card">{result.error ? <div className="integration-state"><p role="alert">{result.error}</p><button className="button" onClick={refresh}>Reintentar</button></div> : !loaded ? <p className="integration-state" role="status">Cargando inventario…</p> : <>
      {expired > 0 && <p className="inventory-expired" role="status">{expired} lotes con fecha de vencimiento superada.</p>}
      <div className="table-scroll"><table aria-label="Inventario FEFO"><thead><tr>{["Prioridad", "Lote", "Producto", "Almacén", "Cantidad disponible", "Unidad", "Peso disponible (kg)", "Régimen", "Vencimiento", "Estado", "Acciones"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((r, i) => {
        const expires = expiry(r), remaining = expires - now;
        const priority = rows.indexOf(r) + 1;
        const regimeValue = refrigerated(r) ? "Refrigerado" : r.requiere_refrigeracion === false || r.regimen === "SECO" || r.tipo_almacenamiento === "SECO" ? "Seco" : "—";
        return <tr key={String(r.lote_id ?? r.id ?? i)}><td>{expires === Infinity ? "—" : <span className={`inventory-priority ${remaining <= 86400000 ? "urgent" : remaining <= 259200000 ? "soon" : "normal"}`} title={remaining < 0 ? "Fecha de vencimiento superada" : remaining <= 86400000 ? "Vence en 24 horas o menos" : remaining <= 259200000 ? "Vence en 3 días o menos" : "Vencimiento posterior a 3 días"}>{priority}</span>}</td><td><strong>{textValue(r.codigo_lote)}</strong></td><td>{textValue(r.tipo_alimento)}</td><td>{textValue(r.almacen)}</td><td>{textValue(r.cantidad_disponible)}</td><td>{textValue(r.unidad)}</td><td>{fieldValue("peso_disponible_kg", r.peso_disponible_kg)}</td><td>{regimeValue}</td><td>{expires === Infinity ? "Sin fecha" : new Date(expires).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</td><td><Badge>{r.estado ? textValue(r.estado) : available(r) ? "Disponible" : "Sin disponibilidad"}</Badge></td><td><button className="table-action" onClick={() => setSelected(r)}>Ver</button></td></tr>;
      })}{!visible.length && <tr><td colSpan={11}>No se encontraron registros.</td></tr>}</tbody></table></div>
      <div className="integration-pagination"><span>{filtered.length ? `${Math.min(offset + 1, filtered.length)}–${Math.min(offset + 20, filtered.length)} de ${filtered.length} registros` : "0 registros"}</span><div className="card-actions"><button className="button secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</button><button className="button secondary" disabled={offset + 20 >= filtered.length} onClick={() => setOffset(offset + 20)}>Siguiente</button></div></div>
      <div className="inventory-legend"><p>Criterio activo: <strong>First Expired, First Out (FEFO)</strong></p><p><span className="legend-dot urgent" /> Vencido o ≤ 24 h <span className="legend-dot soon" /> ≤ 3 días <span className="legend-dot normal" /> Más de 3 días</p><p className="muted">Los productos sin fecha de vencimiento se ubican al final de la cola. Los indicadores incluyen los lotes de la sede y el tipo seleccionados, antes de aplicar búsqueda y régimen.</p></div>
    </>}</Card>
    {selected && <Drawer title="Detalle · Inventario" close="#/inventario" onClose={() => setSelected(null)}><ActionButtons actions={recordActions("/inventario", selected)} onSaved={() => { setSelected(null); refresh(); }} /><DetailBody path="/inventario" row={selected} endpoint={`/inventario/lotes/${encodeURIComponent(String(selected.lote_id ?? selected.id))}`} /></Drawer>}
  </div>;
}



