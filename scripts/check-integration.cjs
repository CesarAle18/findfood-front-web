// Pruebas de navegador con Supabase y API simulados. No toca cuentas reales.
// Requiere Playwright y Chromium; ver docs/conexion-web.md.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.TEST_WEB_URL || "http://127.0.0.1:5178";
const { spawn } = require("node:child_process");
const devServer = process.env.TEST_WEB_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5178",
        "--strictPort",
      ],
      {
        stdio: "ignore",
        env: {
          ...process.env,
          VITE_DATA_MODE: "api",
          VITE_API_URL: "http://127.0.0.1:4300/v1",
          VITE_SUPABASE_URL: "http://127.0.0.1:4301",
          VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
        },
      },
    );
const api = "http://127.0.0.1:4300";
const provider = "http://127.0.0.1:4301";
const id = "12345678-1234-4234-8234-123456789abc";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "admin@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
};
const jwt = () =>
  [
    "e30",
    Buffer.from(
      JSON.stringify({
        sub: id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: "authenticated",
      }),
    ).toString("base64url"),
    "test",
  ].join(".");
(async () => {
  const deadline = Date.now() + 15000;
  while (true) {
    try {
      const response = await fetch(base);
      if (response.ok) break;
    } catch {}
    if (Date.now() > deadline)
      throw new Error("El servidor Vite de prueba no inició.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_CHROMIUM_PATH
      ? {
          executablePath: process.env.TEST_CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        }
      : {}),
  });
  let count = 0;
  async function scenario(name, fn) {
    if (process.env.TEST_SCENARIO && !name.includes(process.env.TEST_SCENARIO))
      return;
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = {
      temporary: false,
      roles: ["ADMIN"],
      usersFailure: false,
      creationFailure: false,
      statusFailure: false,
      statuses: {},
      moduleFailure: false,
      ownRow: false,
      profileFailure: false,
      expired: false,
      password: "Original1!",
      requests: [],
      updates: 0,
      recoverySent: false,
      profileFields: {
        nombres: "Ana",
        apellidos: "Martínez",
        telefono: "+573001234567",
      },
    };
    const fulfill = (route, body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            "Authorization,Content-Type,apikey,x-client-info,x-supabase-api-version",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        },
        body: status === 204 ? undefined : JSON.stringify(body),
      });
    await page.route(`${provider}/**`, async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        body = request.postDataJSON();
      if (request.method() === "OPTIONS") return fulfill(route, {}, 204);
      if (url.pathname.endsWith("/token")) {
        if (body.password !== state.password)
          return fulfill(
            route,
            {
              code: "invalid_credentials",
              error_code: "invalid_credentials",
              msg: "Invalid credentials",
            },
            400,
          );
        return fulfill(route, {
          access_token: jwt(),
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user,
        });
      }
      if (url.pathname.endsWith("/logout")) return fulfill(route, {}, 204);
      if (url.pathname.endsWith("/recover")) {
        state.recoverySent = true;
        return fulfill(route, {});
      }
      if (url.pathname.endsWith("/user")) {
        if (request.method() === "PUT") {
          state.password = body.password;
          state.temporary = false;
          state.updates++;
        }
        return fulfill(route, user);
      }
      return fulfill(route, {}, 404);
    });
    await page.route(`${api}/**`, async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (request.method() === "OPTIONS") return fulfill(route, {}, 204);
      assert.match(request.headers().authorization || "", /^Bearer /);
      state.requests.push({
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        method: request.method(),
        body: request.postData(),
      });
      if (state.expired)
        return fulfill(
          route,
          { type: "token-invalido", title: "Token vencido", status: 401 },
          401,
        );
      if (url.pathname.endsWith("/me")) {
        if (state.profileFailure)
          return fulfill(
            route,
            {
              type: "error-interno",
              title: "Perfil no disponible",
              status: 503,
            },
            503,
          );
        if (request.method() === "PATCH")
          Object.assign(state.profileFields, request.postDataJSON());
        return fulfill(route, {
          id,
          email: user.email,
          ...state.profileFields,
          roles: state.roles,
          estado: "ACTIVO",
          email_verificado: true,
          pendientes: state.temporary ? ["CAMBIAR_PASSWORD"] : [],
          debe_cambiar_password: state.temporary,
        });
      }
      if (url.pathname.endsWith("/kpis/resumen"))
        return fulfill(route, {
          desde: new Date().toISOString(),
          hasta: new Date().toISOString(),
          donaciones: { creadas: 7, recibidas: 3, kg_recuperados: 120 },
          asignacion: { ofertas: 4, tasa_aceptacion: 0.5 },
          inventario: { kg_merma: 0, kg_distribuidos: 10 },
          por_sede: [],
        });
      if (
        url.pathname.endsWith("/admin/usuarios") &&
        request.method() === "POST"
      ) {
        if (state.creationFailure)
          return fulfill(
            route,
            {
              title: "Ya existe una cuenta con ese correo",
              type: "email-registrado",
              status: 409,
            },
            409,
          );
        return fulfill(
          route,
          {
            id: "created-id",
            ...request.postDataJSON(),
            correo_enviado: false,
            password_temporal: "Temporal1!",
          },
          201,
        );
      }
      if (/\/admin\/usuarios\/[^/]+\/estado$/.test(url.pathname)) {
        if (state.statusFailure)
          return fulfill(
            route,
            {
              type: "error-interno",
              title: "No se pudo cambiar el estado",
              status: 503,
            },
            503,
          );
        const target = url.pathname.split("/").at(-2),
          body = request.postDataJSON();
        state.statuses[target] = body.estado;
        return fulfill(route, { id: target, estado: body.estado });
      }
      if (url.pathname.endsWith("/me/notificaciones"))
        return fulfill(route, {
          datos: [
            {
              id: "notice",
              titulo: "Donación publicada",
              cuerpo: "Hay una nueva donación",
              created_at: new Date().toISOString(),
              leida_at: null,
            },
          ],
          total: 1,
          limite: 20,
          desplazamiento: 0,
          no_leidas: 1,
        });
      const resources = {
        "/v1/donaciones": {
          id,
          codigo: "DON-REAL",
          titulo: "Frutas",
          estado: "PUBLICADA",
          peso_estimado_kg: 12,
          almacen_destino: { id, nombre: "Almacén central" },
          ventana_recogida_inicio: new Date().toISOString(),
        },
        "/v1/rutas": {
          id,
          codigo: "RUTA-REAL",
          estado: "PLANIFICADA",
          paradas: 2,
          distancia_total_km: 5,
          almacen_destino: { id, nombre: "Almacén central" },
        },
        "/v1/recepciones": {
          id,
          donacion: { id, codigo: "DON-REAL" },
          estado: "ACEPTADA",
          peso_recibido_kg: 12,
          almacen: { id, nombre: "Almacén central" },
          fecha_recepcion: new Date().toISOString(),
        },
        "/v1/inventario/lotes": {
          lote_id: id,
          codigo_lote: "LOTE-REAL",
          tipo_alimento: "Manzanas",
          cantidad_disponible: 12,
          unidad: "KG",
          almacen: "Almacén central",
          peso_disponible_kg: 12,
        },
        "/v1/admin/verificaciones": {
          id,
          estado: "PENDIENTE",
          usuario: {
            nombres: "Nora",
            apellidos: "Pérez",
            email: "nora@example.test",
            telefono: "+573104445566",
          },
          voluntario: {
            tipo_vehiculo: { nombre: "Automóvil" },
            capacidad_carga_kg: 30,
          },
        },
      };
      if (resources[url.pathname]) {
        if (state.moduleFailure)
          return fulfill(
            route,
            {
              type: "error-interno",
              title: "Consulta de módulo no disponible",
              status: 503,
            },
            503,
          );
        return fulfill(route, {
          datos: [resources[url.pathname]],
          total: 1,
          limite: 20,
          desplazamiento: 0,
        });
      }
      for (const [path, row] of Object.entries(resources)) {
        if (url.pathname === `${path}/${id}`)
          return fulfill(route, { ...row, descripcion: "Detalle desde API" });
      }
      if (url.pathname.endsWith("/candidatos"))
        return fulfill(route, [
          {
            posicion: 1,
            score: 0.8,
            voluntario: { id, nombres: "Nora", capacidad_carga_kg: 30 },
          },
        ]);
      if (url.pathname.endsWith("/almacenes"))
        return fulfill(route, [
          {
            id,
            nombre: "Almacén central",
            direccion: "Calle 1",
            tipo: "SECO",
            capacidad_kg: 100,
            kg_en_inventario: 12,
            activo: true,
          },
        ]);
      if (url.pathname.endsWith("/admin/banco"))
        return fulfill(route, {
          id,
          nombre: "Banco real",
          direccion: "Calle 1",
          ciudad: "Bogotá",
          activo: true,
        });
      if (url.pathname.endsWith("/admin/parametros"))
        return fulfill(route, [
          {
            clave: "MAX_PARADAS_POR_RUTA",
            valor: "5",
            tipo_dato: "INTEGER",
            descripcion: "Máximo de paradas",
          },
        ]);
      if (url.pathname.endsWith("/catalogos"))
        return fulfill(route, {
          tipos_alimento: [{ id: 1, nombre: "Manzanas" }],
          unidades_medida: [{ id: 1, codigo: "KG", nombre: "Kilogramo" }],
        });
      if (url.pathname.endsWith("/admin/usuarios")) {
        if (state.usersFailure)
          return fulfill(
            route,
            {
              type: "error-interno",
              title: "Consulta no disponible",
              status: 503,
            },
            503,
          );
        const offset = Number(url.searchParams.get("desplazamiento") || 0);
        const users =
          url.searchParams.get("q") === "nadie"
            ? []
            : Array.from({ length: offset ? 1 : 20 }, (_, i) => ({
                ...user,
                id: state.ownRow && i === 0 ? id : `${id}-${offset + i}`,
                nombres: `Usuario ${offset + i + 1}`,
                apellidos: null,
                telefono: null,
                estado: state.statuses[`${id}-${offset + i}`] || "ACTIVO",
                roles: ["ADMIN"],
                roles_inactivos: [],
                ultimo_acceso_at: null,
              }));
        return fulfill(route, {
          datos: users,
          total: users.length ? 21 : 0,
          limite: 20,
          desplazamiento: offset,
        });
      }
      return fulfill(route, {}, 404);
    });
    const login = async (remember = false) => {
      await page.goto(base);
      await page.getByLabel("Correo electrónico *").fill(user.email);
      await page
        .getByLabel("Contraseña *", { exact: true })
        .fill(state.password);
      if (remember) await page.getByLabel("Recordarme").check();

      await page
        .getByRole("button", { name: "Iniciar sesión", exact: true })
        .click();
    };
    try {
      await fn({ page, context, state, login });
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}`);
      count++;
    } catch (err) {
      console.error(
        "Scenario",
        name,
        "URL",
        page.url(),
        "BODY",
        await page.locator("body").textContent(),
        "requests",
        state.requests,
        "errors",
        errors,
      );
      await page.screenshot({
        path: require("node:path").join(
          require("node:os").tmpdir(),
          "findfood-integration-failure.png",
        ),
      });
      throw err;
    } finally {
      await context.close();
    }
  }
  try {
    await scenario(
      "login, KPIs, persistencia, filtros, paginación, vacío, detalle, error y logout",
      async ({ page, state, login }) => {
        await login(true);
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        assert.equal(await page.locator(".avatar").innerText(), "AM");
        await page.reload();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Usuarios", exact: true }).click();
        await page.getByText("1–20 de 21 usuarios", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Siguiente", exact: true })
          .click();
        await page.getByText("21–21 de 21 usuarios", { exact: true }).waitFor();
        await page
          .getByLabel("Rol", { exact: true })
          .selectOption("VOLUNTARIO");
        await page.getByText("1–20 de 21 usuarios", { exact: true }).waitFor();
        await page
          .getByLabel("Estado", { exact: true })
          .selectOption("SUSPENDIDO");
        await page.getByText("1–20 de 21 usuarios", { exact: true }).waitFor();
        assert(
          state.requests.some(
            (r) =>
              r.params.rol === "VOLUNTARIO" &&
              r.params.estado === "SUSPENDIDO" &&
              r.params.desplazamiento === "0",
          ),
        );
        await page.getByLabel("Buscar usuarios").fill("nadie");
        await page
          .getByText("No se encontraron usuarios con estos filtros.", {
            exact: true,
          })
          .waitFor();
        await page.getByLabel("Buscar usuarios").fill("Ana");
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .waitFor();
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page.getByText("Detalle del usuario", { exact: true }).waitFor();
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        state.usersFailure = true;
        await page
          .getByRole("button", { name: "Actualizar lista", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Consulta no disponible" })
          .waitFor();
        assert.equal(
          await page.getByText("Usuario 1", { exact: true }).count(),
          0,
        ); // no muestra datos de respaldo después del error
        state.usersFailure = false;
        await page
          .getByRole("button", { name: "Reintentar", exact: true })
          .click();
        await page.getByText("1–20 de 21 usuarios", { exact: true }).waitFor();
        await page.getByLabel("Menú de cuenta").click();
        await page
          .getByRole("link", { name: "Cerrar sesión", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Iniciar sesión", exact: true })
          .waitFor();
        await page.goto(`${base}/#/usuarios`);
        await page
          .getByRole("button", { name: "Iniciar sesión", exact: true })
          .waitFor();
        assert.equal(await page.locator("table").count(), 0);
      },
    );
    await scenario(
      "guardar perfil, cambio desde sesión y sesión por pestaña sin Recordarme",
      async ({ page, context, state, login }) => {
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        const other = await context.newPage();
        await other.goto(base);
        await other
          .getByRole("button", { name: "Iniciar sesión", exact: true })
          .waitFor();
        await other.close();
        await page.getByLabel("Menú de cuenta").click();
        await page
          .getByRole("link", { name: "Mi perfil", exact: true })
          .click();
        await page.getByLabel("Nombres *").fill("Ana María");
        await page.getByLabel("Teléfono *").fill("+573009876543");
        await page
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await page.getByText("Perfil actualizado.", { exact: true }).waitFor();
        assert(
          state.requests.some(
            (r) =>
              r.method === "PATCH" &&
              JSON.parse(r.body).nombres === "Ana María",
          ),
        );
        await page.reload();
        await page.getByLabel("Nombres *").waitFor();
        assert.equal(
          await page.getByLabel("Nombres *").inputValue(),
          "Ana María",
        );
        await page.evaluate(() =>
          document.dispatchEvent(new Event("visibilitychange")),
        );
        await page.getByLabel("Menú de cuenta").click();
        await page
          .getByRole("link", { name: "Cambiar contraseña", exact: true })
          .click();
        await page.getByLabel("Contraseña actual *").fill(state.password);
        await page
          .getByLabel("Nueva contraseña *", { exact: true })
          .fill("Cambiada4!");
        await page
          .getByLabel("Confirmar nueva contraseña *")
          .fill("Cambiada4!");
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .click();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        assert.equal(state.updates, 1);
      },
    );
    await scenario("credenciales incorrectas", async ({ page, state }) => {
      await page.goto(base);
      await page.getByLabel("Correo electrónico *").fill(user.email);
      await page.getByLabel("Contraseña *", { exact: true }).fill("incorrecta");
      await page
        .getByRole("button", { name: "Iniciar sesión", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "no son correctos" })
        .waitFor();
      assert.equal(state.requests.length, 0);
    });
    await scenario(
      "primer ingreso y cambio único sin sidebar; validación de contraseña actual",
      async ({ page, state, login }) => {
        state.temporary = true;
        await login();
        await page.getByLabel("Contraseña actual *").waitFor();
        assert.equal(await page.locator(".sidebar").count(), 0);
        assert.equal(
          state.requests.some((r) => r.path.endsWith("/kpis/resumen")),
          false,
        );
        await page.getByLabel("Contraseña actual *").fill("Incorrecta1!");
        await page
          .getByLabel("Nueva contraseña *", { exact: true })
          .fill("NuevaClave2!");
        await page
          .getByLabel("Confirmar nueva contraseña *")
          .fill("OtraClave2!");
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "no coinciden" })
          .waitFor();
        assert.equal(state.updates, 0);
        await page
          .getByLabel("Confirmar nueva contraseña *")
          .fill("NuevaClave2!");
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "actual no es correcta" })
          .waitFor();
        await page.getByLabel("Contraseña actual *").fill(state.password);
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .click();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        assert.equal(state.updates, 1);
        await page.reload();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Contraseña actual *").count(), 0);
      },
    );
    await scenario(
      "recuperación por correo y enlace real, sin contraseña actual, vuelta al login",
      async ({ page, state }) => {
        await page.goto(`${base}/#/recuperar-contrasena`);
        await page.getByLabel("Correo electrónico *").fill(user.email);
        await page
          .getByRole("button", { name: "Enviar instrucciones", exact: true })
          .click();
        await page
          .getByText("Si el correo está registrado,", { exact: false })
          .waitFor();
        assert(state.recoverySent);
        assert.equal(
          await page.getByLabel("Nueva contraseña *", { exact: true }).count(),
          0,
        );
        await page.goto(
          `${base}/?flow=recovery#access_token=${jwt()}&refresh_token=mock-refresh-token&expires_in=3600&token_type=bearer&type=recovery`,
        );
        await page.getByLabel("Nueva contraseña *", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Contraseña actual *").count(), 0);
        assert.equal(await page.locator(".sidebar").count(), 0);
        await page
          .getByLabel("Nueva contraseña *", { exact: true })
          .fill("Restablecida3!");
        await page
          .getByLabel("Confirmar nueva contraseña *")
          .fill("Restablecida3!");
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Iniciar sesión", exact: true })
          .waitFor();
        assert.equal(state.updates, 1);
      },
    );
    await scenario("enlace de recuperación sin sesión", async ({ page }) => {
      await page.addInitScript(() =>
        sessionStorage.setItem("findfood-password-recovery", "true"),
      );
      await page.goto(`${base}/#/restablecer-contrasena`);
      await page
        .getByRole("alert")
        .filter({ hasText: "Abre el enlace" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("link", { name: "Solicitar enlace", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Enviar instrucciones", exact: true })
        .waitFor();
    });
    await scenario(
      "drawers de usuarios: alta, error, cierre y edición propia",
      async ({ page, state, login }) => {
        state.ownRow = true;
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Usuarios", exact: true }).click();
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .waitFor();
        assert.equal(
          await page
            .getByRole("link", { name: "Ver todas las pantallas" })
            .count(),
          0,
        );
        await page
          .getByRole("button", { name: "+ Nuevo usuario", exact: true })
          .click();
        let panel = page.getByRole("dialog");
        await panel.getByLabel("Nombres *").fill("Nuevo");
        await panel.getByLabel("Apellidos", { exact: true }).fill("Asesor");
        await panel
          .getByLabel("Correo electrónico *")
          .fill("nuevo@example.test");
        await panel.getByLabel("Teléfono *").fill("300 123 4567");
        state.creationFailure = true;
        await panel
          .getByRole("button", { name: "Crear usuario", exact: true })
          .click();
        await panel
          .getByRole("alert")
          .filter({ hasText: "Ya existe una cuenta" })
          .waitFor();
        state.creationFailure = false;
        await panel
          .getByRole("button", { name: "Crear usuario", exact: true })
          .click();
        await panel
          .getByText("Usuario creado: nuevo@example.test", { exact: true })
          .waitFor();
        assert.equal(
          await panel
            .getByLabel("Contraseña temporal", { exact: false })
            .inputValue(),
          "Temporal1!",
        );
        const request = state.requests.find(
          (r) => r.path.endsWith("/admin/usuarios") && r.method === "POST",
        );
        assert.equal(JSON.parse(request.body).telefono, "+573001234567");
        assert.equal(JSON.parse(request.body).rol, "ASESOR_BANCO");
        await panel
          .getByRole("button", { name: "Cerrar", exact: true })
          .click();
        await panel.waitFor({ state: "hidden" });
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await panel
          .getByRole("button", { name: "Editar información", exact: true })
          .click();
        await panel.getByLabel("Nombres *").fill("Nombre actualizado");
        await panel.getByLabel("Teléfono *").fill("3001234567");
        await panel
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await panel
          .getByText("Información actualizada.", { exact: true })
          .waitFor();
        assert.equal(state.profileFields.nombres, "Nombre actualizado");
        await panel
          .getByRole("button", { name: "Cerrar", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .nth(1)
          .click();
        await panel
          .getByRole("button", { name: "Editar información", exact: true })
          .click();
        await panel
          .getByLabel("Estado", { exact: true })
          .selectOption("INACTIVO");
        state.statusFailure = true;
        await panel
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await panel
          .getByRole("alert")
          .filter({ hasText: "No se pudo cambiar el estado" })
          .waitFor();
        state.statusFailure = false;
        await panel
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await panel
          .getByText("Información actualizada.", { exact: true })
          .waitFor();
        assert.equal(state.statuses[`${id}-1`], "INACTIVO");
        await panel
          .getByRole("button", { name: "Editar información", exact: true })
          .click();
        await panel
          .getByLabel("Estado", { exact: true })
          .selectOption("ACTIVO");
        await panel
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await panel
          .getByText("Información actualizada.", { exact: true })
          .waitFor();
        assert.equal(state.statuses[`${id}-1`], "ACTIVO");
        await panel
          .getByRole("button", { name: "Editar información", exact: true })
          .click();
        const capture = async (filename) => {
          await panel.evaluate(async (element) => {
            await Promise.all(
              element
                .getAnimations({ subtree: true })
                .map((animation) => animation.finished.catch(() => {})),
            );
          });
          if (process.env.TEST_SCREENSHOT_DIR)
            await page.screenshot({
              path: require("node:path").join(
                process.env.TEST_SCREENSHOT_DIR,
                filename,
              ),
            });
        };
        await capture("users-drawer-desktop.png");
        await page.setViewportSize({ width: 390, height: 844 });
        await capture("users-drawer-mobile.png");
        const box = await panel.boundingBox();
        assert(box.width <= 390);
        await page.keyboard.press("Escape");
        await panel.waitFor({ state: "hidden" });
      },
    );
    await scenario(
      "GET de módulos, detalles, asignaciones, configuración y notificaciones",
      async ({ page, state, login }) => {
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        for (const [path, endpoint] of [
          ["donaciones", "/donaciones"],
          ["rutas", "/rutas"],
          ["recepciones", "/recepciones"],
          ["inventario", "/inventario/lotes"],
          ["almacenes", "/almacenes"],
          ["voluntarios", "/admin/usuarios"],
          ["pendientes", "/admin/verificaciones"],
        ]) {
          await page.goto(`${base}/#/${path}`);
          await page.getByRole("table").waitFor();
          assert(
            state.requests.some(
              (r) => r.path.endsWith(endpoint) && r.method === "GET",
            ),
          );
          await page
            .getByRole("button", { name: "Ver", exact: true })
            .first()
            .click();
          const panel = page.getByRole("dialog");
          await panel.waitFor();
          if (
            [
              "donaciones",
              "rutas",
              "recepciones",
              "inventario",
              "pendientes",
            ].includes(path)
          )
            await panel
              .getByText("Detalle desde API", { exact: true })
              .waitFor();
          await page.keyboard.press("Escape");
          await panel.waitFor({ state: "hidden" });
        }
        await page.goto(`${base}/#/donaciones`);
        await page
          .getByRole("link", { name: "Asignar", exact: true })
          .first()
          .click();
        await page
          .getByRole("heading", { name: "Voluntarios candidatos", exact: true })
          .waitFor();
        await page.getByText("Nora", { exact: true }).waitFor();
        assert(
          state.requests.some((r) =>
            r.path.endsWith(`/donaciones/${id}/candidatos`),
          ),
        );
        await page.goto(`${base}/#/recepcion?id=${id}`);
        await page.getByText("Detalle desde API", { exact: true }).waitFor();
        await page.goto(`${base}/#/configuracion`);
        await page.getByText("Banco real", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Parámetros", exact: true })
          .click();
        await page.getByText("MAX_PARADAS_POR_RUTA", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Catálogos", exact: true })
          .click();
        await page.getByText("Kilogramo", { exact: true }).waitFor();
        await page.goto(`${base}/#/reportes`);
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
        await page
          .getByRole("dialog")
          .getByText("Donación publicada", { exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        state.moduleFailure = true;
        await page.goto(`${base}/#/donaciones`);
        await page
          .getByRole("alert")
          .filter({ hasText: "Consulta de módulo no disponible" })
          .waitFor();
        assert.equal(
          await page.getByText("DON-REAL", { exact: true }).count(),
          0,
        );
        state.moduleFailure = false;
        await page
          .getByRole("button", { name: "Reintentar", exact: true })
          .click();
        await page.getByText("DON-REAL", { exact: true }).waitFor();
      },
    );
    await scenario(
      "rol asesor: usuarios restringidos y consulta de donaciones",
      async ({ page, state, login }) => {
        state.roles = ["ASESOR_BANCO"];
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Usuarios", exact: true }).click();
        await page
          .getByRole("alert")
          .filter({ hasText: "requiere el rol Administrador" })
          .waitFor();
        assert.equal(
          state.requests.some((r) => r.path.endsWith("/admin/usuarios")),
          false,
        );
        assert.equal(
          await page
            .getByRole("button", { name: "+ Nuevo usuario", exact: true })
            .count(),
          0,
        );
        await page
          .getByRole("link", { name: "Donaciones", exact: true })
          .click();
        await page.getByRole("table").waitFor();
        assert.equal(
          state.requests.some((r) => r.path.endsWith("/donaciones")),
          true,
        );
      },
    );
    await scenario(
      "error de perfil, reintento y sesión vencida",
      async ({ page, state, login }) => {
        state.profileFailure = true;
        await login();
        await page
          .getByRole("alert")
          .filter({ hasText: "Perfil no disponible" })
          .waitFor();
        state.profileFailure = false;
        await page
          .getByRole("button", { name: "Reintentar", exact: true })
          .click();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        state.expired = true;
        await page.getByRole("link", { name: "Usuarios", exact: true }).click();
        await page
          .getByRole("button", { name: "Iniciar sesión", exact: true })
          .waitFor();
      },
    );
    console.log(
      `PASS ${count} escenarios de integración con servicios simulados.`,
    );
  } finally {
    await browser.close();
    devServer?.kill();
  }
})().catch((error) => {
  console.error(error);
  devServer?.kill();
  process.exit(1);
});
