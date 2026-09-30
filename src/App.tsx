import { Fragment, useEffect, useState } from "react";
import { Brand, Card, Icon, NoticePanel } from "./components/ui";
import { Management, EntityPanel } from "./pages/Management";
import {
  Assignments,
  Dashboard,
  Password,
  Pending,
  Reception,
  Routes,
  Settings,
} from "./pages/Operations";
import { Auth } from "./pages/Auth";
import { DataContext } from "./state/data-context";
import { useRoute } from "./state/navigation";
import type { ModuleKey, WebData } from "./domain/models";
import { demoData } from "./data/demo";
import { demoRepository, type WebRepository } from "./services/web-repository";
import { modules } from "./data/modules";
import { screens } from "./data/screens";
import "./App.css";

const navigation = [
  ["/inicio", "Inicio", "home"],
  ["/donaciones", "Donaciones", "box"],
  ["/rutas", "Rutas", "route"],
  ["/recepciones", "Recepción", "truck"],
  ["/inventario", "Inventario", "box"],
  ["/almacenes", "Almacenes", "storage"],
  ["/usuarios", "Usuarios", "users"],
  ["/reportes", "Reportes", "chart"],
  ["/configuracion", "Configuración", "settings"],
];

const headings: Record<string, [string, string]> = {
  "/login": ["Inicio de sesión", ""],
  "/recuperar-contrasena": ["Recuperar contraseña", ""],
  "/inicio": [
    "Dashboard operativo",
    "Visión en tiempo real de donaciones, rutas e inventario.",
  ],
  "/asignaciones": [
    "Motor de asignación",
    "Candidatos ordenados por filtros duros y puntaje multicriterio.",
  ],
  "/rutas": [
    "Rutas y seguimiento",
    "Monitorea recorridos, paradas y tiempos estimados.",
  ],
  "/pendientes": [
    "Pendientes por postulantes",
    "Solicitudes de voluntariado que requieren decisión.",
  ],
  "/recepcion": [
    "Recepción de donaciones",
    "Registra aceptación total, parcial o rechazo y genera lotes de inventario.",
  ],
  "/configuracion": [
    "Configuración",
    "Parámetros del motor de asignación y límites operativos.",
  ],
  "/cambiar-contrasena": [
    "Cambio de contraseña",
    "Actualiza tu contraseña de forma segura.",
  ],
  "/restablecer-contrasena": [
    "Cambio de contraseña",
    "Actualiza tu contraseña de forma segura.",
  ],
  "/pantallas": [
    "Pantallas del diseño",
    "Explora los módulos y paneles de Find Food.",
  ],
};

export default function App({
  initialPath,
  repository = demoRepository,
}: {
  initialPath?: string;
  repository?: WebRepository;
}) {
  const route = useRoute(initialPath);

  const [menu, setMenu] = useState(false);

  const [usersOpen, setUsersOpen] = useState(
    ["/usuarios", "/voluntarios", "/pendientes"].includes(route.pathname),
  );

  const [data, setData] = useState<WebData | null>(
    repository === demoRepository ? demoData : null,
  );

  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    repository
      .load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
        }
      });

    return () => controller.abort();
  }, [repository, attempt]);

  const key = route.pathname.slice(1) as ModuleKey;
  const config = modules[key];

  const heading = config
    ? [config.title, config.description]
    : headings[route.pathname] || [
        "Página no encontrada",
        "El enlace no corresponde a una pantalla disponible.",
      ];

  const title = heading[0];

  useEffect(() => {
    document.title = `${title} · Find Food`;
  }, [title]);

  if (!data) {
    return (
      <main className="loading" role="status">
        {error ? (
          <>
            <h1>No fue posible cargar la información</h1>

            <button
              className="button"
              onClick={() => {
                setError(false);
                setAttempt((n) => n + 1);
              }}
            >
              Reintentar
            </button>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p>Cargando Find Food…</p>
          </>
        )}
      </main>
    );
  }

  if (
    route.pathname === "/login" ||
    route.pathname === "/recuperar-contrasena"
  ) {
    return <Auth forgot={route.pathname === "/recuperar-contrasena"} />;
  }

  const panel = route.params.get("panel");
  const id = route.params.get("id");

  const noticeParams = new URLSearchParams(route.params);
  noticeParams.set("panel", "notificaciones");

  const noticeHref =
    "#" + route.pathname + "?" + noticeParams.toString();

  const closeParams = new URLSearchParams(route.params);
  closeParams.delete("panel");

  const closeNoticeHref =
    "#" +
    route.pathname +
    (closeParams.size ? "?" + closeParams.toString() : "");

  const drawerModule =
    route.pathname === "/pendientes"
      ? "voluntarios"
      : config
        ? key
        : null;

  const volunteersActive = [
    "/voluntarios",
    "/pendientes",
  ].includes(route.pathname);

  const content = config ? (
    <Management key={key} module={key} />
  ) : route.pathname === "/inicio" ? (
    <Dashboard />
  ) : route.pathname === "/asignaciones" ? (
    <Assignments key={id} id={id} />
  ) : route.pathname === "/rutas" ? (
    <Routes />
  ) : route.pathname === "/pendientes" ? (
    <Pending />
  ) : route.pathname === "/recepcion" ? (
    <Reception
      key={id}
      id={id}
      volunteerId={route.params.get("voluntario")}
    />
  ) : route.pathname === "/configuracion" ? (
    <Settings />
  ) : route.pathname === "/cambiar-contrasena" ||
    route.pathname === "/restablecer-contrasena" ? (
    <Password recovery={route.pathname === "/restablecer-contrasena"} />
  ) : route.pathname === "/pantallas" ? (
    <Card>
      <div className="gallery">
        {screens.map(([label, to]) => (
          <a key={label} href={"#" + to}>
            <span>{label}</span>
            <Icon name="arrow" />
          </a>
        ))}
      </div>
    </Card>
  ) : (
    <Card>
      <p>Selecciona un módulo del menú o vuelve al inicio.</p>

      <a href="#/inicio" className="button">
        Volver al inicio
      </a>
    </Card>
  );

  return (
    <DataContext.Provider value={data}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar al contenido
      </a>

      <div className="app-shell">
        <aside className={`sidebar ${menu ? "open" : ""}`}>
          <Brand />

          <nav aria-label="Navegación principal">
            {navigation.map(([path, label, icon]) => {
              const isUsers = path === "/usuarios";

              const active =
                route.pathname === path ||
                (path === "/recepciones" &&
                  route.pathname === "/recepcion") ||
                (path === "/donaciones" &&
                  route.pathname === "/asignaciones");

              return (
                <Fragment key={path}>
                  <a
                    href={"#" + path}
                    className={active ? "active" : ""}
                    aria-current={
                      route.pathname === path ? "page" : undefined
                    }
                    aria-expanded={isUsers ? usersOpen : undefined}
                    aria-controls={
                      isUsers ? "users-submenu" : undefined
                    }
                    onClick={() => {
                      if (isUsers) {
                        setUsersOpen((open) => !open);
                      } else {
                        setMenu(false);
                      }
                    }}
                  >
                    <Icon name={icon} />
                    <span>{label}</span>
                  </a>

                  {isUsers && usersOpen && (
                    <div
                      id="users-submenu"
                      className="user-submenu"
                      role="group"
                      aria-label="Submenú de usuarios"
                    >
                      <a
                        href="#/voluntarios"
                        className={volunteersActive ? "active" : ""}
                        aria-current={
                          route.pathname === "/voluntarios"
                            ? "page"
                            : undefined
                        }
                        onClick={() => setMenu(false)}
                      >
                        Lista de voluntarios
                      </a>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </nav>

          <div className="sidebar-bottom">
            <a href="#/pantallas">
              <Icon name="eye" size={16} />
              Ver todas las pantallas
            </a>

            <span className="demo-pill">
              Datos de demostración
            </span>
          </div>
        </aside>

        {menu && (
          <button
            className="sidebar-scrim"
            aria-label="Cerrar menú"
            onClick={() => setMenu(false)}
          />
        )}

        <main
          id="main-content"
          className="main-content"
          tabIndex={-1}
        >
         <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir menú"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
          >
            <Icon name="menu" />
          </button>

          <div className="page-heading">
            <h1>{heading[0]}</h1>
            <p>{heading[1]}</p>
          </div>

          <div className="top-actions">
            <a
              className="notification-button"
              href={noticeHref}
              aria-label="Abrir notificaciones, 3 sin leer"
            >
              <Icon name="bell" />
              <span>3</span>
            </a>

            <details className="account-menu">
              <summary aria-label="Menú de cuenta">
                <span className="avatar">AM</span>
              </summary>

              <div>
                <strong>Administrador</strong>

                <a href="#/cambiar-contrasena">
                  Cambiar contraseña
                </a>

                <a href="#/login">
                  <Icon name="logout" size={16} />
                  Cerrar sesión
                </a>
              </div>
            </details>
          </div>
        </header>

          <div className="page-content">{content}</div>

          <footer className="app-footer">
            Find Food · Banco de alimentos
            <span>Vista de demostración</span>
          </footer>
        </main>
      </div>

      {panel === "notificaciones" ? (
        <NoticePanel close={closeNoticeHref} />
      ) : panel && drawerModule ? (
        <EntityPanel
          key={route.path}
          module={drawerModule}
          panel={panel}
          id={id}
          base={route.pathname}
        />
      ) : null}
    </DataContext.Provider>
  );
}