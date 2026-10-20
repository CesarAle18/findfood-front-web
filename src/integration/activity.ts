import { useSyncExternalStore } from "react";

export type Activity = { id: string; titulo: string; cuerpo: string; created_at: string; leida_at: string | null; href: string };
const eventName = "findfood:activity";
const key = (user: string) => `findfood:activity:${user}`;
const memory = new Map<string, string>();
function snapshot(user: string) {
  try { return memory.get(user) ?? localStorage.getItem(key(user)) ?? "[]"; }
  catch { return memory.get(user) ?? "[]"; }
}
function parse(raw: string): Activity[] {
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter((n) => n && typeof n.id === "string" && typeof n.titulo === "string") : []; }
  catch { return []; }
}
function write(user: string, value: Activity[]) {
  const raw = JSON.stringify(value.slice(0, 100));
  try { localStorage.setItem(key(user), raw); memory.delete(user); }
  catch { memory.set(user, raw); }
  window.dispatchEvent(new Event(eventName));
}
export function addActivity(user: string, notice: Omit<Activity, "created_at" | "leida_at">) {
  const notices = parse(snapshot(user));
  if (notices.some((n) => n.id === notice.id)) return;
  write(user, [{ ...notice, created_at: new Date().toISOString(), leida_at: null }, ...notices]);
}
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); };
}
export function useActivity(user: string) {
  const raw = useSyncExternalStore(subscribe, () => snapshot(user));
  return parse(raw);
}
export function readActivity(user: string, id?: string) {
  write(user, parse(snapshot(user)).map((n) => !id || n.id === id ? { ...n, leida_at: n.leida_at ?? new Date().toISOString() } : n));
}
