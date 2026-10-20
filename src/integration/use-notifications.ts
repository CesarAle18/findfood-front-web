import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "./http";
import type { Row } from "./actions";

// Fetch every page so local and remote notices share one chronological list.
export function useNotifications() {
  const [data, setData] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const records = new Map<string, Row>();
        let offset = 0;
        while (!controller.signal.aborted) {
          const response = await apiRequest<unknown>(`/me/notificaciones?limite=100&desplazamiento=${offset}`, { signal: controller.signal });
          const page = response as { datos?: unknown; total?: number } | null;
          const rows = Array.isArray(response) ? response : page?.datos;
          if (!Array.isArray(rows)) throw new Error("No fue posible consultar la lista de notificaciones.");
          const before = records.size;
          for (const row of rows) {
            if (row && typeof row === "object" && row.id != null) records.set(String(row.id), row);
          }
          if (Array.isArray(response) || !rows.length || offset + rows.length >= Number(page?.total)) break;
          if (!Number.isFinite(Number(page?.total)) || before === records.size) throw new Error("No fue posible completar la consulta de notificaciones.");
          offset += rows.length;
        }
        if (!controller.signal.aborted) { setData([...records.values()]); setError(""); }
      } catch (err) {
        if (!controller.signal.aborted) setError(errorMessage(err));
      } finally { busy = false; }
    }
    void load();
    const refreshVisible = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refreshVisible, 15000);
    window.addEventListener("findfood:data-changed", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("findfood:data-changed", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [attempt]);
  return { data, error, loading: data === null && !error, refresh: () => setAttempt((n) => n + 1) };
}
