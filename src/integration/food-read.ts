import type { Row } from "./actions";
import type { Page } from "./contracts";
import { ApiError, apiRequest } from "./http";

export interface FoodPage extends Page<Row> {
  activeOnly?: boolean;
}

export async function loadFoodPage(endpoint: string, signal: AbortSignal): Promise<FoodPage> {
  try {
    const page = await apiRequest<FoodPage>(endpoint, { signal });
    if (!page || !Array.isArray(page.datos) || !Number.isInteger(page.total)) throw new Error("No fue posible leer el listado de alimentos.");
    return page;
  } catch (error) {
    // Solo compatibilidad con servidores sin el GET administrativo.
    // Los rechazos de autenticación o permisos no deben usar un catálogo alternativo.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    const catalog = await apiRequest<{ tipos_alimento: Row[] }>("/catalogos?incluir=tipos_alimento", { signal });
    if (!Array.isArray(catalog?.tipos_alimento)) throw new Error("No fue posible consultar el catálogo de alimentos activos.", { cause: error });
    const params = new URL(endpoint, "https://local.invalid").searchParams;
    const search = (params.get("q") ?? "").toLocaleLowerCase("es");
    const regime = params.get("tipo_almacenamiento");
    const limit = Number(params.get("limite")) || 20;
    const offset = Number(params.get("desplazamiento")) || 0;
    const rows = params.get("estado") === "INACTIVO" ? [] : catalog.tipos_alimento
      .filter((row) => (!search || `${row.codigo ?? ""} ${row.nombre ?? ""}`.toLocaleLowerCase("es").includes(search)) && (!regime || row.tipo_almacenamiento === regime))
      .map((row) => ({ ...row, activo: true }));
    return { datos: rows.slice(offset, offset + limit), total: rows.length, limite: limit, desplazamiento: offset, activeOnly: true };
  }
}
