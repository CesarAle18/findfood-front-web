import { useState } from "react";
import { Badge, Card, Icon } from "../components/ui";
import { useRead } from "./read";
import { ActionButtons } from "./ActionForm";
import { foodAction, type Action, type Row } from "./actions";
import type { Page } from "./contracts";
import { textValue } from "./read-format";

function statusAction(row: Row): Action {
  const active = row.activo === true;
  return {
    key: `food-${active ? "deactivate" : "reactivate"}`,
    label: active ? "Desactivar alimento" : "Reactivar alimento",
    description: `${active ? "Desactivar" : "Reactivar"} ${String(row.nombre)} en el catálogo de alimentos.`,
    roles: ["ADMIN"], endpoint: `/admin/tipos-alimento/${encodeURIComponent(String(row.id))}`,
    method: "PATCH", fields: [], body: () => ({ activo: !active }),
  };
}

export function FoodSettings() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [regime, setRegime] = useState("");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limite: String(limit), desplazamiento: String(offset) });
  if (search.trim()) params.set("q", search.trim());
  if (status) params.set("estado", status);
  if (regime) params.set("tipo_almacenamiento", regime);
  const read = useRead<Page<Row>>(`/admin/tipos-alimento?${params}`);
  const rows = read.data?.datos ?? [];
  const total = read.data?.total ?? 0;
  const refresh = () => { setOffset(0); read.refresh(); };

  return <div className="form-stack">
    <Card title="Tipos de alimento"><div className="form-stack">
      <p className="muted">Consulta, edita y reactiva los alimentos del catálogo.</p>
      <div className="toolbar food-filters">
        <label className="search"><Icon name="search" /><input aria-label="Buscar alimento por código o nombre" placeholder="Buscar por código o nombre…" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} /></label>
        <label>Estado<select aria-label="Estado del alimento" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select></label>
        <label>Régimen<select aria-label="Régimen del alimento" value={regime} onChange={(event) => { setRegime(event.target.value); setOffset(0); }}><option value="">Todos</option><option value="SECO">Seco</option><option value="REFRIGERADO">Refrigerado</option></select></label>
        <label>Por página<select aria-label="Alimentos por página" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setOffset(0); }}>{[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="food-toolbar"><ActionButtons actions={[foodAction()]} onSaved={refresh} /><button className="button secondary" onClick={() => { setSearch(""); setStatus(""); setRegime(""); setOffset(0); }}>Limpiar filtros</button><button className="button secondary" onClick={refresh}>Actualizar lista</button></div>
    </div></Card>
    <Card className="table-card">
      {read.loading ? <p className="integration-state" role="status">Cargando alimentos…</p> : read.error ? <div className="integration-state"><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar alimentos</button></div> : <>
        <div className="table-scroll"><table aria-label="Tipos de alimento"><thead><tr>{["Código", "Nombre", "Régimen", "Vida útil (días)", "Estado", "Acciones"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td>{textValue(row.codigo)}</td><td>{textValue(row.nombre)}</td><td>{textValue(row.tipo_almacenamiento)}</td><td>{textValue(row.vida_util_dias)}</td><td><Badge>{row.activo ? "Activo" : "Inactivo"}</Badge></td><td><ActionButtons actions={[foodAction(row), statusAction(row)]} onSaved={refresh} /></td></tr>)}{!rows.length && <tr><td colSpan={6}>No se encontraron alimentos con estos filtros.</td></tr>}</tbody></table></div>
        <div className="integration-pagination"><span>{total ? `${offset + 1}–${Math.min(offset + rows.length, total)} de ${total} registros` : "0 registros"}</span><div className="card-actions"><button className="button secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</button><button className="button secondary" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Siguiente</button></div></div>
      </>}
    </Card>
  </div>;
}
