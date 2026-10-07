import { useState } from "react";
import { Field, Icon, LinkButton } from "../components/ui";
import { supabase, rememberSession } from "./supabase";
import { errorMessage } from "./http";
function authError(error: { message: string; code?: string }): string {
  if (error.code === "invalid_credentials")
    return "El correo o la contraseña no son correctos.";
  if (error.code === "email_not_confirmed")
    return "Confirma tu correo antes de iniciar sesión.";
  if (
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  )
    return "Se alcanzó el límite de intentos. Espera unos minutos y vuelve a intentarlo.";
  return error.message;
}
export function AuthLive({ forgot = false }: { forgot?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">
          {forgot ? (
            <Icon name="mail" size={32} />
          ) : (
            <img src="/brand/findfood-logo.png" alt="" />
          )}
        </div>
        <h1>
          {forgot ? "¿Olvidaste tu contraseña?" : "Bienvenido a Find Food"}
        </h1>
        <p>
          {forgot
            ? "Ingresa el correo asociado a tu cuenta. Te enviaremos las instrucciones para restablecerla."
            : "Inicia sesión para continuar con la operación."}
        </p>
        {sent ? (
          <>
            <div className="info" role="status">
              <Icon name="mail" />
              <p>
                Si el correo está registrado, recibirás un enlace para
                restablecer tu contraseña. Revisa también la carpeta de spam.
              </p>
            </div>
            <LinkButton to="#/login" secondary>
              Volver al inicio de sesión
            </LinkButton>
          </>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (forgot) {
                  const redirectTo = `${window.location.origin}${window.location.pathname}?flow=recovery`;
                  const result = await supabase!.auth.resetPasswordForEmail(
                    email.trim(),
                    { redirectTo },
                  );
                  if (result.error) throw new Error(authError(result.error));
                  setSent(true);
                } else {
                  rememberSession(remember);
                  const result = await supabase!.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                  });
                  if (result.error) throw new Error(authError(result.error));
                  // AuthBoundary consulta /me y decide si corresponde el cambio obligatorio.
                }
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              label="Correo electrónico *"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              placeholder="usuario@findfood.org"
            />
            {!forgot && (
              <>
                <Field
                  label="Contraseña *"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <div className="auth-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      disabled={busy}
                    />{" "}
                    Recordarme
                  </label>
                  <a href="#/recuperar-contrasena">¿Olvidaste tu contraseña?</a>
                </div>
              </>
            )}
            {error && (
              <p className="integration-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" type="submit" disabled={busy}>
              {busy
                ? "Procesando…"
                : forgot
                  ? "Enviar instrucciones"
                  : "Iniciar sesión"}
            </button>
            {forgot && (
              <LinkButton to="#/login" secondary>
                Volver al inicio de sesión
              </LinkButton>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
