import { useEffect, useState } from "react";
import { Badge, Card, Icon } from "../components/ui";
import { userService } from "./services";
import { errorMessage } from "./http";
import { roleLabels, statusLabels } from "./contracts";
import type { ApiUser, Page, Role, UserFilters, UserStatus } from "./contracts";
import { useSession } from "./session-context";
import { UserDrawer } from "./UserDrawer";
export function UsersLive() {
  const auth = useSession()!;
  const [filters, setFilters] = useState<UserFilters>({
    q: "",
    rol: "",
    estado: "",
    limite: 20,
    desplazamiento: 0,
  });
  const [page, setPage] = useState<Page<ApiUser> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [creating, setCreating] = useState(false);
  const admin = auth.profile?.roles.includes("ADMIN");
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      setPage(null);
      userService
        .list(filters, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setPage(result);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setError(errorMessage(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, attempt, admin]);
  if (!admin)
    return (
      <Card title="Usuarios">
        <p role="alert">Esta consulta requiere el rol Administrador.</p>
      </Card>
    );
  const update = (values: Partial<UserFilters>) => {
    setLoading(true);
    setPage(null);
    setSelected(null);
    setFilters((previous) => ({ ...previous, ...values, desplazamiento: 0 }));
  };
  return (
    <>
      <Card className="table-card">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre o correo…"
              maxLength={100}
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
            />
          </label>
          <select
            aria-label="Rol"
            value={filters.rol}
            onChange={(e) => update({ rol: e.target.value })}
          >
            <option value="">Rol: Todos</option>
            {Object.entries(roleLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado"
            value={filters.estado}
            onChange={(e) => update({ estado: e.target.value })}
          >
            <option value="">Estado: Todos</option>
            {Object.entries(statusLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="button secondary"
            onClick={() => {
              setLoading(true);
              setPage(null);
              setAttempt((n) => n + 1);
            }}
          >
            Actualizar lista
          </button>
          <button
            className="button"
            onClick={() => {
              setSelected(null);
              setCreating(true);
            }}
          >
            + Nuevo usuario
          </button>
        </div>
        {loading ? (
          <p className="integration-state" role="status">
            Cargando usuarios…
          </p>
        ) : error ? (
          <div className="integration-state">
            <p className="integration-error" role="alert">
              {error}
            </p>
            <button
              className="button"
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              aria-label="Tabla de usuarios"
            >
              <table>
                <thead>
                  <tr>
                    {[
                      "Nombre",
                      "Correo",
                      "Rol",
                      "Estado",
                      "Teléfono",
                      "Último acceso",
                      "Acciones",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page?.datos.map((user) => (
                    <tr key={user.id}>
                      <td>
                        {[user.nombres, user.apellidos]
                          .filter(Boolean)
                          .join(" ")}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {user.roles
                          .map((role) => roleLabels[role as Role] || role)
                          .join(", ") || "Sin rol"}
                      </td>
                      <td>
                        <Badge>
                          {statusLabels[user.estado as UserStatus] ||
                            user.estado}
                        </Badge>
                      </td>
                      <td>{user.telefono || "—"}</td>
                      <td>
                        {user.ultimo_acceso_at
                          ? new Date(user.ultimo_acceso_at).toLocaleString(
                              "es-CO",
                              { timeZone: "America/Bogota" },
                            )
                          : "Sin acceso"}
                      </td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() => setSelected(user)}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!page?.datos.length && (
                    <tr>
                      <td colSpan={7}>
                        No se encontraron usuarios con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="integration-pagination">
              <span>
                {page?.total
                  ? `${filters.desplazamiento + 1}–${filters.desplazamiento + page.datos.length} de ${page.total} usuarios`
                  : "0 usuarios"}
              </span>
              <div className="card-actions">
                <button
                  className="button secondary"
                  disabled={filters.desplazamiento === 0}
                  onClick={() => {
                    setLoading(true);
                    setPage(null);
                    setFilters((f) => ({
                      ...f,
                      desplazamiento: Math.max(0, f.desplazamiento - f.limite),
                    }));
                  }}
                >
                  Anterior
                </button>
                <button
                  className="button secondary"
                  disabled={
                    !page ||
                    filters.desplazamiento + page.datos.length >= page.total
                  }
                  onClick={() => {
                    setLoading(true);
                    setPage(null);
                    setFilters((f) => ({
                      ...f,
                      desplazamiento: f.desplazamiento + f.limite,
                    }));
                  }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
      {(selected || creating) && (
        <UserDrawer
          key={selected?.id || "new"}
          user={selected}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
          onSaved={() => {
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
