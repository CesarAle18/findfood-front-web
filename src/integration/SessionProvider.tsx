import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "./contracts";
import { errorMessage } from "./http";
import { profileService } from "./services";
import { SessionContext } from "./session-context";
import { supabase } from "./supabase";
const recoveryKey = "findfood-password-recovery";
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(
    () => sessionStorage.getItem(recoveryKey) === "true",
  );
  const revision = useRef(0);
  const identity = useRef<string | null>(null);
  const accessToken = session?.access_token;
  const refreshProfile = useCallback(async () => {
    const current = ++revision.current;
    setError("");
    try {
      const next = await profileService.get();
      if (revision.current === current) setProfile(next);
      return next;
    } catch (err) {
      if (revision.current === current) {
        setProfile(null);
        setError(errorMessage(err));
      }
      throw err;
    } finally {
      if (revision.current === current) setLoading(false);
    }
  }, []);
  const finishRecovery = useCallback(() => {
    sessionStorage.removeItem(recoveryKey);
    setRecovery(false);
  }, []);
  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase!.auth.signOut({
      scope: "local",
    });
    if (signOutError) throw signOutError;
    ++revision.current;
    setSession(null);
    setProfile(null);
    setError("");
    setLoading(false);
    finishRecovery();
    window.location.hash = "/login";
  }, [finishRecovery]);
  useEffect(() => {
    const { data } = supabase!.auth.onAuthStateChange((event, next) => {
      const nextIdentity = next?.user.id ?? null;
      if (identity.current !== nextIdentity) {
        identity.current = nextIdentity;
        ++revision.current;
        setProfile(null);
        setError("");
        setLoading(Boolean(next));
      }
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(recoveryKey, "true");
        setRecovery(true);
        window.location.hash = "/restablecer-contrasena";
      }
      if (!next) {
        setProfile(null);
        setLoading(false);
        sessionStorage.removeItem(recoveryKey);
        setRecovery(false);
      }
    });
    const expired = () => {
      void signOut().catch((err) => setError(errorMessage(err)));
    };
    const refresh = () => {
      void refreshProfile().catch(() => {});
    };
    window.addEventListener("findfood:session-expired", expired);
    window.addEventListener("findfood:refresh-profile", refresh);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("findfood:session-expired", expired);
      window.removeEventListener("findfood:refresh-profile", refresh);
    };
  }, [refreshProfile, signOut]);
  useEffect(() => {
    if (!accessToken) return;
    // Se ejecuta fuera del callback de Supabase para no bloquear su lock de sesión.
    if (recovery) {
      void Promise.resolve().then(() => setLoading(false));
      return;
    }
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) return refreshProfile();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, recovery, refreshProfile]);
  return (
    <SessionContext.Provider
      value={{
        session,
        profile,
        loading,
        error,
        recovery,
        refreshProfile,
        signOut,
        finishRecovery,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
