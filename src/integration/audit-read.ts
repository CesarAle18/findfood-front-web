import { ApiError, apiRequest } from "./http";
import { parseAudit, type AuditEntry } from "./audit";

export async function loadGlobalAudit(endpoint: string, signal: AbortSignal): Promise<AuditEntry[]> {
  const entries: AuditEntry[] = [];
  const seen = new Set<string>();
  const snapshot = new URL(endpoint, "https://local.invalid");
  if (!snapshot.searchParams.has("hasta")) snapshot.searchParams.set("hasta", new Date().toISOString());
  endpoint = `${snapshot.pathname}?${snapshot.searchParams}`;
  let offset = 0;
  while (!signal.aborted) {
    let page: { datos: AuditEntry[]; total: number };
    try {
      page = await apiRequest(`${endpoint}${endpoint.includes("?") ? "&" : "?"}limite=100&desplazamiento=${offset}`, { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw new Error("El reporte global aún no está habilitado en el servidor. No es posible consultar los movimientos de todos los usuarios por ahora.", { cause: error });
      throw error;
    }
    if (!page || !Array.isArray(page.datos) || !Number.isInteger(page.total) || page.total < 0) throw new Error("El servidor no devolvió un reporte de auditoría válido.");
    const valid = parseAudit(JSON.stringify(page.datos));
    if (valid.length !== page.datos.length) throw new Error("Hay registros de auditoría con formato incompleto.");
    let added = 0;
    for (const entry of valid) if (!seen.has(entry.id)) { seen.add(entry.id); entries.push(entry); added++; }
    offset += page.datos.length;
    if (offset >= page.total) return entries;
    if (!added || offset >= 10000) throw new Error("No fue posible completar el reporte. Reduce el periodo de fechas y vuelve a consultar.");
  }
  signal.throwIfAborted();
  return entries;
}
