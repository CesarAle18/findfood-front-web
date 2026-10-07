import { useState } from "react";
import { Card, Field } from "../components/ui";
import { useSession } from "./session-context";
import { supabase, verifyCurrentPassword } from "./supabase";
import { errorMessage } from "./http";
export function PasswordLive({
  recovery = false,
  mandatory = false,
}: {
  recovery?: boolean;
  mandatory?: boolean;
}) {
  const auth = useSession()!;
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const validRecovery = !recovery || (auth.session && auth.recovery);
  if (!validRecovery)
    return (
      <Card title="Enlace de recuperación requerido">
        <p role="alert">
          Abre el enlace enviado a tu correo. Si venció, solicita uno nuevo.
        </p>
        <a className="button" href="#/recuperar-contrasena">
          Solicitar enlace
        </a>
      </Card>
    );
  return (
    <div className="two-column">
      <Card title="Seguridad de la cuenta">
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            if (password !== confirm) {
              setError("Las contraseñas no coinciden.");
              return;
            }
            if (
              !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
                password,
              )
            ) {
              setError(
                "La nueva contraseña debe cumplir todos los requisitos indicados.",
              );
              return;
            }
            if (!recovery && password === current) {
              setError("La nueva contraseña debe ser diferente de la actual.");
              return;
            }
            setBusy(true);
            try {
              if (!saved) {
                if (!recovery)
                  await verifyCurrentPassword(auth.profile!.email, current);
                const { error: updateError } = await supabase!.auth.updateUser({
                  password,
                });
                if (updateError) throw updateError;
                setSaved(true);
              }
              if (recovery) {
                await auth.signOut();
              } else {
                const profile = await auth.refreshProfile();
                if (profile.debe_cambiar_password)
                  throw new Error(
                    "La contraseña se actualizó, pero la API aún solicita el cambio. Reintenta para verificar el perfil y revisa el disparador de sincronización de la base.",
                  );
                window.location.hash = "/inicio";
              }
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {!recovery && (
            <Field
              label="Contraseña actual *"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={busy || saved}
            />
          )}
          <Field
            label="Nueva contraseña *"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy || saved}
          />
          <Field
            label="Confirmar nueva contraseña *"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy || saved}
          />
          {saved && <p role="status">La contraseña fue actualizada.</p>}
          {error && (
            <p className="integration-error" role="alert">
              {error}
            </p>
          )}
          <div className="card-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                if (recovery || mandatory)
                  void auth
                    .signOut()
                    .catch((err) => setError(errorMessage(err)));
                else window.location.hash = "/inicio";
              }}
            >
              Cancelar
            </button>
            <button className="button" type="submit" disabled={busy}>
              {busy
                ? "Actualizando…"
                : saved
                  ? "Continuar"
                  : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </Card>
      <Card title="Requisitos de contraseña">
        <ul className="check-list">
          {[
            "Mínimo 8 caracteres",
            "Una letra mayúscula",
            "Una letra minúscula",
            "Un número",
            "Un carácter especial",
          ].map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
