import type { Row } from "./actions";

export type ActivityKind = "route" | "donation" | "user" | "pending" | "volunteer";
export type ActivitySnapshot = Record<string, { estado: string }>;
export type ActivityEvent = { id: string; titulo: string; cuerpo: string; href: string };
export const recentPendingDays = 7;
const definitions: Record<ActivityKind, { title: string; href: string }> = {
  route: { title: "Se ha creado una nueva ruta", href: "#/rutas" },
  donation: { title: "Se ha creado una nueva donación", href: "#/donaciones" },
  user: { title: "Se ha creado un nuevo usuario", href: "#/usuarios" },
  pending: { title: "Hay un nuevo voluntario pendiente de aprobación", href: "#/pendientes" },
  volunteer: { title: "Se aceptó a un nuevo voluntario", href: "#/voluntarios" },
};

// Deadlines do not imply expiry: only authoritative API states do.
export function activityEvents(kind: ActivityKind, rows: Row[], previous: ActivitySnapshot | null, now = Date.now()) {
  const snapshot: ActivitySnapshot = { ...previous };
  const events: ActivityEvent[] = [];
  for (const row of rows) {
    if (row.id == null) continue;
    const id = String(row.id), old = previous?.[id], estado = String(row.estado ?? "");
    const person = row.usuario && typeof row.usuario === "object" ? row.usuario as Row : row;
    const name = [person.nombres, person.apellidos].filter(Boolean).join(" ");
    const description = String(row.codigo ?? (name || row.email || id));
    const definition = definitions[kind];
    const created = typeof row.created_at === "string" ? Date.parse(row.created_at) : NaN;
    const recent = Number.isFinite(created) && created <= now && now - created <= recentPendingDays * 86400000;
    if (!old && (previous !== null || (kind === "pending" && recent))) {
      events.push({ id: `${kind}:${id}`, titulo: kind === "pending" && previous === null ? "Tienes un voluntario pendiente reciente" : definition.title, cuerpo: description, href: definition.href });
    }
    if (old && old.estado !== estado) {
      if (kind === "donation" && estado === "CANCELADA") events.push({ id: `donation-cancelled:${id}`, titulo: "Se canceló una donación", cuerpo: description, href: definition.href });
      if (kind === "donation" && estado === "EXPIRADA") events.push({ id: `donation-expired:${id}`, titulo: "Una donación se ha vencido", cuerpo: description, href: definition.href });
      if (kind === "route" && estado === "COMPLETADA") events.push({ id: `route-completed:${id}`, titulo: "Una ruta ha finalizado", cuerpo: description, href: definition.href });
      if (kind === "user" && estado === "ACTIVO" && ["PENDIENTE", "PENDIENTE_VERIFICACION"].includes(old.estado)) events.push({ id: `user-approved:${id}`, titulo: "Se aprobó un usuario", cuerpo: description, href: definition.href });
    }
    snapshot[id] = { estado };
  }
  return { snapshot, events };
}
