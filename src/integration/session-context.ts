import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "./contracts";
export interface SessionState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  refreshProfile: () => Promise<Profile>;
  signOut: () => Promise<void>;
  finishRecovery: () => void;
}
export const SessionContext = createContext<SessionState | null>(null);
export function useSession() {
  return useContext(SessionContext);
}
