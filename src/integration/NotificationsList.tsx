import { useRef, useState } from "react";
import { Card, Icon } from "../components/ui";
import { useSession } from "./session-context";
import { readActivity, useActivity } from "./activity";
import { textValue } from "./read-format";
import { apiRequest, errorMessage } from "./http";
import { useNotifications } from "./use-notifications";
import { notificationTarget } from "./notification-target";

export function NotificationsList() {
  const user = useSession()?.session?.user.id ?? "";
  const local = useActivity(user);
  const server = useNotifications();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const remote = (server.data ?? []).map((n) => ({
    id: String(n.id), key: `server:${n.id}`, local: false,
    titulo: String(n.titulo ?? "Notificación"), cuerpo: String(n.cuerpo ?? ""),
    created_at: String(n.created_at ?? ""), leida_at: n.leida_at,
    href: notificationTarget(n),
  }));
  const notices = [
    ...local.map((n) => ({ ...n, key: `local:${n.id}`, local: true })),
    ...remote,
  ].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  const filtered = notices.filter((n) => `${n.titulo} ${n.cuerpo}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  async function markRead(notice?: typeof notices[number]) {
    if (lock.current) return;
    if (notice?.local) { readActivity(user, notice.id); return; }
    if (!notice) readActivity(user);
    if (!notice && server.data && !remote.some((n) => !n.leida_at)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await apiRequest(notice ? `/me/notificaciones/${encodeURIComponent(notice.id)}/leer` : "/me/notificaciones/leer-todas", { method: "POST", body: "{}" });
      server.refresh();
      window.dispatchEvent(new Event("findfood:data-changed"));
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Card className="notifications-card">
    <div className="notifications-toolbar">
      <label className="search"><Icon name="search" /><input aria-label="Buscar notificaciones" placeholder="Buscar notificaciones…" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(20); }} /></label>
      <button className="button secondary" onClick={() => { server.refresh(); window.dispatchEvent(new Event("findfood:data-changed")); }}>Actualizar lista</button>
      <button className="button secondary" disabled={busy || !notices.some((n) => !n.leida_at)} onClick={() => void markRead()}>Marcar todas como leídas</button>
    </div>
    {error && <p role="alert" className="integration-error">{error}</p>}
    {server.error && <p role="alert" className="integration-error">{server.error} Puedes consultar los avisos ya disponibles y volver a intentarlo con Actualizar lista.</p>}
    {server.loading && <p role="status">Cargando notificaciones…</p>}
    {filtered.length > 0 ? <ul className="activity-list">{filtered.slice(0, limit).map((n) => <li key={n.key} className={n.leida_at ? "" : "is-unread"}>
      {n.href ? <a href={n.href} onClick={() => { if (!n.leida_at) void markRead(n); }}><strong>{n.titulo}</strong><span>{n.cuerpo}</span></a> : <div><strong>{n.titulo}</strong><p>{n.cuerpo}</p></div>}
      {n.created_at && <time dateTime={n.created_at}>{textValue(n.created_at)}</time>}
      <div className="notification-read-state">{n.leida_at ? <span>Leída</span> : <button className="table-action" disabled={busy} onClick={() => void markRead(n)}>Marcar leída</button>}</div>
    </li>)}</ul> : !server.loading && <p role="status">{search ? "No se encontraron notificaciones con esa búsqueda." : "No hay notificaciones por ahora."}</p>}
    <div className="integration-pagination"><span>{filtered.length} {filtered.length === 1 ? "notificación" : "notificaciones"}</span>{filtered.length > limit && <button className="button secondary" onClick={() => setLimit((n) => n + 20)}>Mostrar más</button>}</div>
  </Card>;
}
