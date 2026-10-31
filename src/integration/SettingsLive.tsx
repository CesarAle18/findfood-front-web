import { useState } from "react";
import { Card } from "../components/ui";
import { AssignmentSettings } from "./AssignmentSettings";
import { useRead } from "./read";
import { ActionButtons } from "./ActionForm";
import { bankAction, type Row } from "./actions";
import { DataDetails } from "./ReadDisplay";
import { FoodSettings } from "./FoodSettings";
function BankSettings() {
  const read = useRead<Row>("/admin/banco");
  const details = read.data ? Object.fromEntries(Object.entries(read.data).filter(([key]) => !["lat", "lng", "lon", "ubicacion", "latitud", "longitud"].includes(key))) : undefined;
  return <Card title="Banco de alimentos"><div className="form-stack">
    <p>La organización tiene un solo banco y varias sedes. Aquí editas los datos generales del banco y si dispone de flota propia.</p>
    {read.loading ? <p role="status">Cargando banco…</p> : read.error ? <div><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar banco</button></div> : <>
      <DataDetails value={details} />
      <ActionButtons actions={[bankAction(read.data)]} onSaved={read.refresh} />
    </>}
    <div className="card-actions bank-management-actions"><a className="button secondary" href="#/almacenes">Administrar sedes y almacenes</a></div>
  </div></Card>;
}
export function SettingsLive() {
  const [tab, setTab] = useState("Asignación");
  return <div className="form-stack settings-page"><Card className="settings-tabs"><div className="card-actions" aria-label="Secciones de configuración">{["Asignación", "Banco", "Alimentos"].map((name) => <button className={`button ${tab === name ? "" : "secondary"}`} key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div></Card>{tab === "Asignación" ? <AssignmentSettings /> : tab === "Banco" ? <BankSettings /> : <FoodSettings />}</div>;
}




