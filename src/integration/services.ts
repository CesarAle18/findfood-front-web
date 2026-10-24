import { ApiError, apiRequest } from "./http";
import type { ApiUser, Kpis, Page, Profile, UserFilters } from "./contracts";
export const profileService = {
  get: async (signal?: AbortSignal): Promise<Profile> => {
    let profile: Profile;
    try {
      profile = await apiRequest<Profile>("/panel/sesion", { signal });
    } catch (error) {
      // Older deployments expose /me only. Never ignore authentication or access denials.
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      profile = await apiRequest<Profile>("/me", { signal });
    }
    if (!profile.roles.some((role) => ["ADMIN", "ASESOR_BANCO"].includes(role))) {
      throw new ApiError({
        status: 403,
        type: "acceso-panel-denegado",
        title: "El panel web solo permite el acceso a administradores y asesores del banco.",
      });
    }
    return profile;
  },
  update: (body: { nombres: string; apellidos: string; telefono: string }) =>
    apiRequest<Profile>("/me", { method: "PATCH", body: JSON.stringify(body) }),
};
export interface CreateUserInput {
  rol: "ADMIN" | "ASESOR_BANCO";
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string;
}
export interface CreateUserResult {
  id: string;
  email: string;
  nombres: string;
  correo_enviado: boolean;
  password_temporal?: string;
}
export const userService = {
  changeStatus: (id: string, estado: "ACTIVO" | "INACTIVO") =>
    apiRequest<{ id: string; estado: "ACTIVO" | "INACTIVO" }>(
      `/admin/usuarios/${encodeURIComponent(id)}/estado`,
      { method: "PATCH", body: JSON.stringify({ estado }) },
    ),
  create: (body: CreateUserInput) =>
    apiRequest<CreateUserResult>("/admin/usuarios", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  list: (filters: UserFilters, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") params.set(key, String(value));
    });
    return apiRequest<Page<ApiUser>>(`/admin/usuarios?${params}`, { signal });
  },
};
export const dashboardService = {
  get: (signal?: AbortSignal) => apiRequest<Kpis>("/kpis/resumen", { signal }),
};


