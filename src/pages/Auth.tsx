import { Brand, DemoButton, Field, Icon, LinkButton } from "../components/ui";
export function Auth({ forgot = false }: { forgot?: boolean }) {
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Brand />
      </div>
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!forgot) window.location.hash = "/inicio";
          }}
          className="form-stack"
        >
          <Field
            label={
              forgot ? "Correo electrónico *" : "Usuario o correo electrónico *"
            }
            placeholder="usuario@findfood.org"
            autoComplete="username"
          />
          {!forgot && (
            <>
              <Field
                label="Contraseña *"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <div className="auth-options">
                <label>
                  <input type="checkbox" /> Recordarme
                </label>
                <a href="#/recuperar-contrasena">¿Olvidaste tu contraseña?</a>
              </div>
              <button className="button" type="submit">
                Iniciar sesión
              </button>
            </>
          )}
          {forgot && (
            <>
              <DemoButton>Enviar instrucciones</DemoButton>
              <LinkButton to="#/login" secondary>
                Volver al inicio de sesión
              </LinkButton>
              <div className="info">
                <Icon name="mail" />
                <p>
                  Por seguridad, el enlace de recuperación tendrá una vigencia
                  limitada.
                </p>
              </div>
            </>
          )}
        </form>
        <small className="demo-note">
          Vista de demostración · sin autenticación ni envío de datos
        </small>
      </section>
      <a className="auth-gallery" href="#/pantallas">
        Explorar pantallas del diseño <Icon name="arrow" size={16} />
      </a>
    </main>
  );
}
