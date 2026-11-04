import type { Row } from "./actions";
import type { Page } from "./contracts";
import { apiRequest } from "./http";
import { matchesId } from "./id-search";

// Filtra antes de paginar para que no queden páginas vacías ni totales de expiradas.
export async function loadAdvisorDonations(endpoint: string, signal: AbortSignal): Promise<Page<Row>> {
  const url = new URL(endpoint, "https://local.invalid");
  const idSearch = url.searchParams.get("buscar_id") ?? "";
  url.searchParams.delete("buscar_id");
  const limit = Number(url.searchParams.get("limite")) || 20;
  const offset = Number(url.searchParams.get("desplazamiento")) || 0;
  const rows: Row[] = [];
  const seen = new Set<string>();
  let start = 0;
  while (!signal.aborted) {
    url.searchParams.set("limite", "100");
    url.searchParams.set("desplazamiento", String(start));
    const result = await apiRequest<Page<Row> | Row[]>(`${url.pathname}?${url.searchParams}`, { signal });
    const batch = Array.isArray(result) ? result : result.datos;
    if (!Array.isArray(batch)) throw new Error("No fue posible consultar las donaciones.");
    let added = 0;
    for (const row of batch) {
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id); added++;
      if (row.estado !== "EXPIRADA" && matchesId(row, idSearch)) rows.push(row);
    }
    start += batch.length;
    if (Array.isArray(result) || start >= result.total) break;
    if (!added || !Number.isFinite(result.total) || start >= 10000) throw new Error("No fue posible completar la consulta de donaciones.");
  }
  signal.throwIfAborted();
  return { datos: rows.slice(offset, offset + limit), total: rows.length, limite: limit, desplazamiento: offset };
}
