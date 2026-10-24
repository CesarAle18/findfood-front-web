import { useState } from "react";
import { Badge, Drawer } from "../components/ui";
import { OptionsField } from "./ActionForm";
import type { Input, Row } from "./actions";
import { useRead } from "./read";
import { textValue } from "./read-format";
import { ReceptionLive } from "./StockForms";
const completedRoutes: Input = {
  key: "ruta_id", label: "Ruta finalizada", type: "select", required: true,
  source: { endpoint: "/rutas?estado=COMPLETADA", states: ["COMPLETADA"] },
};
function RouteDonations({ id }: { id: string }) {
  const read = useRead<Row>(`/rutas/${encodeURIComponent(id)}`, 15000);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  if (read.loading) return <p role="status">Cargando donaciones de la ruta…</p>;
  if (read.error) return <div><p role="alert">{read.error}</p><button className="button secondary" onClick={read.refresh}>Reintentar ruta</button></div>;
  if (read.data?.estado !== "COMPLETADA") return <p role="alert">La ruta debe estar finalizada antes de crear sus recepciones.</p>;
  const stops = Array.isArray(read.data.paradas) ? read.data.paradas as Row[] : [];
  const seen = new Set<string>();
  const donations = stops.filter((stop) => {
    if (stop.tipo !== "RECOGIDA" || !stop.donacion_id || seen.has(String(stop.donacion_id))) return false;
    seen.add(String(stop.donacion_id)); return true;
  });
  const canReceive = (stop: Row) => stop.estado === "COMPLETADA" && stop.donacion_estado === "ENTREGADA" && !saved[String(stop.donacion_id)];
  return <div className="form-stack">
    <p>Ruta <strong>{textValue(read.data.codigo)}</strong> · Sede: {textValue(read.data.almacen_destino)}</p>
    <fieldset className="form-stack"><legend>Donaciones que venían en la ruta</legend>
      {donations.map((stop) => {
        const donationId = String(stop.donacion_id);
        const enabled = canReceive(stop);
        return <div className="route-reception-choice" key={donationId}><label className="check-field"><input type="checkbox" disabled={!enabled} checked={Boolean(enabled && selected.includes(donationId))} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, donationId] : previous.filter((value) => value !== donationId))} />{textValue(stop.donacion_codigo ?? donationId)}</label><Badge>{saved[donationId] ? `Recepción ${textValue(saved[donationId])}` : textValue(stop.donacion_estado)}</Badge>{!enabled && !saved[donationId] && <small className="muted">{["RECIBIDA", "RECHAZADA"].includes(String(stop.donacion_estado)) ? "Esta donación ya tiene una recepción registrada." : "No está disponible para recepción en sede."}</small>}</div>;
      })}
      {!donations.length && <p>La ruta no contiene donaciones para recibir.</p>}
    </fieldset>
    {Object.keys(saved).length > 0 && <p role="status">{Object.keys(saved).length} {Object.keys(saved).length === 1 ? "recepción registrada" : "recepciones registradas"} en este formulario.</p>}
    {donations.filter((stop) => canReceive(stop) && selected.includes(String(stop.donacion_id))).map((stop) => {
      const donationId = String(stop.donacion_id);
      return <section className="route-reception-form" key={donationId} aria-label={`Recepción de ${textValue(stop.donacion_codigo ?? donationId)}`}><h3>{textValue(stop.donacion_codigo ?? donationId)}</h3><ReceptionLive id={donationId} onSaved={(status) => { setSaved((previous) => ({ ...previous, [donationId]: status })); setSelected((previous) => previous.filter((value) => value !== donationId)); }} /></section>;
    })}
    {!selected.length && !Object.keys(saved).length && donations.some(canReceive) && <p className="muted">Selecciona una o varias donaciones para definir su resultado. Cada donación se registra por separado: aceptada, aceptada parcialmente o rechazada.</p>}
  </div>;
}
export function RouteReceptionForm({ onClose }: { onClose: () => void }) {
  const [route, setRoute] = useState("");
  return <Drawer title="Crear recepción de ruta" close="#/recepciones" onClose={onClose}>
    <div className="form-stack"><OptionsField field={completedRoutes} value={route} disabled={false} change={setRoute} />{route && <RouteDonations key={route} id={route} />}</div>
  </Drawer>;
}

