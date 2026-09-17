import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type FormEvent,
} from "react";
import { href } from "../state/navigation";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-7 9 7v10H3zM9 20v-7h6v7",
    box: "m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 5 9-5M12 12v10",
    route: "M5 4v12a4 4 0 0 0 8 0V8a4 4 0 0 1 8 0M2 4h6M18 9l3 3 2-3",
    truck:
      "M2 4h13v13H2zM15 9h4l3 4v4h-7M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
    users:
      "M16 21v-3a6 6 0 0 0-12 0v3M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 3a4 4 0 0 1 0 8M19 14a5 5 0 0 1 3 5v2",
    chart: "M4 3v18h17M8 16v-4M13 16V8M18 16V5",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 1-3-5 3-3-1-4 4-2z",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-1 5 6 6",
    pin: "M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0zM14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    check: "m5 12 4 4L19 6",
    close: "m6 6 12 12M6 18 18 6",
    camera: "M3 6h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    mail: "M3 5h18v14H3zM3 5l9 8 9-8",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    menu: "M3 6h18M3 12h18M3 18h18",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    storage: "M3 21V8l9-5 9 5v13H3M7 21V11h10v10M7 15h10M7 18h10",
    clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
    logout: "M9 3H3v18h6M9 12h12m-4-4 4 4-4 4",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
export function Brand() {
  return (
    <a className="brand" href="#/inicio">
      <img src="/brand/findfood-logo.png" alt="" />
      <span>Find Food</span>
    </a>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const value = String(children);
  const tone = /Urgente|Rechaz|Inactivo|novedad/.test(value)
    ? "red"
    : /Alta|Pendiente|revisión|Parcial|progreso|recepción/.test(value)
      ? "amber"
      : "green";
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Card({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="section-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function LinkButton({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a className={`button ${secondary ? "secondary" : ""}`} href={to}>
      {children}
    </a>
  );
}
export function DemoButton({
  children,
  secondary = false,
  danger = false,
}: {
  children: ReactNode;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`button ${secondary ? "secondary" : ""} ${danger ? "danger" : ""}`}
      disabled
      title="Disponible al conectar el backend"
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Details({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="details">
      {items.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Metrics({ items }: { items: [string, string, string][] }) {
  return (
    <div className="metrics">
      {items.map(([label, value, detail]) => (
        <section className="metric" key={label}>
          <p>{label}</p>
          <strong>{value}</strong>
          <small>{detail}</small>
        </section>
      ))}
    </div>
  );
}
export function Photo({ label = "Fotografía de entrega" }: { label?: string }) {
  return (
    <div className="photo">
      <Icon name="camera" size={28} />
      <span>{label}</span>
      <small>Evidencia de ejemplo</small>
    </div>
  );
}
export function Drawer({
  title,
  close,
  children,
  footer,
}: {
  title: string;
  close: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        window.location.hash = close.slice(1);
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <a className="icon-button" href={close} aria-label="Cerrar panel">
          <Icon name="close" />
        </a>
      </header>
      <div className="drawer-body">{children}</div>
      <footer>
        {footer || (
          <LinkButton to={close} secondary>
            Cerrar
          </LinkButton>
        )}
      </footer>
    </dialog>
  );
}
export function PrototypeForm({ children }: { children: ReactNode }) {
  return (
    <form
      onSubmit={(event: FormEvent) => event.preventDefault()}
      className="form-stack"
    >
      {children}
    </form>
  );
}
export function MapPreview({
  compact = false,
  stops = 4,
}: {
  compact?: boolean;
  stops?: number;
}) {
  const points = [
    [90, 200],
    [230, 160],
    [320, 80],
    [480, 120],
    [540, 210],
  ].slice(0, stops);
  return (
    <div className={`map ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 600 270"
        role="img"
        aria-label={`Esquema de ${stops} paradas. No representa ubicación real.`}
      >
        <rect width="600" height="270" fill="#edf2ed" />
        {[55, 130, 210].map((y) => (
          <path
            key={y}
            d={`M0 ${y} L600 ${y - 30}`}
            stroke="white"
            strokeWidth="18"
          />
        ))}
        {[100, 240, 390, 530].map((x) => (
          <path
            key={x}
            d={`M${x} 0 L${x + 45} 270`}
            stroke="white"
            strokeWidth="15"
          />
        ))}
        <path
          d={points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}
          stroke="#1f7a5a"
          strokeWidth="5"
          fill="none"
        />
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="16"
              fill="#1f7a5a"
              stroke="white"
              strokeWidth="3"
            />
            <text
              x={x}
              y={y + 5}
              textAnchor="middle"
              fill="white"
              fontSize="13"
              fontWeight="700"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <span className="map-label">
        <Icon name="pin" size={14} /> Bogotá · esquema de demostración
      </span>
    </div>
  );
}
export function NoticePanel({ close }: { close: string }) {
  const [tab, setTab] = useState("Todas");
  return <NoticeContent close={close} tab={tab} setTab={setTab} />;
}
import { useData } from "../state/data-context";
function NoticeContent({
  close,
  tab,
  setTab,
}: {
  close: string;
  tab: string;
  setTab: (tab: string) => void;
}) {
  const { notices } = useData();
  const filtered = notices.filter(
    (n) => tab === "Todas" || (tab === "No leídas" ? n.unread : n.important),
  );
  return (
    <Drawer title="Notificaciones" close={close}>
      <div className="tabs">
        {["Todas", "No leídas", "Importantes"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {[...new Set(filtered.map((n) => n.group))].map((group) => (
        <section key={group} className="notice-group">
          <h3>{group}</h3>
          {filtered
            .filter((n) => n.group === group)
            .map((n) => (
              <a
                href={href(
                  group === "Postulantes voluntarios"
                    ? "/pendientes"
                    : group === "Asignaciones"
                      ? "/asignaciones"
                      : group === "Alertas del sistema"
                        ? "/inventario"
                        : "/donaciones",
                )}
                className={`notice ${n.unread ? "unread" : ""}`}
                key={n.id}
              >
                <Icon name="bell" />
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.detail}</p>
                  <small>{n.time}</small>
                </div>
              </a>
            ))}
        </section>
      ))}
    </Drawer>
  );
}
