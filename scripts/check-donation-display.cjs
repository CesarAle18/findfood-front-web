const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const exportsObject = {};
new Function("exports", ts.transpileModule(fs.readFileSync("src/integration/donation-display.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(exportsObject);
const { donationDetails, donationHistory, canAssignDonation } = exportsObject;
assert.deepEqual(donationDetails({ titulo: "", descripcion: "  ", nota: undefined, grupo: { dato: null }, lista: [], peso: 0, frio: false, nombre: "Arroz" }), { peso: 0, frio: false, nombre: "Arroz" });
assert.deepEqual(donationDetails({ metadata: { debug: true }, empty: null, historial: [], items: [{ peso: 0, refrigeracion: false, nota: null }] }), { items: [{ peso: 0, refrigeracion: false }] });
const history = [
  { id: 1, ambito: "DONACION", estado_nuevo: "ENTREGADA", created_at: "2026-10-25T10:00:00Z" },
  { id: 2, ambito: "DONACION", estado_nuevo: "ENTREGADA", created_at: "2026-10-26T10:00:00Z", metadata: {}, motivo: null },
  { id: 3, ambito: "ASIGNACION", estado_nuevo: "COMPLETADA", created_at: "2026-10-26T11:00:00Z" },
  { id: 4, ambito: "DONACION", estado_nuevo: "RECIBIDA", created_at: "2026-10-26T12:00:00Z" },
];
assert.deepEqual(donationHistory(history).map((row) => row.id), [2, 4]);
assert.equal("metadata" in donationHistory(history)[0], false);
assert.equal("motivo" in donationHistory(history)[0], false);
assert.deepEqual(donationHistory(null), []);
for (const estado of ["RECIBIDA", "ENTREGADA", "CANCELADA", "RECHAZADA", "EXPIRADA"]) assert.equal(canAssignDonation({ estado }), false);
for (const estado of ["PUBLICADA", "ASIGNADA"]) assert.equal(canAssignDonation({ estado }), true);
assert.deepEqual(exportsObject.nonEmptyDetails({ distancia: null, duracion: "", paradas: [{ direccion: "Calle 1", nota: null }], peso: 0, activa: false }), { paradas: [{ direccion: "Calle 1" }], peso: 0, activa: false });
console.log("PASS donaciones: historial, campos nulos y asignación por estado.");
