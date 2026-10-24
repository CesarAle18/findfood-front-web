import { integrationConfig } from "./config";
import { ApiError } from "./http";
export async function requestPanelRecovery(email: string) {
  let response: Response;
  try {
    response = await fetch(`${integrationConfig.apiUrl}/panel/recuperar-contrasena`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, application/problem+json" },
      body: JSON.stringify({ email }), signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error("No fue posible enviar la solicitud de recuperación. Intenta nuevamente."); }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError({ status: response.status, type: problem.type ?? "http-error", title: problem.title ?? "No fue posible solicitar la recuperación.", detail: problem.detail });
  }
}
