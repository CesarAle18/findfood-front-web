import { integrationConfig } from "./config";
import { supabase } from "./supabase";
import type { Problem } from "./contracts";
export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  constructor(problem: Problem) {
    super(
      [problem.detail || problem.title, ...(problem.errores || [])].join(" · "),
    );
    this.name = "ApiError";
    this.status = problem.status;
    this.type = problem.type;
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación.";
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!supabase) throw new Error("Falta configurar la conexión.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session)
    throw new ApiError({
      status: 401,
      type: "no-autenticado",
      title: "Inicia sesión para continuar.",
    });
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  headers.set("Accept", "application/json, application/problem+json");
  if (options.body) headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(20000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(`${integrationConfig.apiUrl}${path}`, {
      ...options,
      headers,
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(
      timeout.aborted
        ? "La API tardó demasiado en responder. Intenta nuevamente."
        : "No se pudo conectar con la API. Revisa su URL y la configuración de CORS.",
      { cause: error },
    );
  }
  if (!response.ok) {
    const problem = (await response
      .json()
      .catch(() => ({}))) as Partial<Problem>;
    if (response.status === 401)
      window.dispatchEvent(new Event("findfood:session-expired"));
    if (problem.type === "cambio-password-requerido")
      window.dispatchEvent(new Event("findfood:refresh-profile"));
    throw new ApiError({
      ...problem,
      status: response.status,
      type: problem.type || "http-error",
      title: problem.title || `Error de la API (${response.status}).`,
    });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
