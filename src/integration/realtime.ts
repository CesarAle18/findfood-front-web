import { useEffect } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session-context";

// Realtime is limited to private broadcasts. Business data is always read through the API.
export function useDonationRealtime() {
  const auth = useSession();
  const token = auth?.session?.access_token;
  const allowed = auth?.profile?.estado === "ACTIVO" && !auth.profile.debe_cambiar_password && auth.profile.roles.some((r) => ["ADMIN", "ASESOR_BANCO"].includes(r));
  useEffect(() => {
    if (!supabase || !token || !allowed) return;
    const client = supabase;
    let disposed = false;
    let timer: number | undefined;
    const channel = client.channel("banco:donaciones", { config: { private: true } });
    const refresh = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!disposed) window.dispatchEvent(new Event("findfood:data-changed"));
      }, 250);
    };
    void client.realtime.setAuth(token).then(() => {
      if (!disposed) channel.on("broadcast", { event: "donacion_estado" }, refresh).subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    }).catch(() => { /* The periodic API refresh remains available if Realtime is unreachable. */ });
    return () => { disposed = true; window.clearTimeout(timer); void client.removeChannel(channel); };
  }, [token, allowed]);
}
