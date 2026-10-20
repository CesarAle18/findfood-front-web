import { useEffect } from "react";
import { apiRequest } from "./http";
import { useSession } from "./session-context";
import { addActivity } from "./activity";
import { activityEvents, type ActivityKind, type ActivitySnapshot } from "./activity-events";
import type { Row } from "./actions";

// Reference states persist per account. Shared delivery belongs to the API.
export function useActivityObserver() {
  const auth = useSession();
  const user = auth?.session?.user.id;
  const admin = auth?.profile?.roles.includes("ADMIN") ?? false;
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const known = new Map<ActivityKind, ActivitySnapshot>();
    let busy = false;
    const sources: { path: string; kind: ActivityKind }[] = [
      { path: "/rutas", kind: "route" },
      { path: "/donaciones", kind: "donation" },
      ...(admin ? [
        { path: "/admin/usuarios", kind: "user" as const },
        { path: "/admin/verificaciones?estado=PENDIENTE", kind: "pending" as const },
        { path: "/admin/verificaciones?estado=APROBADA", kind: "volunteer" as const },
      ] : []),
    ];
    const storageKey = (kind: ActivityKind) => `findfood:activity-snapshot:${user}:${kind}`;
    for (const source of sources) {
      try {
        const raw = localStorage.getItem(storageKey(source.kind));
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (saved && typeof saved === "object" && !Array.isArray(saved) && Object.values(saved).every((value) => value && typeof value === "object" && typeof value.estado === "string")) known.set(source.kind, saved as ActivitySnapshot);
        }
      } catch { /* Start a fresh reference if storage is unavailable. */ }
    }
    async function observe(source: typeof sources[number]) {
      const rows: Row[] = [];
      let offset = 0;
      const ids = new Set<string>();
      while (!controller.signal.aborted) {
        const separator = source.path.includes("?") ? "&" : "?";
        const result = await apiRequest<unknown>(`${source.path}${separator}limite=100&desplazamiento=${offset}`, { signal: controller.signal });
        const page = result as { datos?: unknown; total?: number } | null;
        const batch = Array.isArray(result) ? result : page?.datos;
        if (!Array.isArray(batch)) throw new Error("La API no devolvió una lista de actividad válida.");
        let added = 0;
        for (const row of batch) {
          if (!row || typeof row !== "object" || row.id == null || ids.has(String(row.id))) continue;
          ids.add(String(row.id)); rows.push(row); added++;
        }
        if (Array.isArray(result) || !batch.length || offset + batch.length >= Number(page?.total)) break;
        if (!Number.isFinite(Number(page?.total)) || !added) throw new Error("No fue posible completar la consulta de actividad.");
        offset += batch.length;
      }
      if (controller.signal.aborted) return;
      const { snapshot, events } = activityEvents(source.kind, rows, known.get(source.kind) ?? null);
      for (const event of events) addActivity(user!, event);
      known.set(source.kind, snapshot);
      try { localStorage.setItem(storageKey(source.kind), JSON.stringify(snapshot)); } catch { /* Retain the in-memory reference. */ }
    }
    async function poll() {
      if (busy || controller.signal.aborted || document.visibilityState !== "visible") return;
      busy = true;
      try { await Promise.allSettled(sources.map(observe)); }
      finally { busy = false; }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 15000);
    const refresh = () => void poll();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("findfood:data-changed", refresh);
    return () => {
      controller.abort(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("findfood:data-changed", refresh);
    };
  }, [user, admin]);
}
