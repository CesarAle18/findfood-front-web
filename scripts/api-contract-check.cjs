// Contrasta solicitudes reales del navegador con los DTO y @Roles de la API compilada.
// No inicia la API, no accede a su base de datos y no simula reglas de negocio.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = process.env.TEST_API_SOURCE;
let routes = [];
let transform, validate;
if (root) {
  require(path.join(root, "node_modules/reflect-metadata"));
  transform = require(
    path.join(root, "node_modules/class-transformer"),
  ).plainToInstance;
  validate = require(path.join(root, "node_modules/class-validator")).validate;
  const visit = (folder) => {
    for (const name of fs.readdirSync(folder)) {
      const file = path.join(folder, name);
      if (fs.statSync(file).isDirectory()) visit(file);
      else if (name.endsWith(".controller.js")) {
        for (const ctor of Object.values(require(file))) {
          if (typeof ctor !== "function") continue;
          const prefix = Reflect.getMetadata("path", ctor);
          if (typeof prefix !== "string") continue;
          for (const property of Object.getOwnPropertyNames(ctor.prototype)) {
            const fn = ctor.prototype[property];
            if (typeof fn !== "function") continue;
            const endpoint = Reflect.getMetadata("path", fn);
            const method = Reflect.getMetadata("method", fn);
            if (typeof endpoint !== "string" || method === undefined) continue;
            const route =
              "/" +
              (prefix === "health" ? "" : "v1/") +
              [prefix, endpoint].filter((v) => v && v !== "/").join("/");
            const regex = new RegExp(
              "^" + route.replace(/:[^/]+/g, "[^/]+") + "/?$",
            );
            const args =
              Reflect.getMetadata("__routeArguments__", ctor, property) || {};
            const types =
              Reflect.getMetadata(
                "design:paramtypes",
                ctor.prototype,
                property,
              ) || [];
            const bodyArg = Object.keys(args).find((key) =>
              key.startsWith("3:"),
            );
            const queryArg = Object.keys(args).find((key) =>
              key.startsWith("4:"),
            );
            routes.push({
              regex,
              route,
              method: [
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "PATCH",
                "ALL",
                "OPTIONS",
                "HEAD",
              ][method],
              roles:
                Reflect.getMetadata("auth:roles", fn) ||
                Reflect.getMetadata("auth:roles", ctor),
              bodyType: bodyArg ? types[Number(bodyArg.split(":")[1])] : null,
              queryType: queryArg
                ? types[Number(queryArg.split(":")[1])]
                : null,
            });
          }
        }
      }
    }
  };
  visit(path.join(root, fs.existsSync(path.join(root, "dist/modulos")) ? "dist/modulos" : "dist/src/modulos"));
  assert(
    routes.length > 40,
    "La API debe estar compilada antes de comprobar contratos",
  );
}
module.exports = async function check(request, roles) {
  if (!root) return;
  const url = new URL(request.url());
  const route = routes.find(
    (route) =>
      route.method === request.method() && route.regex.test(url.pathname),
  );
  assert(
    route,
    `Endpoint no existente en API: ${request.method()} ${url.pathname}`,
  );
  if (route.roles)
    assert(
      route.roles.some((role) => roles.includes(role)),
      `Rol sin permiso para ${route.route}`,
    );
  for (const [Type, data] of [
    [route.bodyType, request.postData() ? request.postDataJSON() : {}],
    [route.queryType, Object.fromEntries(url.searchParams)],
  ]) {
    if (!Type || Type === Object || Type === String || Type === Number)
      continue;
    const errors = await validate(transform(Type, data), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    assert.equal(
      errors.length,
      0,
      `DTO incompatible para ${route.route}: ${JSON.stringify(errors)}`,
    );
  }
};
