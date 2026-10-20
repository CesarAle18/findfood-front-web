const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync("src/integration/activity-events.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exported = {};
new Function("exports", compiled)(exported);
const { activityEvents } = exported;
const now = Date.parse("2026-10-20T12:00:00Z");
const recent = new Date(now - 86400000).toISOString();
const old = "2026-09-01T12:00:00Z";
const pending = activityEvents("pending", [
  { id: "recent", created_at: recent },
  { id: "old", created_at: old },
  { id: "missing" },
  { id: "invalid", created_at: "invalid" },
  { id: "future", created_at: new Date(now + 86400000).toISOString() },
], null, now);
assert.deepEqual(pending.events.map((e) => e.id), ["pending:recent"]);
assert.equal(activityEvents("pending", [{ id: "recent", created_at: recent }], pending.snapshot, now).events.length, 0);
for (const kind of ["route", "donation", "user", "volunteer"]) {
  assert.equal(activityEvents(kind, [{ id: "old", created_at: old }], null, now).events.length, 0);
  assert.equal(activityEvents(kind, [{ id: "new" }], {}, now).events[0].id, `${kind}:new`);
}
for (const [kind, from, to, event] of [
  ["route", "EN_CURSO", "COMPLETADA", "route-completed"],
  ["donation", "PUBLICADA", "EXPIRADA", "donation-expired"],
  ["user", "PENDIENTE", "ACTIVO", "user-approved"],
]) {
  const result = activityEvents(kind, [{ id: "one", estado: to }], { one: { estado: from } }, now);
  assert.equal(result.events[0].id, `${event}:one`);
  assert.equal(activityEvents(kind, [{ id: "one", estado: to }], result.snapshot, now).events.length, 0);
}
assert.equal(activityEvents("donation", [{ id: "one", estado: "PUBLICADA", ventana_recogida_fin: old }], { one: { estado: "PUBLICADA" } }, now).events.length, 0);
assert.equal(activityEvents("user", [{ id: "one", estado: "ACTIVO" }], { one: { estado: "SUSPENDIDO" } }, now).events.length, 0);
console.log("PASS actividad: altas, pendientes recientes, estados, repetición y fechas inválidas.");
