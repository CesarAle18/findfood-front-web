import { ActionButtons } from "./ActionForm";
import { EvidencePanel } from "./EvidencePanel";
import { type Action, type Row } from "./actions";
import { useSession } from "./session-context";
import { textValue } from "./read-format";
export function RouteExecution({ route, refresh }: { route: Row; refresh: () => void }) {
  const auth = useSession()!;
  const advisor = auth.profile?.roles.includes("ASESOR_BANCO");
  const fleet = route.flota_banco === true;
  const planned = route.estado === "PLANIFICADA";
  const active = route.estado === "EN_CURSO";
  const routeActions: Action[] = [];
  if (planned && advisor && fleet) routeActions.push({ key: "route-start", label: "Iniciar ruta", roles: ["ASESOR_BANCO"], endpoint: `/rutas/${route.id}/iniciar`, method: "POST", fields: [], body: () => ({}) });
  if (planned) routeActions.push({ key: "route-cancel", label: "Cancelar ruta", roles: ["ADMIN", "ASESOR_BANCO"], endpoint: `/rutas/${route.id}/cancelar`, method: "POST", fields: [], description: "Se cancelará la ruta planificada y se liberarán sus asignaciones.", body: () => ({}) });
  const stops = Array.isArray(route.paradas) ? route.paradas as Row[] : [];
  return <div className="form-stack"><ActionButtons actions={routeActions} onSaved={refresh} />{stops.map((stop) => {
    const open = active && ["PENDIENTE", "EN_SITIO"].includes(String(stop.estado));
    const canExecute = advisor && (fleet || stop.tipo === "ENTREGA");
    const actions: Action[] = [];
    if (open && canExecute) {
      if (stop.estado === "PENDIENTE") actions.push({ key: "stop-arrive", label: "Registrar llegada", roles: ["ASESOR_BANCO"], endpoint: `/paradas/${stop.id}/llegada`, method: "POST", fields: [], body: () => ({}) });
      actions.push({ key: "stop-confirm", label: stop.tipo === "ENTREGA" ? "Confirmar entrega en sede" : "Confirmar recogida", roles: ["ASESOR_BANCO"], endpoint: `/paradas/${stop.id}/confirmar`, method: "POST", description: "La evidencia debe estar registrada previamente. En la web solo puedes consultarla. Esta confirmación se realiza manualmente, sin GPS, y quedará marcada en la trazabilidad.", fields: [
        ...(stop.tipo === "RECOGIDA" ? [{ key: "peso_confirmado_kg", label: "Peso real recogido (kg)", type: "number" as const, required: true, min: 0.01, max: 99999999, step: 0.01 }] : []),
        { key: "observaciones", label: "Observaciones", type: "textarea", maxLength: 1000 },
        { key: "manual", label: "Confirmo que verifiqué presencialmente esta operación", type: "checkbox", required: true },
      ], body: (v) => {
        if (v.manual !== "true") throw new Error("Debes verificar la operación antes de confirmarla.");
        return { confirmacion_manual: true, confirmada_en_dispositivo: new Date().toISOString(), ...(stop.tipo === "RECOGIDA" ? { peso_confirmado_kg: Number(v.peso_confirmado_kg) } : {}), ...(v.observaciones.trim() ? { observaciones: v.observaciones.trim() } : {}) };
      } });
    }
    return <section key={String(stop.id)} className="detail-record"><h3>Parada {String(stop.orden)} · {textValue(stop.direccion)}</h3><p>{textValue(stop.tipo)} · {textValue(stop.estado)}</p><EvidencePanel parent="parada_id" id={String(stop.id)} /><ActionButtons actions={actions} onSaved={refresh} /></section>;
  })}</div>;
}


