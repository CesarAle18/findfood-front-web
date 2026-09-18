// Source rendering checks, without a browser. Does not validate visual appearance.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const original = Module._load;
Module._extensions[".tsx"] = Module._extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
};
Module._load = function (name, parent, isMain) {
  if (name.endsWith(".css")) return {};
  return original.call(this, name, parent, isMain);
};
const App = require("../src/App.tsx").default;
const { screens } = require("../src/data/screens.ts");
const routes = new Set(screens.map(([, path]) => path.split("?")[0]));
routes.add("/pantallas");
const errors = [];
const previous = console.error;
console.error = (...args) => errors.push(args.join(" "));
try {
  for (const [name, path] of screens) {
    const html = renderToStaticMarkup(
      React.createElement(App, { initialPath: path }),
    );
    assert(html.includes("Find Food"), name);
    assert(!html.includes("Página no encontrada"), name);
    assert(!html.includes("Registro no encontrado"), name);
    for (const match of html.matchAll(/href="#([^"?]*)(?:[^\"]*)"/g)) {
      if (match[1] === "main-content") continue;
      assert(routes.has(match[1]), `${name}: unknown link ${match[1]}`);
    }
  }
  for (const path of [
    "/usuarios?panel=editar&id=USR-002",
    "/donaciones?panel=nuevo",
    "/almacenes?panel=editar&id=ALM-003",
    "/recepciones?panel=nuevo",
    "/recepcion?id=REC-1083",
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(App, { initialPath: path }),
    );
    assert(html.includes("Find Food"));
    assert(!html.includes("Registro no encontrado"));
  }
  const selected = renderToStaticMarkup(
    React.createElement(App, {
      initialPath: "/donaciones?panel=detalle&id=DON-1047",
    }),
  );
  assert(selected.includes("Restaurante El Buen Sabor"));
  const missing = renderToStaticMarkup(
    React.createElement(App, {
      initialPath: "/usuarios?panel=detalle&id=missing",
    }),
  );
  assert(missing.includes("Registro no encontrado"));
  const noticeHtml = renderToStaticMarkup(
    React.createElement(App, {
      initialPath: "/recepcion?id=REC-1083&panel=notificaciones",
    }),
  );
  assert(noticeHtml.includes('href="#/recepcion?id=REC-1083"'));
  assert(noticeHtml.includes("Laura Gómez"));
  const render = path => renderToStaticMarkup(React.createElement(App, { initialPath: path }));
  assert(!render("/almacenes").includes("Alertas de capacidad"));
  const warehouseForm = render("/almacenes?panel=nuevo");
  assert(!warehouseForm.slice(warehouseForm.indexOf("<dialog")).includes('<option>Congelado</option>'));
  const volunteerList = render("/voluntarios");
  assert(!volunteerList.includes('scope="col">Ciudad'));
  assert(!volunteerList.includes('aria-label="Ciudad"'));
  assert(volunteerList.includes('aria-label="Submenú de usuarios"'));
  const donationForm = render("/donaciones?panel=nuevo");
  assert(donationForm.includes("Añadir otro producto"));
  assert.equal((donationForm.match(/>Ubicación</g) || []).length, 1);
  const pending = render("/pendientes");
  assert(!pending.includes('>Ver detalle</a>'));
  assert(pending.includes('aria-label="Ver detalle de'));
  const settings = render("/configuracion");
  assert(settings.includes('aria-label="Aumentar paradas" disabled=""'));
  assert(!settings.includes('<span class="active">Asignación</span>'));
  const receiptForm = render("/recepciones?panel=nuevo");
  assert(/Voluntario<\/span><select/.test(receiptForm));
  const { demoData } = require("../src/data/demo.ts");
  const volunteer = demoData.entities.voluntarios[1];
  assert(render(`/recepcion?id=REC-1083&voluntario=${volunteer.id}`).includes(`<b>${volunteer.name}</b>`));
  const invalid = errors.filter((e) =>
    /does not recognize|Invalid|Each child|cannot be a descendant/i.test(e),
  );
  assert.deepEqual(invalid, []);
  console.log(
    `PASS: ${screens.length} gallery routes, 5 additional form/receipt routes, internal links and missing record handling.`,
  );
} finally {
  console.error = previous;
  Module._load = original;
}
