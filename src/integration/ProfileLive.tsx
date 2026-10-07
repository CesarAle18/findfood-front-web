import { useState } from "react";
import { Card, Field } from "../components/ui";
import { useSession } from "./session-context";
import { profileService } from "./services";
import { errorMessage } from "./http";
import { roleLabels } from "./contracts";
export function ProfileLive() {
  const auth = useSession()!;
  const profile = auth.profile!;
  const [names, setNames] = useState(profile.nombres);
  const [surname, setSurname] = useState(profile.apellidos || "");
  const [phone, setPhone] = useState(profile.telefono || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <Card title="Mi perfil">
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setSaved(false);
          try {
            await profileService.update({
              nombres: names.trim(),
              apellidos: surname.trim(),
              telefono: phone.trim(),
            });
            await auth.refreshProfile();
            setSaved(true);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Nombres *"
          required
          maxLength={100}
          value={names}
          onChange={(e) => setNames(e.target.value)}
          disabled={busy}
        />
        <Field
          label="Apellidos"
          maxLength={100}
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          disabled={busy}
        />
        <Field
          label="Teléfono *"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={busy}
        />
        <Field label="Correo electrónico" value={profile.email} readOnly />
        <p>Roles: {profile.roles.map((role) => roleLabels[role]).join(", ")}</p>
        {error && (
          <p className="integration-error" role="alert">
            {error}
          </p>
        )}
        {saved && <p role="status">Perfil actualizado.</p>}
        <button className="button" disabled={busy} type="submit">
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </Card>
  );
}
