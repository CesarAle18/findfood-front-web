import { useState } from "react";
import { Badge, Card } from "../components/ui";
import { useRead } from "./read";
import { DataDetails } from "./ReadDisplay";
import { fieldLabel, fieldValue, textValue } from "./read-format";
import { ActionButtons } from "./ActionForm";
import { recordActions, type Row } from "./actions";
import { canAssignDonation, donationDetails } from "./donation-display";
import { advisorDetails } from "./advisor-display";
import { useSession } from "./session-context";

function Facts({ value }: { value: Row }) {
  const profile = useSession()?.profile;
  if (profile?.roles.includes("ASESOR_BANCO") && !profile.roles.includes("ADMIN")) value = advisorDetails(value) as Row;
  return <dl className="assignment-facts">{Object.entries(value).filter(([, v]) => v == null || typeof v !== "object").map(([key, v]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd>{fieldValue(key, v)}</dd></div>)}</dl>;
}

export function AssignmentLive({ id }: { id: string }) {
  const donation = useRead<Row>(`/donaciones/${encodeURIComponent(id)}`);
  const candidates = useRead<unknown>(`/donaciones/${encodeURIComponent(id)}/candidatos`);
  const [selected, setSelected] = useState(0);
  const payload = candidates.data;
  const candidateRows = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? ((payload as Row).datos ?? (payload as Row).candidatos) : undefined;
  const rows: Row[] = Array.isArray(candidateRows) ? candidateRows.filter((r): r is Row => !!r && typeof r === "object") : [];
  const current = rows[selected] ?? rows[0];
  const data = donationDetails(donation.data) as Row | undefined;
  if (data && !canAssignDonation(data)) return <Card title="Asignación no disponible"><p>Esta donación está {textValue(data.estado)} y no admite asignación.</p><a className="button secondary" href="#/donaciones">Volver a donaciones</a></Card>;
  const volunteer = current?.voluntario as Row | undefined;
  const breakdown = current?.desglose ?? current?.desglose_puntaje;
  return <div className="assignment-live">
    <Card title="Donación seleccionada">
      {donation.loading ? <p role="status">Cargando donación…</p> : donation.error ? <p role="alert">{donation.error}</p> : data && <>
        <div className="assignment-summary">
          <div><span>Donación</span><strong>{textValue(data.codigo)} · {textValue(data.titulo)}</strong></div>
          <div><span>Peso estimado</span><strong>{textValue(data.peso_estimado_kg)} kg</strong></div>
          <div><span>Refrigeración</span><strong>{textValue(data.requiere_refrigeracion)}</strong></div>
          <div><span>Estado</span><Badge>{textValue(data.estado)}</Badge></div>
        </div>
        <details className="assignment-details"><summary>Ver todos los datos de la donación</summary><Facts value={data} />{Object.entries(data).filter(([, v]) => v !== null && typeof v === "object").map(([key, value]) => <section key={key}><h3>{fieldLabel(key)}</h3><DataDetails value={value} collection={key} /></section>)}</details>
      </>}
      {donation.error && <button className="button secondary" onClick={donation.refresh}>Reintentar donación</button>}
    </Card>
    <div className="assignment-columns">
      <Card title="Voluntarios candidatos">
        <p className="muted">Orden y puntajes calculados por el motor de asignación.</p>
        {candidates.loading ? <p role="status">Cargando candidatos…</p> : candidates.error ? <div><p role="alert">{candidates.error}</p><button className="button secondary" onClick={candidates.refresh}>Reintentar candidatos</button></div> : !Array.isArray(candidateRows) ? <p role="alert">La API no devolvió una lista válida de candidatos.</p> : !rows.length ? <p>No hay candidatos disponibles para esta donación.</p> : <ol className="assignment-candidates">{rows.map((row, index) => {
          const person = row.voluntario && typeof row.voluntario === "object" ? row.voluntario as Row : {};
          const user = person.usuario && typeof person.usuario === "object" ? person.usuario as Row : person;
          return <li key={String(person.id ?? row.id ?? index)} className={current === row ? "is-selected" : ""}>
            <span className="candidate-rank">{textValue(row.posicion ?? index + 1)}</span>
            <div className="candidate-info"><h3>{[user.nombres, user.apellidos].filter(Boolean).join(" ") || textValue(person.nombre ?? person.id)}</h3>
              <Facts value={Object.fromEntries(Object.entries(person).filter(([key]) => !["id", "nombres", "apellidos", "nombre"].includes(key)))} />
              <details><summary>Más información</summary><DataDetails value={row} /></details>
            </div>
            <div className="candidate-score"><span>Puntaje</span><strong>{textValue(row.score ?? row.puntaje)}</strong><button className="button secondary" aria-pressed={current === row} onClick={() => setSelected(index)}>Ver desglose</button></div>
          </li>;
        })}</ol>}
      </Card>
      <aside className="assignment-sidebar">
        <Card title="Desglose del puntaje">
          {current ? <><h3>{textValue(volunteer?.nombres ?? volunteer?.nombre ?? volunteer?.id)}</h3>{breakdown != null ? <DataDetails value={breakdown} /> : <p>La API entrega el puntaje total, pero no incluye su desglose por criterio.</p>}</> : <p>Selecciona un candidato cuando esté disponible.</p>}
        </Card>
        <Card title="Asignación automática">
          <p>Al reasignar, el motor vuelve a evaluar candidatos y ofrece la donación según su configuración.</p>
          <ActionButtons actions={recordActions("/donaciones", data ?? { id }).filter((a) => a.key === "donation-reassign")} onSaved={() => { donation.refresh(); candidates.refresh(); }} />
        </Card>
      </aside>
    </div>
  </div>;
}
