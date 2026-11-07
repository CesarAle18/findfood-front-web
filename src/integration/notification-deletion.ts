import { useSyncExternalStore } from "react";

const event = "findfood:notifications-deleted";
const memory = new Map<string, string>();
const key = (user: string) => `findfood:notifications-deleted:${user}`;
function snapshot(user: string) {
  try { return memory.get(user) ?? localStorage.getItem(key(user)) ?? "[]"; }
  catch { return memory.get(user) ?? "[]"; }
}
function parse(raw: string): string[] {
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []; }
  catch { return []; }
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); };
}
export function useDeletedNotifications(user: string) {
  return new Set(parse(useSyncExternalStore(subscribe, () => snapshot(user))));
}
export function deleteNotifications(user: string, ids: string[]) {
  if (!user || !ids.length) return;
  const raw = JSON.stringify([...new Set([...parse(snapshot(user)), ...ids])]);
  try { localStorage.setItem(key(user), raw); memory.delete(user); }
  catch { memory.set(user, raw); }
  window.dispatchEvent(new Event(event));
}
