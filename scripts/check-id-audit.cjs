const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function source(file, imports = {}) {
  const exported = {};
  new Function("exports", "require", ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exported, (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  });
  return exported;
}
const ids = source("src/integration/id-search.ts");
const audit = source("src/integration/audit-presentation.ts");
assert(ids.isIdSearch(" 12345678-1234-4234-8234-123456789ABC "));
assert(ids.isIdSearch("31"));
assert(!ids.isIdSearch("Arroz"));
assert(ids.matchesId({ id: "ABC-123" }, " abc-123 "));
assert(ids.matchesId({ lote_id: "lot" }, "lot"));
assert(ids.matchesId({ id: 14 }, "14"));
assert(!ids.matchesId({ id: 14 }, "1"));
assert(!ids.matchesId({ nombre: "ABC-123" }, "ABC-123"));
assert(ids.matchesId({ usuario: { id: "user" } }, "user"));
assert.deepEqual(audit.auditValues('{"activo":"true","capacidad_kg":"8000","productos":[{"nombre":"Arroz"}]}'), { activo: true, capacidad_kg: "8000", productos: [{ nombre: "Arroz" }] });
assert.equal(audit.auditValues("null"), null);
assert.equal(audit.auditValues('{broken'), "No fue posible interpretar los valores registrados.");
assert.deepEqual(audit.auditValues(JSON.stringify(JSON.stringify({ activo: false }))), { activo: false });
(async () => {
  const all = Array.from({ length: 121 }, (_, index) => ({ id: String(index + 1), nombre: `Registro ${index}` }));
  const calls = [];
  const read = source("src/integration/record-read.ts", { "./id-search": ids, "./http": { apiRequest: async (endpoint) => {
    const url = new URL(endpoint, "https://example.invalid");
    assert(!url.searchParams.has("buscar_id"));
    calls.push(endpoint);
    const offset = Number(url.searchParams.get("desplazamiento"));
    return { datos: all.slice(offset, offset + 100), total: all.length };
  } } });
  const result = await read.loadIdPage("/donaciones?limite=20&desplazamiento=0&buscar_id=121", new AbortController().signal);
  assert.deepEqual(result.datos, [all[120]]);
  assert.equal(result.total, 1);
  assert.equal(calls.length, 2);
  console.log("PASS ID y auditoría: coincidencia exacta, normalización, páginas posteriores y valores legibles.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
