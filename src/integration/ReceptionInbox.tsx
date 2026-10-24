import { useState, type ReactNode } from "react";
import { Card } from "../components/ui";
import { useSession } from "./session-context";
import { RouteReceptionForm } from "./RouteReceptionForm";

export function ReceptionInbox({ history }: { history: ReactNode }) {
  const advisor = useSession()?.profile?.roles.includes("ASESOR_BANCO");
  const [creating, setCreating] = useState(false);
  return (
    <div className="form-stack">
      {advisor && (
        <Card>
          <button className="button" onClick={() => setCreating(true)}>
            Crear recepción
          </button>
        </Card>
      )}
      {history}
      {advisor && creating && (
        <RouteReceptionForm onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
