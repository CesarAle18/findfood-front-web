import type { ReactNode } from "react";

export function ReceptionInbox({ history }: { history: ReactNode }) {
  return <div className="form-stack"><p>Para registrar una recepción, abre Donaciones y selecciona «Recibir» en una donación entregada.</p>{history}</div>;
}
