import { useState } from "react";
import { Card } from "../components/ui";
import { AssignmentSettings } from "./AssignmentSettings";
import { useRead } from "./read";
import { ActionButtons } from "./ActionForm";
import { bankAction, foodAction, type Row } from "./actions";
import { DataDetails } from "./ReadDisplay";
import { textValue } from "./read-format";
function BankSites() {
  const read = useRead<Row[]>("/almacenes");
  return <section className="bank-sites"><h3>Sedes del banco</h3>{read.loading ? <p role="status">Cargando sedes…</p> : read.error ? <><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar sedes</button></> : <><p>{read.data?.length ?? 0} sedes pertenecen a este banco.</p><div className="table-scroll"><table aria-label="Sedes del banco"><thead><tr><th>Sede</th><th>Dirección</th><th>Refrigeración</th><th>Capacidad (kg)</th><th>Activa</th></tr></thead><tbody>{read.data?.map((row) => <tr key={String(row.id)}><td>{textValue(row.nombre)}</td><td>{textValue(row.direccion)}</td><td>{row.tipo === "REFRIGERADO" ? "Sí" : row.tipo === "SECO" ? "No" : "—"}</td><td>{textValue(row.capacidad_kg)}</td><td>{textValue(row.activo)}</td></tr>)}{!read.data?.length && <tr><td colSpan={5}>No hay sedes registradas para el banco.</td></tr>}</tbody></table></div></>}</section>;
}
function BankSettings() {
  const read = useRead<Row>("/admin/banco");
  return <Card title="Banco de alimentos"><p>La organización tiene un solo banco y varias sedes. Aquí editas los datos generales del banco y si dispone de flota propia.</p><a className="button secondary" href="#/almacenes">Administrar sedes y almacenes</a>{read.loading ? <p role="status">Cargando banco…</p> : read.error ? <><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar banco</button></> : <><DataDetails value={read.data} /><ActionButtons actions={[bankAction(read.data)]} onSaved={read.refresh} /></>}<BankSites /></Card>;
}
function FoodSettings() {
  const read = useRead<{ tipos_alimento: Row[] }>("/catalogos?incluir=tipos_alimento");
  return <Card title="Tipos de alimento"><ActionButtons actions={[foodAction()]} onSaved={read.refresh} />{read.loading ? <p role="status">Cargando alimentos…</p> : read.error ? <><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar alimentos</button></> : <><p className="muted">Catálogo de alimentos activos.</p><div className="table-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th>Régimen</th><th>Vida útil (días)</th><th>Acciones</th></tr></thead><tbody>{read.data?.tipos_alimento.map((row) => <tr key={String(row.id)}><td>{textValue(row.codigo)}</td><td>{textValue(row.nombre)}</td><td>{textValue(row.tipo_almacenamiento)}</td><td>{textValue(row.vida_util_dias)}</td><td><ActionButtons actions={[foodAction({ ...row, activo: true })]} onSaved={read.refresh} /></td></tr>)}</tbody></table></div></>}</Card>;
}
function TaskStatus() {
  const read = useRead<Record<string, Row>>("/admin/tareas", 30000);
  return <Card title="Estado de tareas programadas"><button className="button secondary" onClick={read.refresh}>Actualizar tareas</button>{read.loading ? <p role="status">Cargando tareas…</p> : read.error ? <p role="alert">{read.error}</p> : !Object.keys(read.data ?? {}).length ? <p>No hay ejecuciones registradas en este proceso. Esto no confirma que las tareas estén habilitadas.</p> : <div className="table-scroll"><table><thead><tr>{["Tarea", "Última ejecución", "Última exitosa", "Resultado", "Error", "Ciclos omitidos"].map((v) => <th key={v}>{v}</th>)}</tr></thead><tbody>{Object.entries(read.data ?? {}).map(([name, row]) => <tr key={name}><td>{name}</td><td>{textValue(row.ultimaEjecucion)}</td><td>{textValue(row.ultimaExitosa)}</td><td><pre>{row.ultimoResultado === undefined ? "—" : JSON.stringify(row.ultimoResultado, null, 2)}</pre></td><td>{textValue(row.ultimoError)}</td><td>{textValue(row.omitidas)}</td></tr>)}</tbody></table></div>}</Card>;
}
export function SettingsLive() {
  const [tab, setTab] = useState("Asignación");
  return <div className="form-stack settings-page"><Card className="settings-tabs"><div className="card-actions" aria-label="Secciones de configuración">{["Asignación", "Banco", "Alimentos", "Tareas"].map((name) => <button className={`button ${tab === name ? "" : "secondary"}`} key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div></Card>{tab === "Asignación" ? <AssignmentSettings /> : tab === "Banco" ? <BankSettings /> : tab === "Alimentos" ? <FoodSettings /> : <TaskStatus />}</div>;
}




