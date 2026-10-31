const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
Module._extensions[".tsx"] = Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const original = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "./http") return {};
  if (name === "./read") return { useRead: () => ({ data: [], loading: false, refresh() {} }) };
  return original.call(this, name, parent, isMain);
};
const { advisorDetails } = require("../src/integration/advisor-display.ts");
const { inventoryState, available } = require("../src/integration/inventory-state.ts");
const { notificationTarget } = require("../src/integration/notification-target.ts");
const { SessionContext } = require("../src/integration/session-context.ts");
const { DataDetails } = require("../src/integration/ReadDisplay.tsx");
const { ActionButtons } = require("../src/integration/ActionForm.tsx");
const { EvidencePanel } = require("../src/integration/EvidencePanel.tsx");
const { createAction, recordActions } = require("../src/integration/actions.ts");
const { DashboardLive } = require("../src/integration/DashboardLive.tsx");
const input = { id: "internal", banco_id: "bank", lat: 4, lng: -74, peso: 0, refrigeracion: false, nota: "", created_by: { nombres: "Ana", apellidos: "Pérez", id: "person" }, tipo_alimento: { id: 9, codigo: "technical", nombre: "Arroz" }, almacen: { id: "warehouse", nombre: "Norte" } };
assert.deepEqual(advisorDetails(input), { peso: 0, refrigeracion: false, registrado_por: "Ana Pérez", tipo_alimento: { nombre: "Arroz" }, almacen: { nombre: "Norte" } });
assert.deepEqual(advisorDetails({ created_by: "uuid", items: [{ donacion_item_id: "id", cantidad: 10 }] }), { items: [{ cantidad: 10 }] });
const now = Date.parse("2026-10-30T15:00:00Z");
const lot = { estado: "DISPONIBLE", fecha_vencimiento: "2026-10-29", cantidad_disponible: 10 };
assert.equal(inventoryState(lot, now), "VENCIDO");
assert.equal(available(lot, now), false);
assert.equal(available({ ...lot, fecha_vencimiento: "2026-10-30" }, now), true);
assert.equal(inventoryState({ ...lot, estado: "DESCARTADO" }, now), "DESCARTADO");
assert.equal(available({ ...lot, fecha_vencimiento: null }, now), true);
assert.equal(available({ ...lot, fecha_vencimiento: null, cantidad_disponible: 0 }, now), false);
assert.equal(notificationTarget({ tipo: "ALERTA_VENCIMIENTO" }), "#/alertas");
assert.equal(notificationTarget({ donacion_id: "one" }), "#/donaciones?id=one");
assert.equal(notificationTarget({ data: { ruta_id: "route" } }), "#/rutas?id=route");
function render(element, role = "ASESOR_BANCO") {
  return renderToStaticMarkup(React.createElement(SessionContext.Provider, { value: { profile: { roles: [role] } } }, element));
}
const advisor = render(React.createElement(DataDetails, { value: input }));
assert(!advisor.includes("internal") && !advisor.includes("technical"));
assert(advisor.includes("Ana Pérez") && advisor.includes("Arroz"));
const admin = render(React.createElement(DataDetails, { value: input }), "ADMIN");
assert(admin.includes("internal"));
for (const path of ["/almacenes", "/donaciones"]) {
  assert.equal(render(React.createElement(ActionButtons, { actions: recordActions(path, { id: "one", estado: "PUBLICADA" }), onSaved() {} })), "");
}
assert.equal(render(React.createElement(EvidencePanel, { parent: "parada_id", id: "one" })), "");
assert.deepEqual(createAction("/rutas").fields[0].source.states, ["PUBLICADA"]);
const dashboard = render(React.createElement(DashboardLive));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
assert.equal((dashboard.match(new RegExp(`max="${today}"`, "g")) || []).length, 2);
console.log("PASS asesor: campos y acciones por rol, evidencias vacías, vencimiento y notificaciones.");
