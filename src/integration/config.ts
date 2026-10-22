export const integrationConfig = {
  mode: import.meta.env.VITE_DATA_MODE || "api",
  apiUrl: (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  // Opcionales: sin llave los mapas muestran un aviso y las coordenadas se escriben a mano.
  mapsKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "",
};
export const mapsEnabled = () => Boolean(integrationConfig.mapsKey);
export function configurationError(): string | null {
  if (integrationConfig.mode === "demo") return null;
  if (integrationConfig.mode !== "api")
    return "VITE_DATA_MODE debe ser api o demo.";
  for (const [name, value] of [
    ["VITE_API_URL", integrationConfig.apiUrl],
    ["VITE_SUPABASE_URL", integrationConfig.supabaseUrl],
  ]) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return `Configura ${name} en el archivo .env.local.`;
    }
  }
  const key = integrationConfig.supabaseKey;
  if (!key) return "Configura VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.";
  if (key.startsWith("sb_secret_"))
    return "Utiliza la clave pública de Supabase, nunca una clave secreta.";
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role === "service_role")
        return "Utiliza la clave pública anon de Supabase, nunca service_role.";
    } catch {
      return "La clave pública de Supabase no tiene un formato válido.";
    }
  }
  return null;
}
