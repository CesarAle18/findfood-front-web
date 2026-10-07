import { useEffect } from "react";
import type { ReactNode } from "react";
import { useSession } from "./session-context";
import { useRoute } from "../state/navigation";
import { Auth } from "../pages/Auth";
import { PasswordLive } from "./PasswordLive";
import { Card } from "../components/ui";
export function AuthBoundary({ children }: { children: ReactNode }) {
  const auth = useSession()!;
  const route = useRoute();
  const publicPage = ["/login", "/recuperar-contrasena"].includes(
    route.pathname,
  );
  const target = auth.recovery
    ? null
    : auth.profile?.debe_cambiar_password
      ? route.pathname === "/login"
        ? "/cambiar-contrasena"
        : null
      : !auth.session &&
          !publicPage &&
          route.pathname !== "/restablecer-contrasena"
        ? "/login"
        : auth.profile && route.pathname === "/login"
          ? "/inicio"
          : null;
  useEffect(() => {
    if (!auth.loading && target && route.pathname !== target)
      window.location.hash = target;
  }, [auth.loading, target, route.pathname]);
  if (auth.loading)
    return (
      <main className="loading" role="status">
        <div className="spinner" />
        <p>Conectando con Find Food…</p>
      </main>
    );
  if (auth.recovery || route.pathname === "/restablecer-contrasena") {
    return (
      <main className="auth-page">
        <section className="password-public">
          <div className="page-heading">
            <h1>Cambio de contraseña</h1>
            <p>Define una nueva contraseña para recuperar tu acceso.</p>
          </div>
          <PasswordLive recovery />
        </section>
      </main>
    );
  }
  if (auth.session && auth.error)
    return (
      <main className="auth-page">
        <Card title="No fue posible cargar tu perfil">
          <p role="alert">{auth.error}</p>
          <div className="card-actions">
            <button
              className="button"
              onClick={() => void auth.refreshProfile().catch(() => {})}
            >
              Reintentar
            </button>
            <button
              className="button secondary"
              onClick={() => void auth.signOut().catch(() => {})}
            >
              Volver al inicio de sesión
            </button>
          </div>
        </Card>
      </main>
    );
  if (auth.profile?.debe_cambiar_password)
    return (
      <main className="auth-page">
        <section className="password-public">
          <div className="page-heading">
            <h1>Cambio de contraseña</h1>
            <p>Cambia tu contraseña temporal antes de continuar.</p>
          </div>
          <PasswordLive mandatory />
        </section>
      </main>
    );
  if (!auth.session || (publicPage && !auth.profile))
    return (
      <Auth
        key={route.pathname}
        forgot={route.pathname === "/recuperar-contrasena"}
      />
    );
  if (!auth.profile)
    return (
      <main className="loading" role="status">
        Cargando perfil…
      </main>
    );
  if (
    auth.profile.estado !== "ACTIVO" ||
    !auth.profile.roles.some((role) => ["ADMIN", "ASESOR_BANCO"].includes(role))
  )
    return (
      <main className="auth-page">
        <Card title="Acceso al panel web">
          <p role="alert">
            El panel requiere una cuenta activa con rol Administrador o Asesor
            del banco. Estado actual: {auth.profile.estado}.
          </p>
          <button
            className="button"
            onClick={() => void auth.signOut().catch(() => {})}
          >
            Cerrar sesión
          </button>
        </Card>
      </main>
    );
  return children;
}
