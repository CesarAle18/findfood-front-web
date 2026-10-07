import { useSyncExternalStore } from "react";
const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
export function useRoute(initialPath = "/login") {
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1) || "/login",
    () => initialPath,
  );
  const [pathname, query] = path.split("?");
  return { pathname, params: new URLSearchParams(query), path };
}
export function href(path: string, panel?: string, id?: string) {
  const params = new URLSearchParams();
  if (panel) params.set("panel", panel);
  if (id) params.set("id", id);
  return "#" + path + (params.size ? "?" + params.toString() : "");
}
