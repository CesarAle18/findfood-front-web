import { createClient } from "@supabase/supabase-js";
import { configurationError, integrationConfig } from "./config";
const preferenceKey = "findfood-remember-session";
// La contraseña nunca se almacena. Supabase administra la sesión y su renovación.
const storage = {
  getItem(key: string) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    const remember = localStorage.getItem(preferenceKey) === "true";
    (remember ? localStorage : sessionStorage).setItem(key, value);
    (remember ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
export function rememberSession(remember: boolean) {
  localStorage.setItem(preferenceKey, String(remember));
}
export const supabase =
  integrationConfig.mode === "api" && !configurationError()
    ? createClient(
        integrationConfig.supabaseUrl,
        integrationConfig.supabaseKey,
        {
          auth: {
            storage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "implicit",
          },
        },
      )
    : null;
export async function verifyCurrentPassword(email: string, password: string) {
  const verifier = createClient(
    integrationConfig.supabaseUrl,
    integrationConfig.supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "findfood-password-check",
      },
    },
  );
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error)
    throw new Error(
      error.code === "invalid_credentials"
        ? "La contraseña actual no es correcta."
        : error.message,
    );
  const { error: logoutError } = await verifier.auth.signOut({
    scope: "local",
  });
  if (logoutError) throw logoutError;
}
