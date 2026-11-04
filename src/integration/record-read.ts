import type { Row } from "./actions";
import type { Page } from "./contracts";
import { apiRequest } from "./http";
import { matchesId } from "./id-search";

type Result<T> = Page<T> & { activeOnly?: boolean };
export async function loadIdPage<T extends object = Row>(
  endpoint: string,
  signal: AbortSignal,
  load: (endpoint: string, signal: AbortSignal) => Promise<Result<T> | T[]> = (path, requestSignal) => apiRequest(path, { signal: requestSignal }),
  include: (row: T) => boolean = () => true,
): Promise<Result<T>> {
  const url = new URL(endpoint, "https://local.invalid");
  const query = url.searchParams.get("buscar_id") ?? "";
  url.searchParams.delete("buscar_id");
  const paginated = url.searchParams.has("limite");
  const limit = Number(url.searchParams.get("limite")) || 20;
  const offset = Number(url.searchParams.get("desplazamiento")) || 0;
  const rows: T[] = [];
  const seen = new Set<string>();
  let start = 0;
  let activeOnly: boolean | undefined;
  while (!signal.aborted) {
    if (paginated) { url.searchParams.set("limite", "100"); url.searchParams.set("desplazamiento", String(start)); }
    const result = await load(`${url.pathname}${url.search ? url.search : ""}`, signal);
    const batch = Array.isArray(result) ? result : result.datos;
    if (!Array.isArray(batch)) throw new Error("No fue posible leer los registros.");
    if (!Array.isArray(result)) activeOnly = result.activeOnly;
    let added = 0;
    for (const row of batch) {
      const record = row as Row;
      const key = String(record.id ?? record.lote_id ?? JSON.stringify(row));
      if (seen.has(key)) continue;
      seen.add(key); added++;
      if (include(row) && matchesId(row, query)) rows.push(row);
    }
    start += batch.length;
    if (Array.isArray(result) || !paginated || start >= result.total) break;
    if (!added || !Number.isInteger(result.total) || start >= 10000) throw new Error("No fue posible completar la búsqueda por ID. Reduce los demás filtros y vuelve a intentarlo.");
  }
  signal.throwIfAborted();
  return { datos: paginated ? rows.slice(offset, offset + limit) : rows, total: rows.length, limite: limit, desplazamiento: offset, ...(activeOnly === undefined ? {} : { activeOnly }) };
}
