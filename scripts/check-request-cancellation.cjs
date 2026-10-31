const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const exported = {};
const source = ts.transpileModule(fs.readFileSync("src/integration/http.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mockRequire = (name) => {
  if (name === "./supabase") return { supabase: { auth: { getSession: () => new Promise(() => {}) } } };
  if (name === "./config") return { integrationConfig: { apiUrl: "http://example.invalid" } };
  if (name === "./audit") return {};
  throw new Error(`Unexpected import ${name}`);
};
new Function("exports", "require", source)(exported, mockRequire);
(async () => {
  const controller = new AbortController();
  const request = exported.apiRequest("/inventario/lotes", { signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 10);
  try { await assert.rejects(request, /cancelada/); }
  finally { clearTimeout(timer); }
  console.log("PASS consulta: una sesión bloqueada admite cancelación y no deja la carga pendiente.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
