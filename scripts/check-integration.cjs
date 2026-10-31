const checkApiContract = require("./api-contract-check.cjs");
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
          VITE_GOOGLE_MAPS_API_KEY: "test-key-not-real",
        },
      },
    );
const api = "http://127.0.0.1:4300";
const provider = "http://127.0.0.1:4301";
const id = "12345678-1234-4234-8234-123456789abc";
const userId = (index) =>
  `12345678-1234-4234-8234-${String(index + 1).padStart(12, "0")}`;
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
      mutationFailure: false,
      newMutations: [],
      parameterValues: ["0.30", "0.30", "0.25", "0.15", "5"],
      stockFailure: false,
      stock: null,
      multipleProducts: false,
      noticesRead: false,
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
    await page.route("https://maps.googleapis.com/maps/api/js?**", (route) => route.fulfill({ contentType: "application/javascript", body: `
      window.google = { maps: {
        Map: class { constructor(element, options) { window.__mapCount = (window.__mapCount || 0) + 1; this.element = element; this.zoom = options.zoom; this.element.dataset.zoom = this.zoom; } fitBounds() {} getZoom() { return this.zoom; } setZoom(value) { this.zoom = value; this.element.dataset.zoom = value; } },
        LatLngBounds: class { extend() {} },
        Polyline: class { setMap() {} },
        marker: { AdvancedMarkerElement: class { constructor(options) { Object.assign(this, options); } } }
      } };
      window.findfoodMapsReady();
    ` }));
    const channels = new Map();
    state.realtimeJoins = [];
    state.broadcast = (topic, event, payload) => {
      const channel = channels.get(`realtime:${topic}`);
      assert(channel, `No subscription to ${topic}`);
      channel.socket.send(JSON.stringify([channel.joinRef, null, `realtime:${topic}`, "broadcast", { event, payload, type: "broadcast" }]));
    };
    await page.routeWebSocket("ws://127.0.0.1:4301/realtime/v1/websocket**", (socket) => {
      socket.onMessage((message) => {
        const [joinRef, ref, topic, event, payload] = JSON.parse(String(message));
        if (event === "phx_join") {
          channels.set(topic, { socket, joinRef }); state.realtimeJoins.push({ topic, payload });
        }
        if (event === "phx_join" || event === "heartbeat" || event === "phx_leave") socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]));
      });
    });
    await page.route(`${provider}/**`, async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        body = request.headers()["content-type"]?.includes("application/json")
          ? request.postDataJSON()
          : {};
      if (request.method() === "OPTIONS") return fulfill(route, {}, 204);
      if (url.pathname.endsWith("/verify")) {
        if (body.token !== "123456") return fulfill(route, { error_code: "otp_expired", msg: "Expired" }, 403);
        return fulfill(route, { access_token: jwt(), token_type: "bearer", expires_in: 3600, refresh_token: "mock-refresh-token", user });
      }
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
      if (url.pathname.includes("/storage/"))
        return fulfill(route, { Key: "test/photo.jpg" });
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
      if (url.pathname === "/health") return fulfill(route, { status: "ok" });
      await checkApiContract(request, state.roles);
      if (url.pathname === "/v1/panel/recuperar-contrasena") {
        assert.equal(request.headers().authorization, undefined);
        state.recoverySent = true;
        return fulfill(route, { mensaje: "Si la cuenta puede usar el panel, enviamos un código" }, 202);
      }
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
      if (
        ["POST", "PATCH", "PUT"].includes(request.method()) &&
        !url.pathname.endsWith("/me") &&
        !(
          url.pathname.endsWith("/admin/usuarios") &&
          request.method() === "POST"
        ) &&
        !/\/admin\/usuarios\/[^/]+\/estado$/.test(url.pathname)
      ) {
        if (state.mutationFailure)
          return fulfill(
            route,
            {
              type: "error-interno",
              title: "No se pudo guardar la operación",
              status: 503,
            },
            503,
          );
        if (
          url.pathname.includes("/admin/usuarios/") &&
          url.pathname.endsWith("/suspender")
        )
          state.statuses[url.pathname.split("/").at(-2)] = "SUSPENDIDO";
        if (
          url.pathname.includes("/admin/usuarios/") &&
          url.pathname.endsWith("/reactivar")
        )
          state.statuses[url.pathname.split("/").at(-2)] = "ACTIVO";
        if (
          url.pathname.endsWith("/admin/parametros") &&
          request.method() === "PUT"
        ) {
          const changes = request.postDataJSON().valores;
          state.parameterValues = [
            "PESO_PROXIMIDAD",
            "PESO_URGENCIA",
            "PESO_CONFIABILIDAD",
            "PESO_HOLGURA",
            "MAX_PARADAS_POR_RUTA",
          ].map((key) => changes.find((row) => row.clave === key).valor);
          return fulfill(route, changes);
        }
        state.newMutations.push({
          path: url.pathname,
          method: request.method(),
          body: request.postDataJSON(),
        });
        if (url.pathname.includes("/me/notificaciones/"))
          state.noticesRead = true;
        if (url.pathname.endsWith("/evidencias/upload-url"))
          return fulfill(route, {
            ruta: `evidencias/${id}/photo.jpg`,
            token: "test-upload",
            url_subida: `${provider}/storage/v1/object/upload/sign/evidencias/${id}/photo.jpg?token=test-upload`,
          });
        return fulfill(
          route,
          { id, estado: "BORRADOR" },
          url.pathname.endsWith("/leer") ? 204 : 200,
        );
      }
      if (url.pathname.endsWith("/evidencias")) {
        if (state.evidenceFailure)
          return fulfill(
            route,
            { title: "No se pudieron consultar las evidencias", status: 503 },
            503,
          );
        return fulfill(route, state.evidenceRows || []);
      }
      if (url.pathname.endsWith("/historial")) return fulfill(route, []);
      if (url.pathname.endsWith("/admin/tareas"))
        return fulfill(route, { tareas: [], pendientes: 0 });
      if (url.pathname.endsWith("/alertas"))
        return fulfill(route, [
          {
            id,
            mensaje: "Lote próximo a vencer",
            nivel: "ALTA",
            atendida_at: null,
            lote_inventario: { codigo_lote: "LOTE-REAL" },
          },
        ]);
      if (url.pathname.endsWith("/me") || url.pathname.endsWith("/panel/sesion")) {
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
      if (url.pathname.endsWith("/me/notificaciones") && state.notificationFailure)
        return fulfill(route, { title: "Notificaciones no disponibles", status: 503 }, 503);
      if (url.pathname.endsWith("/me/notificaciones") && state.notificationRows) {
        const offset = Number(url.searchParams.get("desplazamiento") || 0);
        const limit = Number(url.searchParams.get("limite") || 100);
        return fulfill(route, { datos: state.notificationRows.slice(offset, offset + limit).map((n) => ({ ...n, leida_at: state.noticesRead ? new Date().toISOString() : null })), total: state.notificationRows.length, no_leidas: state.noticesRead ? 0 : state.notificationRows.length });
      }
      if (url.pathname.endsWith("/me/notificaciones"))
        return fulfill(route, {
          datos: [
            {
              id: "notice",
              titulo: "Donación publicada",
              cuerpo: "Hay una nueva donación",
              created_at: new Date().toISOString(),
              leida_at: state.noticesRead ? new Date().toISOString() : null,
            },
          ],
          total: 1,
          limite: 20,
          desplazamiento: 0,
          no_leidas: state.noticesRead ? 0 : 1,
        });
      const activityKey = `${url.pathname}${url.pathname.endsWith("/verificaciones") ? `?estado=${url.searchParams.get("estado")}` : ""}`;
      if (state.activityRows?.[activityKey]) {
        const all = state.activityRows[activityKey];
        const offset = Number(url.searchParams.get("desplazamiento") || 0);
        const limit = Number(url.searchParams.get("limite") || 100);
        return fulfill(route, { datos: all.slice(offset, offset + limit), total: all.length, limite: limit, desplazamiento: offset });
      }
      if (state.routeRows && url.pathname === "/v1/rutas")
        return fulfill(route, { datos: state.routeRows, total: state.routeRows.length, limite: 100, desplazamiento: 0 });
      if (state.routeDetails && state.routeDetails[url.pathname])
        return fulfill(route, state.routeDetails[url.pathname]);
      const resources = {
        "/v1/distribuciones": {
          id,
          codigo: "DIST-REAL",
          estado: "BORRADOR",
          nombre_destino: "Comedor",
          numero_beneficiarios: 10,
        },
        "/v1/incidencias": {
          id,
          descripcion: "Novedad en recogida",
          estado: "ABIERTA",
          nivel: "MEDIA",
        },
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
          return fulfill(route, {
            ...row,
            descripcion: "Detalle desde API",
            ...(path === "/v1/donaciones"
              ? {
                  estado: state.donationState || "ENTREGADA",
                  items: [
                    {
                      id,
                      cantidad: 12,
                      peso_estimado_kg: 12,
                      tipo_alimento: { nombre: "Manzanas" },
                      foto_url: state.productPhoto,
                    },
                    ...(state.multipleProducts
                      ? [
                          {
                            id: userId(1),
                            cantidad: 25,
                            peso_estimado_kg: 25,
                            tipo_alimento: { nombre: "Arroz" },
                          },
                        ]
                      : []),
                  ],
                }
              : {}),
            ...(path === "/v1/rutas"
              ? {
                  paradas: [
                    {
                      id,
                      orden: 1,
                      tipo: "RECOGIDA",
                      estado: "PENDIENTE",
                      direccion: "Calle 1",
                    },
                  ],
                }
              : {}),
          });
      }
      if (url.pathname.endsWith("/candidatos"))
        return fulfill(route, [
          {
            posicion: 1,
            score: 0.8,
            voluntario: { id, nombres: "Nora", capacidad_carga_kg: 30 },
          },
        ]);
      if (url.pathname.endsWith("/almacenes")) {
        if (state.stockFailure)
          return fulfill(
            route,
            { title: "Inventario no disponible", status: 503 },
            503,
          );
        return fulfill(
          route,
          state.stock || [
            {
              id,
              nombre: "Almacén central",
              direccion: "Calle 1",
              tipo: "SECO",
              capacidad_kg: 100,
              kg_en_inventario: 12,
              activo: true,
            },
          ],
        );
      }
      if (url.pathname.endsWith("/admin/banco"))
        return fulfill(route, {
          id,
          nombre: "Banco real",
          direccion: "Calle 1",
          ciudad: "Bogotá",
          lat: 4.7,
          lng: -74.1,
          tiene_flota_propia: true,
          activo: true,
        });
      if (url.pathname.endsWith("/admin/parametros"))
        return fulfill(
          route,
          [
            "PESO_PROXIMIDAD",
            "PESO_URGENCIA",
            "PESO_CONFIABILIDAD",
            "PESO_HOLGURA",
            "MAX_PARADAS_POR_RUTA",
          ].map((clave, index) => ({
            clave,
            valor: state.parameterValues[index],
            tipo_dato: index === 4 ? "INT" : "DECIMAL",
          })),
        );
      if (url.pathname.endsWith("/catalogos"))
        return fulfill(route, {
          tipos_alimento: [{ id: 1, nombre: "Manzanas" }],
          unidades_medida: [{ id: 1, codigo: "KG", nombre: "Kilogramo" }],
          categorias_alimento: [{ id: 1, nombre: "Frutas" }],
          motivos: [
            { id: 1, nombre: "Otro motivo", requiere_comentario: true },
          ],
          tipos_incidencia: [{ id: 1, nombre: "Ausencia" }],
          tipos_destino_distribucion: [{ id: 1, nombre: "Comedor" }],
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
                id: state.ownRow && i === 0 ? id : userId(offset + i),
                nombres: `Usuario ${offset + i + 1}`,
                apellidos: null,
                telefono: null,
                estado: state.statuses[userId(offset + i)] || "ACTIVO",
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
    await scenario("administrador global: auditoría, configuración y almacén sin coordenadas", async ({ page, state, login }) => {
      const remote = ["ASESOR_BANCO", "DONANTE", "VOLUNTARIO", "ADMIN"].map((role, index) => ({ id: `servidor:${index}`, fecha: new Date(Date.now() - 60000).toISOString(), actor: `${role.toLowerCase()}@example.test`, roles: [role], modulo: "Inventario", accion: "Registrar entrada", entidad: "lote", metodo: "REGISTRO", descripcion: `Registrar entrada del lote L-${index}: 10 unidades.` }));
      await page.route(`${api}/v1/admin/auditoria?*`, async (route) => {
        await checkApiContract(route.request(), state.roles);
        await route.fulfill({ json: { datos: remote, total: remote.length, limite: 100, desplazamiento: 0 } });
      });
      await page.route(`${api}/v1/geo/geocodificar?*`, async (route) => {
        await checkApiContract(route.request(), state.roles);
        await route.fulfill({ json: { direccion: "Calle 72, Bogotá", ubicacion: { lat: 4.66, lng: -74.06 } } });
      });
      await login(true);
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/reportes`);
      const table = page.getByRole("table", { name: "Reporte de auditorías" });
      await table.getByText("asesor_banco@example.test", { exact: true }).waitFor();
      assert.equal(await table.locator("tbody tr").count(), 4);
      assert.equal(await table.getByRole("columnheader", { name: "Entidad", exact: true }).count(), 0);
      await table.getByRole("columnheader", { name: "Descripción", exact: true }).waitFor();
      await page.getByLabel("Rol", { exact: true }).selectOption("ASESOR_BANCO");
      assert.equal(await table.locator("tbody tr").count(), 1);
      await page.getByLabel("Rol", { exact: true }).selectOption("");
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar reporte" }).click();
      assert.equal((await download).suggestedFilename(), "reporte-auditorias.csv");
      await page.goto(`${base}/#/configuracion`);
      const decrease = page.getByRole("button", { name: "Disminuir paradas" });
      await decrease.waitFor();
      while (await decrease.isEnabled()) await decrease.click();
      assert.equal((await page.getByLabel("Máximo de paradas", { exact: true }).textContent()).trim(), "2");
      assert.equal(await page.getByLabel("Urgencia (%)", { exact: true }).getAttribute("step"), "1");
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await page.getByText("Configuración guardada.", { exact: true }).waitFor();
      assert.equal(state.parameterValues[4], "2");
      assert.equal(Number(state.parameterValues[0]), 0.3);
      await page.getByLabel("Urgencia (%)", { exact: true }).fill("42.5");
      assert(await page.getByRole("button", { name: "Guardar cambios", exact: true }).isDisabled());
      await page.getByRole("button", { name: "Banco", exact: true }).click();
      await page.getByRole("button", { name: "Editar Banco", exact: true }).waitFor();
      assert.equal(await page.getByText("Sedes del banco", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("rowheader", { name: "Latitud", exact: true }).count(), 0);
      assert.equal(await page.getByRole("rowheader", { name: "Longitud", exact: true }).count(), 0);
      const edit = page.getByRole("button", { name: "Editar Banco", exact: true });
      const manage = page.getByRole("link", { name: "Administrar sedes y almacenes", exact: true });
      assert((await manage.boundingBox()).y > (await edit.boundingBox()).y);
      await edit.click();
      const bankPanel = page.getByRole("dialog");
      await bankPanel.getByLabel("Nombre", { exact: true }).fill("Banco actualizado sin coordenadas");
      assert.equal(await bankPanel.getByLabel("Latitud", { exact: true }).count(), 0);
      await bankPanel.getByRole("button", { name: "Confirmar", exact: true }).click();
      await bankPanel.waitFor({ state: "hidden" });
      assert(state.newMutations.some((request) => request.path === "/v1/admin/banco" && request.body.nombre === "Banco actualizado sin coordenadas"));
      await manage.click();
      await page.getByRole("button", { name: "Nuevo almacén", exact: true }).click();
      const panel = page.getByRole("dialog");
      assert.equal(await panel.getByLabel("Latitud", { exact: true }).count(), 0);
      assert.equal(await panel.getByLabel("Longitud", { exact: true }).count(), 0);
      await panel.getByLabel("Nombre", { exact: true }).fill("Sede prueba");
      await panel.getByLabel("Dirección", { exact: true }).fill("Calle 72, Bogotá");
      await panel.getByLabel("Almacenamiento", { exact: true }).selectOption("SECO");
      await panel.getByLabel("Capacidad (kg)", { exact: true }).fill("100");
      await panel.getByRole("button", { name: "Confirmar", exact: true }).click();
      await panel.waitFor({ state: "hidden" });
      const created = state.newMutations.find((request) => request.path === "/v1/almacenes" && request.body.nombre === "Sede prueba");
      assert(created);
      assert.deepEqual(created.body.ubicacion, { lat: 4.66, lng: -74.06 });
    });
    await scenario("configuración alimentos: filtros, paginación y reactivación", async ({ page, state, login }) => {
      const foods = Array.from({ length: 31 }, (_, index) => ({ id: index + 1, codigo: index === 0 ? "MAMONCILLO" : `ALIMENTO_${index}`, nombre: index === 0 ? "Mamoncillo" : `Producto ${String(index).padStart(2, "0")}`, activo: index !== 0, tipo_almacenamiento: index % 2 ? "REFRIGERADO" : "SECO", requiere_refrigeracion: index % 2 === 1, perecedero: true, vida_util_dias: 30 }));
      const mutations = [];
      await page.route(`${api}/v1/admin/tipos-alimento?*`, async (route) => {
        await checkApiContract(route.request(), state.roles);
        const params = new URL(route.request().url()).searchParams;
        const search = (params.get("q") || "").toLowerCase();
        const rows = foods.filter((row) => (!search || `${row.nombre} ${row.codigo}`.toLowerCase().includes(search)) && (!params.get("estado") || row.activo === (params.get("estado") === "ACTIVO")) && (!params.get("tipo_almacenamiento") || row.tipo_almacenamiento === params.get("tipo_almacenamiento")));
        const start = Number(params.get("desplazamiento")), limit = Number(params.get("limite"));
        await route.fulfill({ json: { datos: rows.slice(start, start + limit), total: rows.length, limite: limit, desplazamiento: start } });
      });
      await page.route(`${api}/v1/admin/tipos-alimento/*`, async (route) => {
        await checkApiContract(route.request(), state.roles);
        const index = Number(new URL(route.request().url()).pathname.split("/").at(-1));
        const change = route.request().postDataJSON();
        mutations.push(change);
        const row = foods.find((food) => food.id === index);
        Object.assign(row, change);
        await route.fulfill({ json: row });
      });
      await login(true);
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.getByText("Ver indicadores adicionales", { exact: true }).click();
      const metrics = await page.locator(".dashboard-extra-content > .metrics").boundingBox();
      const card = await page.locator(".dashboard-extra-content > .card").boundingBox();
      assert(card.y - metrics.y - metrics.height >= 20);
      await page.goto(`${base}/#/configuracion`);
      await page.getByRole("button", { name: "Alimentos", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Tareas", exact: true }).count(), 0);
      const table = page.getByRole("table", { name: "Tipos de alimento", exact: true });
      await table.getByText("Mamoncillo", { exact: true }).waitFor();
      assert.equal(await table.locator("tbody tr").count(), 20);
      await page.getByLabel("Alimentos por página", { exact: true }).selectOption("10");
      await page.getByText("1–10 de 31 registros", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      await page.getByText("11–20 de 31 registros", { exact: true }).waitFor();
      await page.getByLabel("Estado del alimento", { exact: true }).selectOption("INACTIVO");
      await page.getByText("1–1 de 1 registros", { exact: true }).waitFor();
      await table.getByRole("button", { name: "Editar alimento", exact: true }).click();
      assert.equal(await page.getByRole("dialog").getByLabel("Activo", { exact: true }).isChecked(), false);
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      await table.getByRole("button", { name: "Reactivar alimento", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByText("No se encontraron alimentos con estos filtros.", { exact: true }).waitFor();
      assert.deepEqual(mutations[0], { activo: true });
      await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
      await page.getByLabel("Buscar alimento por código o nombre", { exact: true }).fill("mamoncillo");
      await page.getByText("1–1 de 1 registros", { exact: true }).waitFor();
      assert.equal(await table.getByText("Activo", { exact: true }).count(), 1);
      await page.getByLabel("Régimen del alimento", { exact: true }).selectOption("REFRIGERADO");
      await page.getByText("No se encontraron alimentos con estos filtros.", { exact: true }).waitFor();
      assert(!state.requests.some((request) => request.path === "/v1/admin/tareas"));
    });
    await scenario("recepciones de ruta finalizada: selección estados y reintento", async ({ page, state, login }) => {
      state.roles = ["ASESOR_BANCO"];
      state.routeRows = [{ id, codigo: "RUTA-FINALIZADA", estado: "COMPLETADA", paradas: 6 }, { id: userId(8), codigo: "RUTA-EN-CURSO", estado: "EN_CURSO" }];
      const stops = [0, 1, 2, 3, 4].map((i) => ({ id: userId(20 + i), orden: i + 1, tipo: "RECOGIDA", estado: i === 4 ? "FALLIDA" : "COMPLETADA", donacion_id: userId(i), donacion_codigo: `DON-RUTA-${i + 1}`, donacion_estado: i === 3 ? "RECIBIDA" : "ENTREGADA" }));
      state.routeDetails = { [`/v1/rutas/${id}`]: { id, codigo: "RUTA-FINALIZADA", estado: "COMPLETADA", almacen_destino: { nombre: "Sede Norte" }, paradas: [...stops, { ...stops[0], id: userId(29) }, { id: userId(30), tipo: "ENTREGA", estado: "COMPLETADA" }] } };
      const decisions = [];
      await page.route(`${api}/v1/donaciones/*`, (route) => {
        const donationId = new URL(route.request().url()).pathname.split("/").at(-1);
        const stop = stops.find((s) => s.donacion_id === donationId);
        if (!stop || route.request().method() !== "GET") return route.fallback();
        return route.fulfill({ json: { id: donationId, codigo: stop.donacion_codigo, estado: stop.donacion_estado, items: [{ id: userId(40 + stops.indexOf(stop)), cantidad: 10, peso_estimado_kg: 10, tipo_alimento: { nombre: "Manzanas" } }] } });
      });
      await page.route(`${api}/v1/recepciones`, async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        const body = route.request().postDataJSON(); decisions.push(body);
        if (body.donacion_id === userId(1) && decisions.filter((d) => d.donacion_id === userId(1)).length === 1) return route.fulfill({ status: 503, json: { title: "Error temporal de recepción" } });
        for (const stop of state.routeDetails[`/v1/rutas/${id}`].paradas) if (stop.donacion_id === body.donacion_id) stop.donacion_estado = body.estado === "RECHAZADA" ? "RECHAZADA" : "RECIBIDA";
        return route.fulfill({ json: { id: userId(50 + decisions.length), estado: body.estado } });
      });
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/recepciones`);
      await page.getByRole("button", { name: "Crear recepción", exact: true }).click();
      const panel = page.getByRole("dialog", { name: "Crear recepción de ruta", exact: true });
      await panel.getByLabel("Ruta finalizada", { exact: true }).selectOption(id);
      await panel.getByLabel("DON-RUTA-1", { exact: true }).waitFor();
      assert.equal(await panel.getByRole("option", { name: "RUTA-EN-CURSO", exact: true }).count(), 0);
      assert.equal(await panel.getByLabel("DON-RUTA-1", { exact: true }).count(), 1);
      assert(await panel.getByLabel("DON-RUTA-4", { exact: true }).isDisabled());
      assert(await panel.getByLabel("DON-RUTA-5", { exact: true }).isDisabled());
      for (const code of ["DON-RUTA-1", "DON-RUTA-2", "DON-RUTA-3"]) await panel.getByLabel(code, { exact: true }).check();
      const first = panel.getByRole("region", { name: "Recepción de DON-RUTA-1", exact: true });
      await first.getByRole("button", { name: "Registrar recepción", exact: true }).click();
      await panel.getByText("1 recepción registrada en este formulario.", { exact: true }).waitFor();
      const second = panel.getByRole("region", { name: "Recepción de DON-RUTA-2", exact: true });
      await second.getByLabel("Resultado de recepción").selectOption("ACEPTADA_PARCIAL");
      await second.getByLabel("Motivo", { exact: true }).selectOption("1");
      await second.getByLabel("Cantidad aceptada", { exact: true }).fill("5");
      await second.getByLabel("Peso aceptado (kg)", { exact: true }).fill("5");
      await second.getByRole("button", { name: "Registrar recepción", exact: true }).click();
      await second.getByRole("alert").filter({ hasText: "Error temporal de recepción" }).waitFor();
      assert.equal(decisions.filter((d) => d.donacion_id === userId(0)).length, 1);
      await second.getByRole("button", { name: "Registrar recepción", exact: true }).click();
      await panel.getByText("2 recepciones registradas en este formulario.", { exact: true }).waitFor();
      const third = panel.getByRole("region", { name: "Recepción de DON-RUTA-3", exact: true });
      await third.getByLabel("Resultado de recepción").selectOption("RECHAZADA");
      await third.getByLabel("Motivo", { exact: true }).selectOption("1");
      await third.getByRole("button", { name: "Registrar recepción", exact: true }).click();
      await panel.getByText("3 recepciones registradas en este formulario.", { exact: true }).waitFor();
      assert.deepEqual(decisions.map((d) => d.estado), ["ACEPTADA", "ACEPTADA_PARCIAL", "ACEPTADA_PARCIAL", "RECHAZADA"]);
      assert.equal(decisions[2].items[0].cantidad_aceptada, 5);
      assert.equal(decisions[3].items, undefined);
      await page.keyboard.press("Escape");
      state.routeDetails[`/v1/rutas/${id}`].estado = "EN_CURSO";
      await page.getByRole("button", { name: "Crear recepción", exact: true }).click();
      await page.getByLabel("Ruta finalizada", { exact: true }).selectOption(id);
      await page.getByText("La ruta debe estar finalizada antes de crear sus recepciones.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Registrar recepción", exact: true }).count(), 0);
      await page.keyboard.press("Escape");
      state.roles = ["ADMIN"];
      await page.reload();
      await page.getByRole("button", { name: "Ver", exact: true }).first().waitFor();
      assert.equal(await page.getByRole("button", { name: "Crear recepción", exact: true }).count(), 0);
    });
    await scenario("correcciones contexto banco único y usuarios únicos", async ({ page, state, login }) => {
      state.stock = [
        { id, nombre: "Sede Norte", direccion: "Calle 1", tipo: "SECO", capacidad_kg: 1000, kg_en_inventario: 20, activo: true },
        { id: userId(2), nombre: "Sede Sur", direccion: "Calle 2", tipo: "REFRIGERADO", capacidad_kg: 500, kg_en_inventario: 10, activo: true },
      ];
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/configuracion`);
      await page.getByRole("button", { name: "Banco", exact: true }).click();
      await page.getByRole("table", { name: "Sedes del banco", exact: true }).waitFor();
      assert.equal(await page.getByRole("table", { name: "Sedes del banco", exact: true }).locator("tbody tr").count(), 2);
      await page.getByText("La organización tiene un solo banco y varias sedes.", { exact: false }).waitFor();
      await page.goto(`${base}/#/reportes`);
      await page.getByText("Cuentas distintas que realizaron las acciones filtradas. Cada cuenta se cuenta una sola vez.", { exact: true }).waitFor();
    });
    await scenario("correcciones asesor: acceso bloqueado y decisión de recepción", async ({ page, state, login }) => {
      state.roles = ["ASESOR_BANCO"];
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      for (const route of ["usuarios", "configuracion", "voluntarios", "pendientes", "usuarios/detalle"]) {
        await page.goto(`${base}/#/${route}`);
        await page.waitForURL(`${base}/#/inicio`);
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        assert.equal(await page.getByText(/requiere el rol Administrador/).count(), 0);
      }
      assert(!state.requests.some((r) => r.path.startsWith("/v1/admin/")));
      await page.goto(`${base}/#/recepciones`);
      await page.getByRole("button", { name: "Ver", exact: true }).first().click();
      await page.getByText(/Esta recepción ya fue registrada con resultado/).waitFor();
      assert.equal(await page.getByRole("dialog").getByRole("heading", { name: "Evidencias", exact: true }).count(), 0);
      assert.equal(await page.getByRole("dialog").locator('input[type="file"]').count(), 0);
      assert(!state.requests.some((r) => r.path === "/v1/evidencias" && r.params.recepcion_id));
      assert.equal(await page.getByRole("button", { name: "Registrar recepción", exact: true }).count(), 0);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("button", { name: "Pendientes de revisión", exact: true }).count(), 0);
      await page.goto(`${base}/#/recepcion?id=${id}`);
      await page.getByLabel("Resultado de recepción").selectOption("RECHAZADA");
      await page.getByLabel("Motivo", { exact: true }).selectOption("1");
      await page.getByLabel("Observaciones", { exact: true }).fill("Producto no apto para recepción");
      await page.getByRole("button", { name: "Registrar recepción", exact: true }).click();
      await page.waitForURL(`${base}/#/recepciones`);
      assert.equal(state.newMutations.find((r) => r.path === "/v1/recepciones").body.estado, "RECHAZADA");
      state.donationState = "PUBLICADA";
      await page.goto(`${base}/#/recepcion?id=${id}`);
      await page.getByText("Recepción no disponible", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Registrar recepción", exact: true }).count(), 0);
    });
    await scenario("correcciones almacén: dirección y refrigeración sí no", async ({ page, state, login }) => {
      state.roles = ["ASESOR_BANCO"];
      state.stock = [{ id, nombre: "Sede Norte", direccion: "Calle 1 # 2-30", tipo: "SECO", capacidad_kg: 1000, kg_en_inventario: 30, activo: true, lat: 4.65, lng: -74.08 }];
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/almacenes`);
      await page.getByRole("button", { name: "Ver", exact: true }).first().click();
      await page.getByRole("button", { name: "Editar almacén", exact: true }).click();
      const editor = page.getByRole("dialog").last();
      assert.equal(await editor.getByLabel("¿La sede tiene refrigeración?", { exact: true }).inputValue(), "false");
      await editor.getByLabel("¿La sede tiene refrigeración?", { exact: true }).selectOption("true");
      await editor.getByLabel("Dirección", { exact: true }).fill("Carrera 20 # 30-40");
      assert.equal(await editor.getByLabel("Latitud", { exact: true }).count(), 0);
      assert.equal(await editor.getByLabel("Longitud", { exact: true }).count(), 0);
      await editor.getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByRole("dialog", { name: "Editar almacén", exact: true }).waitFor({ state: "hidden" });
      const change = state.newMutations.find((r) => r.path === `/v1/almacenes/${id}`);
      assert.equal(change.body.direccion, "Carrera 20 # 30-40");
      assert.equal(change.body.tipo, "REFRIGERADO");
      assert.equal(change.body.ubicacion, undefined);
    });
    await scenario("rutas compatibles sin seguimiento y errores reales visibles", async ({ page, state, login }) => {
      state.routeRows = [{ id, codigo: "RUTA-SIN-SEGUIMIENTO", estado: "EN_CURSO", paradas: 1 }, { id: userId(2), codigo: "RUTA-ERROR", estado: "EN_CURSO", paradas: 1 }];
      state.routeDetails = Object.fromEntries(state.routeRows.map((row) => [`/v1/rutas/${row.id}`, { ...row, paradas: [{ id: userId(4), orden: 1, tipo: "RECOGIDA", estado: "PENDIENTE", direccion: "Parada de prueba", lat: 4.65, lng: -74.08 }] }]));
      let missingRequests = 0;
      await page.route(`${api}/v1/rutas/${id}/seguimiento**`, (route) => {
        missingRequests++;
        return route.fulfill({ status: 404, json: { message: `Cannot GET /v1/rutas/${id}/seguimiento` } });
      });
      await page.route(`${api}/v1/rutas/${userId(2)}/seguimiento**`, (route) => route.fulfill({ status: 503, json: { title: "Seguimiento temporalmente no disponible" } }));
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/rutas`);
      await page.locator('.google-route-map[data-zoom]').waitFor();
      await page.getByText("Sin posición en vivo. El mapa muestra el trazado de la ruta.", { exact: true }).waitFor();
      assert.equal(await page.getByText(/Cannot GET/).count(), 0);
      await page.evaluate(() => window.dispatchEvent(new Event("findfood:data-changed")));
      await page.getByLabel("Ruta seleccionada", { exact: true }).selectOption(userId(2));
      await page.getByRole("alert").filter({ hasText: "Seguimiento temporalmente no disponible" }).waitFor();
      await page.getByLabel("Ruta seleccionada", { exact: true }).selectOption(id);
      await page.locator('.google-route-map[data-zoom]').waitFor();
      assert.equal(missingRequests, 1);
      assert.equal(await page.getByText(/Cannot GET/).count(), 0);
    });
    await scenario("sesión compatible con API sin endpoint de panel", async ({ page, state, login }) => {
      await page.route(`${api}/v1/panel/sesion`, (route) => route.fulfill({ status: 404, json: { message: "Cannot GET /v1/panel/sesion" } }));
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      assert(state.requests.some((r) => r.path === "/v1/me"));
      await page.reload();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      state.roles = ["DONANTE"];
      await page.reload();
      await page.getByText("El panel web solo permite el acceso a administradores y asesores del banco.", { exact: true }).waitFor();
      assert.equal(await page.locator(".sidebar").count(), 0);
    });
    await scenario("manual RF-33 RF-36 RF-41 filtros KPI y administración", async ({ page, state, login }) => {
      let taskRequests = 0;
      await page.route(`${api}/v1/admin/tareas`, (route) => { taskRequests++; return route.fulfill({ json: { vencer_ofertas: { ultimaEjecucion: new Date().toISOString(), ultimaExitosa: new Date().toISOString(), ultimoResultado: 3, omitidas: 2 } } }); });
      const queries = [];
      await page.route(`${api}/v1/inventario/lotes?**`, (route) => {
        queries.push(Object.fromEntries(new URL(route.request().url()).searchParams));
        return route.fulfill({ json: { datos: [], total: 0 } });
      });
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.getByLabel("Indicadores desde").fill("2026-10-01");
      await page.getByLabel("Indicadores hasta").fill("2026-10-02");
      await page.getByRole("button", { name: "Consultar periodo", exact: true }).click();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      const kpi = state.requests.find((r) => r.path.endsWith("/kpis/resumen") && r.params.desde);
      assert.deepEqual(kpi.params, { desde: "2026-10-01T05:00:00.000Z", hasta: "2026-10-03T05:00:00.000Z" });
      await page.goto(`${base}/#/inventario`);
      await page.getByRole("table", { name: "Inventario FEFO" }).waitFor();
      await page.getByLabel("Filtrar inventario por sede").selectOption(id);
      await page.getByLabel("Filtrar inventario por tipo").selectOption("1");
      await page.getByRole("table", { name: "Inventario FEFO" }).waitFor();
      assert(queries.some((q) => q.almacen_id === id && q.tipo_alimento_id === "1"));
      await page.goto(`${base}/#/configuracion`);
      await page.getByRole("button", { name: "Banco", exact: true }).click();
      await page.getByRole("button", { name: "Guardar banco", exact: true }).click();
      assert.equal(await page.getByRole("dialog").getByLabel("Latitud", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("dialog").getByLabel("Longitud", { exact: true }).count(), 0);
      await page.getByLabel("Nombre", { exact: true }).fill("Banco actualizado");
      await page.getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      const bank = state.newMutations.find((r) => r.path === "/v1/admin/banco");
      assert.equal(bank.body.nombre, "Banco actualizado");
      assert.equal(typeof bank.body.ubicacion.lat, "number");
      assert.deepEqual(bank.body.ubicacion, { lat: 4.7, lng: -74.1 });
      await page.getByRole("button", { name: "Alimentos", exact: true }).click();
      await page.getByRole("button", { name: "Nuevo tipo de alimento", exact: true }).click();
      await page.getByLabel("Categoría", { exact: true }).selectOption("1");
      await page.getByLabel("Unidad", { exact: true }).selectOption("1");
      await page.getByLabel("Código", { exact: true }).fill("FRUTA_NUEVA");
      await page.getByLabel("Nombre", { exact: true }).fill("Fruta nueva");
      await page.getByLabel("Almacenamiento", { exact: true }).selectOption("SECO");
      await page.getByLabel("Vida útil (días)", { exact: true }).fill("3");
      await page.getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(state.newMutations.find((r) => r.path === "/v1/admin/tipos-alimento").body.vida_util_dias, 3);
      await page.getByRole("button", { name: "Tareas", exact: true }).click();
      await page.getByText("vencer_ofertas", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Actualizar tareas", exact: true }).click();
      await page.getByText("vencer_ofertas", { exact: true }).waitFor();
      assert(taskRequests >= 2);
    });
    await scenario("manual RF-03 acceso al panel y recuperación por código", async ({ page, state, login }) => {
      await page.route(`${api}/v1/panel/sesion`, (route) => route.fulfill({ status: 403, json: { type: "acceso-panel-denegado", title: "Solo personal del banco", status: 403 } }));
      await login();
      await page.getByRole("button", { name: "Iniciar sesión", exact: true }).waitFor();
      await page.getByText("Solo personal del banco", { exact: true }).waitFor();
      assert.equal(await page.locator(".sidebar").count(), 0);
      assert(!state.requests.some((r) => r.path === "/v1/me"));
      await page.goto(`${base}/#/recuperar-contrasena`);
      await page.getByLabel("Correo electrónico *").fill(user.email);
      await page.getByRole("button", { name: "Enviar instrucciones", exact: true }).click();
      await page.getByLabel("Código de recuperación", { exact: true }).fill("000000");
      await page.getByRole("button", { name: "Verificar código", exact: true }).click();
      await page.getByText("El código no es válido o venció. Solicita uno nuevo.", { exact: true }).waitFor();
      await page.getByLabel("Código de recuperación", { exact: true }).fill("123456");
      await page.getByRole("button", { name: "Verificar código", exact: true }).click();
      await page.getByLabel("Nueva contraseña *", { exact: true }).waitFor();
      assert(state.recoverySent);
      assert.equal(await page.locator(".sidebar").count(), 0);
    });
    await scenario("manual RF-24 RF-26 RF-30 flota entrega y evidencias de solo lectura", async ({ page, state, login }) => {
      state.roles = ["ASESOR_BANCO"];
      state.activityRows = { "/v1/donaciones": [{ id, codigo: "DON-FLOTA", estado: "PUBLICADA" }] };
      state.routeRows = [{ id, codigo: "RUTA-FLOTA", estado: "PLANIFICADA", paradas: 1 }];
      state.routeDetails = { [`/v1/rutas/${id}`]: { ...state.routeRows[0], flota_banco: true, paradas: [{ id: userId(4), orden: 1, tipo: "ENTREGA", estado: "PENDIENTE", direccion: "Entrega en sede", lat: 4.65, lng: -74.08 }] } };
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/rutas`);
      await page.getByRole("button", { name: "Planificar ruta de flota", exact: true }).click();
      await page.getByLabel("DON-FLOTA", { exact: true }).check();
      await page.getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.deepEqual(state.newMutations.find((r) => r.path === "/v1/rutas").body, { donacion_ids: [id] });
      await page.getByRole("button", { name: "Ver", exact: true }).first().click();
      await page.getByRole("button", { name: "Iniciar ruta", exact: true }).click();
      await page.getByRole("dialog").last().getByRole("button", { name: "Confirmar", exact: true }).click();
      state.routeDetails[`/v1/rutas/${id}`].estado = "EN_CURSO";
      await page.getByRole("button", { name: "Actualizar detalle", exact: true }).click();
      const stop = page.getByRole("heading", { name: "Parada 1 · Entrega en sede", exact: true }).locator("..");
      await stop.getByText("No hay evidencias registradas para este registro.", { exact: true }).waitFor();
      assert.equal(await stop.locator('input[type="file"]').count(), 0);
      assert.equal(await stop.getByRole("button", { name: "Adjuntar evidencia", exact: true }).count(), 0);
      assert.equal(state.newMutations.filter((r) => r.path.includes("/evidencias")).length, 0);
      await stop.getByRole("button", { name: "Confirmar entrega en sede", exact: true }).click();
      await page.getByLabel("Confirmo que verifiqué presencialmente esta operación").check();
      await page.getByRole("dialog").last().getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByRole("button", { name: "Confirmar", exact: true }).waitFor({ state: "hidden" });
      const confirmation = state.newMutations.find((r) => r.path === `/v1/paradas/${userId(4)}/confirmar`);
      assert.equal(confirmation.body.confirmacion_manual, true);
      assert.equal(confirmation.body.ubicacion, undefined);
      assert(Number.isFinite(Date.parse(confirmation.body.confirmada_en_dispositivo)));
    });
    await scenario("manual RF-29 RF-38 Realtime privado y seguimiento", async ({ page, state, login }) => {
      state.activityRows = { "/v1/donaciones": [{ id, codigo: "DON-INICIAL", estado: "PUBLICADA" }] };
      state.routeRows = [{ id, codigo: "RUTA-VIVA", estado: "EN_CURSO", paradas: 1 }];
      state.routeDetails = { [`/v1/rutas/${id}`]: { ...state.routeRows[0], flota_banco: false, paradas: [{ id: userId(4), orden: 1, tipo: "ENTREGA", estado: "PENDIENTE", direccion: "Sede destino", lat: 4.65, lng: -74.08 }] } };
      const trackingRequests = [];
      await page.route(`${api}/v1/rutas/${id}/seguimiento**`, (route) => {
        const params = new URL(route.request().url()).searchParams;
        trackingRequests.push(Object.fromEntries(params));
        return route.fulfill({ json: { parada: { direccion: "Sede destino" }, origen: params.has("lat") ? { lat: Number(params.get("lat")), lng: Number(params.get("lng")) } : null, tramo: params.has("lat") ? { trayecto: { coordinates: [[-74.08, 4.65], [-74.10, 4.67]] }, distancia_km: 2, duracion_min: 5, llegada_estimada: new Date().toISOString(), proveedor: "GOOGLE" } : null } });
      });
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/donaciones`);
      await page.getByText("DON-INICIAL", { exact: true }).first().waitFor();
      state.activityRows["/v1/donaciones"] = [{ id, codigo: "DON-ACTUALIZADA", estado: "ASIGNADA" }];
      state.broadcast("banco:donaciones", "donacion_estado", { id, estado: "ASIGNADA" });
      await page.getByText("DON-ACTUALIZADA", { exact: true }).first().waitFor();
      await page.goto(`${base}/#/rutas`);
      await page.getByText("Esperando una ubicación reciente del vehículo.", { exact: true }).waitFor();
      state.broadcast(`ruta:${id}`, "ubicacion", { lat: 4.69123, lng: -74.08123 });
      await page.getByText("Posición recibida en vivo.", { exact: true }).waitFor();
      await page.getByText("Próxima parada:", { exact: false }).waitFor();
      assert(trackingRequests.some((q) => q.lat === "4.69123" && q.lng === "-74.08123"));
      const mapsBefore = await page.evaluate(() => window.__mapCount);
      const update = page.waitForRequest((request) => request.url().includes("/seguimiento?") && new URL(request.url()).searchParams.get("lat") === "4.69124");
      state.broadcast(`ruta:${id}`, "ubicacion", { lat: 4.69124, lng: -74.08124 });
      await update;
      assert.equal(await page.evaluate(() => window.__mapCount), mapsBefore);
      assert(state.realtimeJoins.every((join) => join.payload.config.private === true));
      assert(!(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).includes("4.69123"));
    });
    await scenario("inventario FEFO y reporte de acciones", async ({ page, login }) => {
      const now = Date.now();
      const lots = Array.from({ length: 101 }, (_, i) => ({
        lote_id: `lot-${i}`, codigo_lote: `LOTE-${String(i).padStart(3, "0")}`, tipo_alimento: "Fruta",
        almacen: "Central", cantidad_disponible: 1, unidad: "KG", peso_disponible_kg: 1,
        requiere_refrigeracion: i % 2 === 0,
        fecha_vencimiento: i === 100 ? new Date(now + 3600000).toISOString() : i === 0 ? null : new Date(now + 10 * 86400000).toISOString(),
      }));
      await page.route(`${api}/v1/inventario/lotes?**`, async (route) => {
        const start = Number(new URL(route.request().url()).searchParams.get("desplazamiento"));
        await route.fulfill({ json: { datos: lots.slice(start, start + 100), total: lots.length } });
      });
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/inventario`);
      await page.getByRole("table", { name: "Inventario FEFO" }).waitFor();
      assert.equal(await page.locator("tbody tr").first().locator("td").nth(1).innerText(), "LOTE-100");
      assert.equal(await page.locator(".summary-value").nth(0).innerText(), "101");
      assert.equal(await page.locator(".summary-value").nth(1).innerText(), "1");
      assert.equal(await page.locator(".summary-value").nth(3).innerText(), "101 kg");
      assert.equal(await page.getByRole("link", { name: "Distribuciones", exact: true }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Incidencias", exact: true }).count(), 0);
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "findfood-inventory-preview.png"), fullPage: true });
      await page.getByLabel("Buscar producto o lote").fill("LOTE-000");
      assert.equal(await page.locator("tbody tr").count(), 1);
      assert.equal(await page.locator("tbody tr").first().locator("td").first().innerText(), "—");
      await page.evaluate(async () => {
        const { apiRequest } = await import("/src/integration/http.ts");
        await apiRequest("/me", { method: "PATCH", body: JSON.stringify({ nombres: "Ana", password: "secret-test" }) });
      });
      await page.goto(`${base}/#/reportes`);
      await page.getByRole("heading", { name: "Reporte de auditorías", exact: true }).waitFor();
      const table = page.getByRole("table", { name: "Reporte de auditorías" });
      await table.getByText("Editó", { exact: true }).waitFor();
      assert.equal(await table.locator("tbody tr").count(), 1);
      assert.equal(await page.getByText("Conexión API activa", { exact: true }).count(), 0);
      assert.equal(await page.getByText("Datos de la API", { exact: true }).count(), 0);
      const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith("findfood:audit:")).map(([, v]) => v).join(""));
      assert(!stored.includes("secret-test"));
      await page.reload();
      await page.getByRole("table", { name: "Reporte de auditorías" }).getByText("Editó", { exact: true }).waitFor();
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar reporte" }).click();
      assert.equal((await download).suggestedFilename(), "reporte-auditorias.csv");
      await page.getByLabel("Módulo", { exact: true }).selectOption("Perfil");
      assert.equal(await page.getByRole("table").locator("tbody tr").count(), 1);
      await page.route(`${api}/v1/me`, (route) => route.fulfill({ status: 500, json: { title: "Error simulado" } }));
      await page.evaluate(async () => {
        const { apiRequest } = await import("/src/integration/http.ts");
        try { await apiRequest("/me", { method: "PATCH", body: "{}" }); } catch { /* Expected failure must not appear as a successful action. */ }
      });
      assert.equal(await page.getByRole("table").locator("tbody tr").count(), 1);
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "findfood-audit-preview.png"), fullPage: true });
    });
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
    await scenario("mapa por ruta y actividad nueva sin recargar", async ({ page, state, login }) => {
      await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") }));
      state.routeRows = [
        { id, codigo: "RUTA-UNO", estado: "COMPLETADA", paradas: 2 },
        { id: userId(2), codigo: "RUTA-DOS", estado: "PLANIFICADA", paradas: 1 },
      ];
      state.routeDetails = {
        [`/v1/rutas/${id}`]: { ...state.routeRows[0], paradas: [
          { id: "p1", orden: 1, direccion: "Origen real", lat: 4.65, lng: -74.08, estado: "COMPLETADA" },
          { id: "p2", orden: 2, direccion: "Destino real", lat: 4.67, lng: -74.10, estado: "COMPLETADA" },
        ] },
        [`/v1/rutas/${userId(2)}`]: { ...state.routeRows[1], paradas: [] },
      };
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.goto(`${base}/#/rutas`);
      await page.locator('.google-route-map[data-zoom]').waitFor();
      await page.getByText("Paradas conectadas en orden. La API no incluye el trazado GPS del recorrido.", { exact: true }).waitFor();
      if (process.env.TEST_SCREENSHOT_DIR) await page.screenshot({ path: require("node:path").join(process.env.TEST_SCREENSHOT_DIR, "routes-map.png"), fullPage: true });
      const before = await page.locator(".google-route-map").getAttribute("data-zoom");
      await page.getByRole("button", { name: "Acercar mapa" }).click();
      assert.notEqual(await page.locator(".google-route-map").getAttribute("data-zoom"), before);
      await page.getByLabel("Ruta seleccionada", { exact: true }).selectOption(userId(2));
      await page.getByText("Esta ruta no incluye coordenadas para mostrar el mapa.", { exact: true }).waitFor();
      assert.equal(await page.locator(".route-map-canvas").count(), 0);
      await page.getByLabel("Ruta seleccionada", { exact: true }).selectOption(id);
      await page.locator('.google-route-map[data-zoom]').waitFor();
      state.routeRows.unshift({ id: userId(3), codigo: "RUTA-NUEVA", estado: "PLANIFICADA", paradas: 0 });
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.getByRole("link", { name: "Abrir notificaciones, 2 sin leer", exact: true }).waitFor();
      await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
      await page.getByText("Se ha creado una nueva ruta", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Marcar todas como leídas", exact: true }).click();
      await page.getByRole("link", { name: "Abrir notificaciones, 0 sin leer", exact: true }).waitFor();
    });
    await scenario("actividad importante: pendientes, altas y cambios de estado", async ({ page, state, login }) => {
      state.activityRows = {
        "/v1/rutas": [{ id: "route-one", codigo: "RUT-ONE", estado: "EN_CURSO" }],
        "/v1/donaciones": [{ id: "donation-one", codigo: "DON-ONE", estado: "PUBLICADA" }, ...Array.from({ length: 100 }, (_, index) => ({ id: `donation-page-${index}`, codigo: `DON-PAGE-${index}`, estado: "PUBLICADA" }))],
        "/v1/admin/usuarios": [{ id: "user-one", nombres: "Ana", estado: "PENDIENTE" }],
        "/v1/admin/verificaciones?estado=PENDIENTE": [
          { id: "recent", estado: "PENDIENTE", created_at: new Date(Date.now() - 86400000).toISOString(), usuario: { nombres: "Solicitud reciente" } },
          { id: "old", estado: "PENDIENTE", created_at: "2020-01-01T00:00:00Z", usuario: { nombres: "Solicitud antigua" } },
        ],
        "/v1/admin/verificaciones?estado=APROBADA": [],
      };
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.getByRole("link", { name: "Abrir notificaciones, 2 sin leer", exact: true }).waitFor();
      await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
      await page.getByText("Tienes un voluntario pendiente reciente", { exact: true }).waitFor();
      assert.equal(await page.locator(".activity-list").getByText("Solicitud antigua", { exact: true }).count(), 0);
      state.activityRows["/v1/rutas"][0].estado = "COMPLETADA";
      state.activityRows["/v1/donaciones"].at(-1).estado = "EXPIRADA";
      state.activityRows["/v1/admin/usuarios"][0].estado = "ACTIVO";
      state.activityRows["/v1/donaciones"].push({ id: "new-donation", codigo: "DON-NEW", estado: "PUBLICADA" });
      state.activityRows["/v1/admin/usuarios"].push({ id: "new-user", nombres: "Usuario nuevo", estado: "ACTIVO" });
      state.activityRows["/v1/admin/verificaciones?estado=APROBADA"].push({ id: "approved", estado: "APROBADA", usuario: { nombres: "Voluntario aprobado" } });
      state.activityRows["/v1/admin/verificaciones?estado=PENDIENTE"].push({ id: "new-pending", estado: "PENDIENTE", usuario: { nombres: "Postulante nuevo" } });
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      for (const title of ["Una ruta ha finalizado", "Una donación se ha vencido", "Se aprobó un usuario", "Se ha creado una nueva donación", "Se ha creado un nuevo usuario", "Se aceptó a un nuevo voluntario", "Hay un nuevo voluntario pendiente de aprobación"]) await page.getByText(title, { exact: true }).waitFor();
      await page.getByText("Donación publicada", { exact: true }).waitFor();
      assert.equal(await page.locator(".activity-list > li").count(), 9);
      const refreshed = page.waitForResponse((response) => response.url().includes("/donaciones?limite=100&desplazamiento=100"));
      await page.reload();
      await page.getByText("Tienes un voluntario pendiente reciente", { exact: true }).waitFor();
      await refreshed;
      await page.getByText("Donación publicada", { exact: true }).waitFor();
      assert.equal(await page.locator(".activity-list > li").count(), 9);
    });
    await scenario("notificaciones unificadas: fuentes, búsqueda, lectura y errores", async ({ page, state, login }) => {
      await login();
      await page.getByText("Donaciones creadas", { exact: true }).waitFor();
      await page.evaluate(({ userId }) => {
        localStorage.setItem(`findfood:activity:${userId}`, JSON.stringify([
          { id: "user:one", titulo: "Usuario creado uno", cuerpo: "Primer usuario", href: "#/usuarios", created_at: "2026-01-02T00:00:00Z", leida_at: null },
          { id: "user:two", titulo: "Usuario creado dos", cuerpo: "Segundo usuario", href: "#/usuarios", created_at: "2026-01-01T00:00:00Z", leida_at: null },
        ]));
        window.dispatchEvent(new Event("storage"));
      }, { userId: id });
      await page.getByRole("link", { name: "Abrir notificaciones, 3 sin leer", exact: true }).click();
      const panel = page.getByRole("dialog", { name: "Notificaciones", exact: true });
      await panel.getByText("Donación publicada", { exact: true }).waitFor();
      assert.equal(await panel.locator(".activity-list").count(), 1);
      assert.equal(await panel.locator(".activity-list > li").count(), 3);
      assert.equal(await panel.getByText("Actividad detectada", { exact: true }).count(), 0);
      await panel.getByLabel("Buscar notificaciones", { exact: true }).fill("Segundo usuario");
      assert.equal(await panel.locator(".activity-list > li").count(), 1);
      await panel.getByRole("button", { name: "Marcar leída", exact: true }).click();
      await page.getByRole("link", { name: "Abrir notificaciones, 2 sin leer", exact: true }).waitFor();
      await panel.getByLabel("Buscar notificaciones", { exact: true }).fill("");
      await panel.getByRole("button", { name: "Marcar todas como leídas", exact: true }).click();
      await page.getByRole("link", { name: "Abrir notificaciones, 0 sin leer", exact: true }).waitFor();
      assert.equal(await panel.locator(".is-unread").count(), 0);
      state.notificationRows = Array.from({ length: 101 }, (_, index) => ({ id: `remote-${index}`, titulo: `Aviso remoto ${index}`, cuerpo: "Mensaje remoto", created_at: "2026-01-03T00:00:00Z" }));
      await panel.getByRole("button", { name: "Actualizar lista", exact: true }).click();
      await panel.getByText("103 notificaciones", { exact: true }).waitFor();
      await panel.getByLabel("Buscar notificaciones", { exact: true }).fill("Aviso remoto 100");
      await panel.getByText("Aviso remoto 100", { exact: true }).waitFor();
      state.notificationFailure = true;
      await panel.getByLabel("Buscar notificaciones", { exact: true }).fill("");
      await panel.getByRole("button", { name: "Actualizar lista", exact: true }).click();
      await panel.getByRole("alert").filter({ hasText: "Notificaciones no disponibles" }).waitFor();
      await panel.getByLabel("Buscar notificaciones", { exact: true }).fill("Usuario creado");
      assert.equal(await panel.locator(".activity-list > li").count(), 2);
    });
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
          .getByText("Si la cuenta puede usar el panel,", { exact: false })
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
        .filter({ hasText: "Verifica el código" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Actualizar contraseña", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("link", { name: "Solicitar código", exact: true })
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
        assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("findfood:activity:")).flatMap((key) => JSON.parse(localStorage.getItem(key))).filter((notice) => notice.titulo === "Se ha creado un nuevo usuario").length), 0);
        await panel
          .getByRole("button", { name: "Crear usuario", exact: true })
          .click();
        await panel
          .getByText("Usuario creado: nuevo@example.test", { exact: true })
          .waitFor();
        // The list fixture does not include the created account. The successful
        // POST must still publish one immediate notice without polling.
        assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("findfood:activity:")).flatMap((key) => JSON.parse(localStorage.getItem(key))).filter((notice) => notice.titulo === "Se ha creado un nuevo usuario").length), 1);
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
        await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
        await page.getByText("Se ha creado un nuevo usuario", { exact: true }).waitFor();
        await page.locator(".activity-list").getByText("Nuevo Asesor", { exact: true }).waitFor();
        assert.equal(await page.locator(".activity-list").getByText("Se ha creado un nuevo usuario", { exact: true }).count(), 1);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
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
        assert.equal(state.statuses[userId(1)], "INACTIVO");
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
        assert.equal(state.statuses[userId(1)], "ACTIVO");
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
          await page.locator(".table-card table").waitFor();
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
        await page.locator(".assignment-candidates").getByRole("heading", { name: "Nora", exact: true }).waitFor();
        await page.getByText("La API entrega el puntaje total, pero no incluye su desglose por criterio.", { exact: true }).waitFor();
        assert.equal(await page.locator(".assignment-summary").getByText("12 kg", { exact: true }).count(), 1);
        if (process.env.TEST_SCREENSHOT_DIR) {
          await page.screenshot({ path: require("node:path").join(process.env.TEST_SCREENSHOT_DIR, "assignment-desktop.png"), fullPage: true });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.locator(".sidebar").waitFor({ state: "hidden" });
          await page.screenshot({ path: require("node:path").join(process.env.TEST_SCREENSHOT_DIR, "assignment-mobile.png"), fullPage: true });
          assert(await page.locator(".assignment-live").evaluate((element) => element.scrollWidth <= element.clientWidth));
          await page.setViewportSize({ width: 1280, height: 720 });
        }
        assert(
          state.requests.some((r) =>
            r.path.endsWith(`/donaciones/${id}/candidatos`),
          ),
        );
        await page.goto(`${base}/#/recepcion?id=${id}`);
        await page.getByText("Detalle desde API", { exact: true }).waitFor();
        await page.goto(`${base}/#/configuracion`);
        await page.getByLabel("Proximidad (%)", { exact: true }).waitFor();
        for (const name of [
          "Banco de alimentos",
          "Parámetros",
          "Catálogos",
          "Operación del sistema",
        ]) {
          assert.equal(
            await page.getByRole("button", { name, exact: true }).count(),
            0,
          );
        }
        await page.goto(`${base}/#/reportes`);
        await page.getByRole("heading", { name: "Reporte de auditorías", exact: true }).waitFor();
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
      "acciones ADMIN: almacenes, verificación y notificaciones",
      async ({ page, state, login }) => {
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        const submit = async () => {
          const panel = page.getByRole("dialog").last();
          const title = await panel.getByRole("heading").first().innerText();
          await panel
            .getByRole("button", { name: "Confirmar", exact: true })
            .click();
          await page
            .getByRole("dialog", { name: title, exact: true })
            .waitFor({ state: "hidden" });
        };
        await page.goto(`${base}/#/almacenes`);
        await page
          .getByRole("button", { name: "Nuevo almacén", exact: true })
          .click();
        let panel = page.getByRole("dialog").last();
        await panel.getByLabel("Nombre", { exact: true }).fill("Sede nueva");
        await panel
          .getByLabel("Dirección", { exact: true })
          .fill("Calle 12 34");
        await panel.getByLabel("Latitud").fill("4.7");
        await panel.getByLabel("Longitud").fill("-74.1");
        await panel.getByLabel("Almacenamiento").selectOption("SECO");
        await panel.getByLabel("Capacidad (kg)").fill("500");
        if (process.env.TEST_SCREENSHOT_DIR) {
          await panel.evaluate(async (element) => {
            await Promise.all(
              element
                .getAnimations({ subtree: true })
                .map((animation) => animation.finished.catch(() => {})),
            );
          });
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              "warehouse-form-desktop.png",
            ),
          });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              "warehouse-form-mobile.png",
            ),
          });
          assert((await panel.boundingBox()).width <= 390);
          await page.setViewportSize({ width: 1280, height: 720 });
        }
        state.mutationFailure = true;
        await panel
          .getByRole("button", { name: "Confirmar", exact: true })
          .click();
        await panel
          .getByRole("alert")
          .filter({ hasText: "No se pudo guardar" })
          .waitFor();
        state.mutationFailure = false;
        await submit();
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Editar almacén", exact: true })
          .click();
        panel = page.getByRole("dialog").last();
        await panel.getByLabel("Nombre", { exact: true }).fill("Sede editada");
        await submit();
        await page.keyboard.press("Escape");
        await page.goto(`${base}/#/pendientes`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Rechazar solicitud", exact: true })
          .click();
        panel = page.getByRole("dialog").last();
        await panel.getByLabel("Motivo", { exact: true }).selectOption("1");
        await panel
          .getByLabel("Observación", { exact: true })
          .fill("Documento ilegible");
        await submit();
        await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
        await page
          .getByRole("button", {
            name: "Marcar todas como leídas",
            exact: true,
          })
          .click();
        await page.getByRole("link", { name: "Abrir notificaciones, 0 sin leer", exact: true }).waitFor();
        await page.keyboard.press("Escape");
        assert(state.noticesRead);
      },
    );
    await scenario(
      "acciones ASESOR: recepción parcial, ajustes, distribución y evidencias",
      async ({ page, state, login }) => {
        state.roles = ["ASESOR_BANCO"];
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        const submit = async () => {
          const panel = page.getByRole("dialog").last();
          const title = await panel.getByRole("heading").first().innerText();
          await panel
            .getByRole("button", { name: "Confirmar", exact: true })
            .click();
          await page
            .getByRole("dialog", { name: title, exact: true })
            .waitFor({ state: "hidden" });
        };
        await page.goto(`${base}/#/recepcion?id=${id}`);
        await page
          .getByLabel("Resultado de recepción")
          .selectOption("ACEPTADA_PARCIAL");
        await page.getByLabel("Motivo", { exact: true }).selectOption("1");
        await page.getByLabel("Cantidad aceptada").fill("10");
        await page.getByLabel("Peso aceptado (kg)").fill("10");
        await page
          .getByRole("button", { name: "Registrar recepción", exact: true })
          .click();
        await page.locator(".table-card table").waitFor();
        assert(
          state.newMutations.some(
            (r) =>
              r.path === "/v1/recepciones" &&
              r.body.items[0].cantidad_aceptada === 10,
          ),
        );
        await page.goto(`${base}/#/inventario`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Ajustar inventario", exact: true })
          .click();
        let panel = page.getByRole("dialog").last();
        await panel.getByLabel("Tipo de ajuste").selectOption("MERMA");
        await panel.getByLabel("Cantidad en unidades del lote").fill("1");
        await panel
          .getByLabel("Motivo", { exact: true })
          .fill("Producto dañado");
        await submit();
        await page.goto(`${base}/#/distribuciones`);
        await page
          .getByRole("button", { name: "Nueva distribución", exact: true })
          .click();
        await page.getByLabel("Tipo de destino").selectOption("1");
        await page.getByLabel("Nombre del destino").fill("Comedor comunitario");
        await page.getByLabel("Producto", { exact: true }).selectOption("1");
        await page.getByLabel("Unidad", { exact: true }).selectOption("1");
        await page.getByLabel("Cantidad", { exact: true }).fill("5");
        await page
          .getByRole("button", { name: "Crear distribución", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Nueva distribución", exact: true })
          .waitFor();
        await page.goto(`${base}/#/recepciones`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        assert.equal(await page.locator('input[type="file"]').count(), 1);
        await page.goto(`${base}/#/incidencias`);
        await page
          .getByRole("button", { name: "Nueva incidencia", exact: true })
          .click();
        panel = page.getByRole("dialog").last();
        await panel.getByLabel("Donación afectada").selectOption(id);
        await panel.getByLabel("Tipo de incidencia").selectOption("1");
        await panel.getByLabel("Descripción").fill("Novedad de transporte");
        await submit();
        await page.goto(`${base}/#/almacenes`);
        assert.equal(
          await page
            .getByRole("button", { name: "Nuevo almacén", exact: true })
            .count(),
          0,
        );
      },
    );
    await scenario(
      "acciones restantes y permisos administrativos",
      async ({ page, state, login }) => {
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        const submit = async () => {
          const panel = page.getByRole("dialog").last();
          const title = await panel.getByRole("heading").first().innerText();
          await panel
            .getByRole("button", { name: "Confirmar", exact: true })
            .click();
          await page
            .getByRole("dialog", { name: title, exact: true })
            .waitFor({ state: "hidden" });
        };
        await page.goto(`${base}/#/pendientes`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Aprobar voluntario", exact: true })
          .click();
        await submit();
        await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
        await page.getByText("Se aceptó a un nuevo voluntario", { exact: true }).waitFor();
        await page.keyboard.press("Escape");
        await page.goto(`${base}/#/usuarios`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Suspender cuenta", exact: true })
          .click();
        let panel = page.getByRole("dialog").last();
        await panel
          .getByLabel("Motivo de suspensión")
          .fill("Incumplimiento confirmado");
        await submit();
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Reactivar cuenta", exact: true })
          .click();
        await submit();
        await page.goto(`${base}/#/donaciones`);
        await page
          .getByRole("link", { name: "Asignar", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Reasignar donación", exact: true })
          .click();
        await submit();
        await page.goto(`${base}/#/donaciones`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Cancelar donación", exact: true })
          .click();
        panel = page.getByRole("dialog").last();
        await panel.getByLabel("Motivo", { exact: true }).selectOption("1");
        await panel
          .getByLabel("Observación")
          .fill("Cancelación solicitada por donante");
        await submit();
        await page.goto(`${base}/#/incidencias`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Resolver incidencia", exact: true })
          .click();
        panel = page.getByRole("dialog").last();
        await panel
          .getByLabel("Resolución")
          .fill("Caso revisado y solucionado");
        await submit();
        await page.getByRole("link", { name: /Abrir notificaciones/ }).click();
        await page
          .locator(".activity-list > li").filter({ hasText: "Donación publicada" })
          .getByRole("button", { name: "Marcar leída", exact: true })
          .click();
        await page.locator(".activity-list > li").filter({ hasText: "Donación publicada" }).getByText("Leída", { exact: true }).waitFor();
        await page.keyboard.press("Escape");
        assert(state.newMutations.some((r) => r.path.endsWith("/leer")));
        // Un ADMIN no hereda las operaciones exclusivas de ASESOR_BANCO.
        await page.goto(`${base}/#/rutas`);
        await page.locator(".table-card table").waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Nueva ruta", exact: true })
            .count(),
          0,
        );
        await page.goto(`${base}/#/inventario`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Ajustar inventario", exact: true })
            .count(),
          0,
        );
      },
    );
    await scenario(
      "acciones restantes del asesor: alertas, distribuciones e incidencias",
      async ({ page, state, login }) => {
        state.roles = ["ASESOR_BANCO"];
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        const submit = async () => {
          const panel = page.getByRole("dialog").last();
          const title = await panel.getByRole("heading").first().innerText();
          await panel
            .getByRole("button", { name: "Confirmar", exact: true })
            .click();
          await page
            .getByRole("dialog", { name: title, exact: true })
            .waitFor({ state: "hidden" });
        };
        await page.goto(`${base}/#/alertas`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Atender alerta", exact: true })
          .click();
        let panel = page.getByRole("dialog").last();
        await panel
          .getByLabel("Acción tomada")
          .fill("Se retiró producto vencido");
        await submit();
        for (const action of [
          "Confirmar distribución",
          "Anular distribución",
        ]) {
          await page.goto(`${base}/#/distribuciones`);
          await page
            .getByRole("button", { name: "Ver", exact: true })
            .first()
            .click();
          await page.getByRole("button", { name: action, exact: true }).click();
          await submit();
        }
        await page.goto(`${base}/#/incidencias`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Resolver incidencia", exact: true })
            .count(),
          0,
        );
        await page
          .getByRole("button", { name: "Revisar incidencia", exact: true })
          .click();
        await submit();
        assert(state.newMutations.some((r) => r.path.endsWith("/anular")));
      },
    );
    await scenario(
      "consulta de evidencias, fotos, renovación y errores",
      async ({ page, state, login }) => {
        const imageHost = "https://images.findfood.test";
        await page.route(`${imageHost}/**`, (route) => {
          if (route.request().url().includes("expired"))
            return route.fulfill({ status: 403 });
          return route.fulfill({
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1kAAAAASUVORK5CYII=",
              "base64",
            ),
          });
        });
        state.productPhoto = `${imageHost}/product.png?token=one`;
        state.evidenceRows = [
          {
            id,
            tipo: "PUBLICACION",
            ruta: "evidencias/usuario/foto.png",
            url_lectura: `${imageHost}/photo.png?token=one`,
            capturada_at: new Date().toISOString(),
          },
        ];
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        for (const path of [
          "donaciones",
          "rutas",
        ]) {
          await page.goto(`${base}/#/${path}`);
          await page
            .getByRole("button", { name: "Ver", exact: true })
            .first()
            .click();
          const panel = page.getByRole("dialog");
          const evidence = panel.getByRole("region", {
            name: "Evidencias registradas",
            exact: true,
          });
          const photo = evidence.getByRole("img", {
            name: "Evidencia 1",
            exact: true,
          });
          await photo.scrollIntoViewIfNeeded();
          await photo.evaluate((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve;
                }),
          );
          assert(await photo.evaluate((img) => img.naturalWidth > 0));
          assert.equal(await panel.locator('input[type="file"]').count(), 0);
          assert.equal(
            await panel
              .getByRole("button", { name: "Guardar evidencia", exact: true })
              .count(),
            0,
          );
          assert.equal(await panel.getByLabel("Tipo de evidencia").count(), 0);
          if (path === "donaciones") {
            const product = panel.getByRole("img", {
              name: "Fotografía del producto",
              exact: true,
            });
            await product.waitFor();
            assert.equal(await product.getAttribute("src"), state.productPhoto);
          }
          await page.keyboard.press("Escape");
        }
        await page.goto(`${base}/#/donaciones`);
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        const panel = page.getByRole("dialog");
        const evidence = panel.getByRole("region", {
          name: "Evidencias registradas",
          exact: true,
        });
        await evidence.getByRole("img").waitFor();
        state.evidenceRows[0].url_lectura = null;
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        await evidence
          .getByText(/La evidencia está registrada, pero su enlace/)
          .waitFor();
        assert.equal(
          await evidence
            .getByText("No hay evidencias registradas para este registro.")
            .count(),
          0,
        );
        state.evidenceRows[0].url_lectura = "javascript:alert(1)";
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        await evidence
          .getByText(/La evidencia está registrada, pero su enlace/)
          .waitFor();
        assert.equal(
          await evidence.locator('a[href^="javascript:"]').count(),
          0,
        );
        state.evidenceRows[0].url_lectura = `${imageHost}/expired.png?token=old`;
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        await evidence
          .getByRole("link", { name: "Abrir imagen en otra pestaña" })
          .scrollIntoViewIfNeeded();
        await evidence.getByText(/No se pudo mostrar la imagen/).waitFor();
        state.evidenceRows[0].url_lectura = `${imageHost}/photo.png?token=renewed`;
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        const renewed = evidence.getByRole("img");
        await renewed.scrollIntoViewIfNeeded();
        await renewed.evaluate((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              }),
        );
        assert(await renewed.evaluate((img) => img.naturalWidth > 0));
        assert.equal(
          await renewed.getAttribute("src"),
          state.evidenceRows[0].url_lectura,
        );
        if (process.env.TEST_SCREENSHOT_DIR) {
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              "evidence-readonly-desktop.png",
            ),
          });
          await page.setViewportSize({ width: 390, height: 844 });
          await renewed.scrollIntoViewIfNeeded();
          assert(
            await renewed.evaluate(
              (img) => img.getBoundingClientRect().right <= window.innerWidth,
            ),
          );
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              "evidence-readonly-narrow.png",
            ),
          });
        }
        state.evidenceRows[0].url_lectura =
          "http://storage.simulado/evidencias/file.png";
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        await evidence.getByText(/almacenamiento simulado/).waitFor();
        state.evidenceFailure = true;
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        await evidence.getByRole("alert").waitFor();
        state.evidenceFailure = false;
        state.evidenceRows = [];
        await evidence
          .getByRole("button", { name: "Actualizar enlaces" })
          .click();
        await evidence
          .getByText("No hay evidencias registradas para este registro.")
          .waitFor();
        // Las fotografías de productos no dependen de que exista evidencia de publicación.
        await panel
          .getByRole("img", { name: "Fotografía del producto", exact: true })
          .waitFor();
        state.productPhoto = `${imageHost}/product.png?token=two`;
        await panel
          .getByRole("button", { name: "Actualizar detalle", exact: true })
          .click();
        const product = panel.getByRole("img", {
          name: "Fotografía del producto",
          exact: true,
        });
        await product.waitFor();
        assert.equal(await product.getAttribute("src"), state.productPhoto);
        assert(
          !state.requests.some(
            (r) => r.path.includes("/evidencias") && r.method !== "GET",
          ),
        );
      },
    );
    await scenario(
      "permisos de menú, rutas y almacenes",
      async ({ page, state, login }) => {
        state.roles = ["ASESOR_BANCO"];
        state.stock = [
          {
            id,
            nombre: "Sede Norte",
            kg_en_inventario: "125.5",
            capacidad_kg: 500,
            activo: true,
          },
        ];
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        const nav = page.getByRole("navigation", {
          name: "Navegación principal",
        });
        for (const name of [
          "Usuarios",
          "Lista de voluntarios",
          "Configuración",
        ])
          assert.equal(
            await nav.getByRole("link", { name, exact: true }).count(),
            0,
          );
        for (const route of [
          "usuarios",
          "voluntarios",
          "pendientes",
          "configuracion",
        ]) {
          await page.goto(`${base}/#/${route}`);
          await page
            .getByRole("alert")
            .filter({ hasText: "requiere el rol Administrador" })
            .waitFor();
        }
        assert(!state.requests.some((r) => r.path.startsWith("/v1/admin/")));
        for (const role of ["ASESOR_BANCO", "ADMIN"]) {
          state.roles = [role];
          await page.goto(`${base}/#/rutas`);
          await page.reload();
          await page.locator(".table-card table").waitFor();
          assert.equal(
            await page
              .getByRole("button", { name: "Nueva ruta", exact: true })
              .count(),
            0,
          );
          await page
            .getByRole("button", { name: "Ver", exact: true })
            .first()
            .click();
          const panel = page.getByRole("dialog");
          await panel.getByText("Detalle desde API", { exact: true }).waitFor();
          await panel
            .getByRole("heading", { name: /Parada 1/, level: 3 })
            .waitFor();
          for (const name of [
            "Iniciar ruta",
            "Registrar llegada",
            "Confirmar parada",
            "Reportar parada fallida",
            "Guardar evidencia",
          ])
            assert.equal(
              await panel.getByRole("button", { name, exact: true }).count(),
              0,
            );
          assert.equal(await panel.getByRole("button", { name: "Cancelar ruta", exact: true }).count(), 1);
          assert.equal(
            await panel.getByLabel("Imagen de evidencia").count(),
            0,
          );
          assert(
            !state.requests.some(
              (r) =>
                r.method !== "GET" && /^\/v1\/(rutas|paradas)/.test(r.path),
            ),
          );
          if (process.env.TEST_SCREENSHOT_DIR) {
            await panel.evaluate(async (el) => {
              await Promise.all(
                el.getAnimations().map((a) => a.finished.catch(() => {})),
              );
            });
            await page.screenshot({
              path: require("node:path").join(
                process.env.TEST_SCREENSHOT_DIR,
                `routes-readonly-${role}.png`,
              ),
            });
          }
          await page.keyboard.press("Escape");
        }
        await page.goto(`${base}/#/almacenes`);
        await page.getByText("125,5 kg", { exact: true }).waitFor();
        await page
          .getByRole("columnheader", {
            name: "Existencias actuales (kg)",
            exact: true,
          })
          .waitFor();
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        const panel = page.getByRole("dialog");
        await panel
          .getByRole("row")
          .filter({ hasText: "Existencias actuales (kg)" })
          .getByText("125,5", { exact: true })
          .waitFor();
        state.stock[0].kg_en_inventario = 130;
        await page.evaluate(() =>
          window.dispatchEvent(new Event("findfood:data-changed")),
        );
        await panel
          .getByRole("row")
          .filter({ hasText: "Existencias actuales (kg)" })
          .getByText("130", { exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        state.roles = ["ASESOR_BANCO"];
        state.donationState = "PUBLICADA";
        await page.goto(`${base}/#/recepcion?id=${id}`);
        await page.reload();
        await page
          .getByRole("alert")
          .filter({ hasText: "Solo se recibe una donación ENTREGADA" })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Registrar recepción", exact: true })
            .count(),
          0,
        );
      },
    );
    await scenario(
      "inventario en dashboard y productos separados en tablas",
      async ({ page, state, login }) => {
        const stock = [
          { id, nombre: "Sede Norte", kg_en_inventario: "65.5" },
          { id: userId(1), nombre: "Sede Sur", kg_en_inventario: 60 },
        ];
        state.stock = stock;
        state.multipleProducts = true;
        await login();
        await page.getByText("125,5 kg", { exact: true }).waitFor();
        // Los kilos recuperados no se sustituyen por las existencias actuales.
        await page.getByText("120 kg", { exact: true }).waitFor();
        const inventory = page.getByRole("table", {
          name: "Inventario por almacén",
        });
        assert.equal(await inventory.getByRole("row").count(), 3);
        await inventory.getByText("65,5 kg", { exact: true }).waitFor();
        const capture = async (name) => {
          if (!process.env.TEST_SCREENSHOT_DIR) return;
          await page.locator(".page-content").evaluate(async (element) => {
            await Promise.all(
              element
                .getAnimations({ subtree: true })
                .map((a) => a.finished.catch(() => {})),
            );
          });
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              name,
            ),
            fullPage: true,
          });
        };
        await page.setViewportSize({ width: 1440, height: 1024 });
        await capture("dashboard-inventory-desktop.png");
        state.stockFailure = true;
        await page.evaluate(() =>
          window.dispatchEvent(new Event("findfood:data-changed")),
        );
        await page
          .getByRole("button", { name: "Reintentar inventario" })
          .waitFor();
        assert.equal(
          await page.getByText("Total en inventario", { exact: false }).count(),
          0,
        );
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        state.stockFailure = false;
        state.stock = [];
        await page
          .getByRole("button", { name: "Reintentar inventario" })
          .click();
        await page.getByText("No hay almacenes registrados.").first().waitFor();
        await page.locator(".inventory-total").getByText("0 kg", { exact: true }).waitFor();
        state.stock = [{ id, nombre: "Sede Norte", kg_en_inventario: null }];
        await page.evaluate(() =>
          window.dispatchEvent(new Event("findfood:data-changed")),
        );
        await page
          .getByText(
            "El servicio no devolvió un peso válido para todos los almacenes.",
          )
          .waitFor();
        state.stock = stock;
        await page
          .getByRole("button", { name: "Reintentar inventario" })
          .click();
        await page.getByText("125,5 kg", { exact: true }).waitFor();
        await page.goto(`${base}/#/donaciones`);
        await page
          .getByRole("columnheader", { name: "Código", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("columnheader", { name: "Título", exact: true })
            .count(),
          0,
        );
        await page
          .getByRole("button", { name: "Ver", exact: true })
          .first()
          .click();
        const panel = page.getByRole("dialog");
        const first = panel.getByRole("region", {
          name: "Producto 1",
          exact: true,
        });
        const second = panel.getByRole("region", {
          name: "Producto 2",
          exact: true,
        });
        await first.getByText("Manzanas", { exact: true }).waitFor();
        await second.getByText("Arroz", { exact: true }).waitFor();
        assert.equal(
          await first.getByText("Arroz", { exact: true }).count(),
          0,
        );
        assert.equal(
          await panel
            .getByRole("table", { name: "Información general" })
            .count(),
          1,
        );
        await panel.evaluate(async (element) => {
          await Promise.all(
            element.getAnimations().map((a) => a.finished.catch(() => {})),
          );
        });
        await capture("donation-detail-desktop.png");
        await first.scrollIntoViewIfNeeded();
        await capture("donation-products-desktop.png");
        await page.setViewportSize({ width: 390, height: 844 });
        await second.scrollIntoViewIfNeeded();
        assert(
          await panel
            .locator(".detail-table")
            .evaluateAll((tables) =>
              tables.every((t) => t.scrollWidth <= t.clientWidth + 1),
            ),
        );
        await capture("donation-products-narrow.png");
        await page.keyboard.press("Escape");
      },
    );
    await scenario(
      "configuración con diseño de asignación, suma, cancelación y guardado conjunto",
      async ({ page, state, login }) => {
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        await page.goto(`${base}/#/configuracion`);
        await page
          .getByRole("heading", {
            name: "Criterios del motor de asignación",
            exact: true,
          })
          .waitFor();
        assert.equal(
          await page.getByLabel("Proximidad (%)", { exact: true }).inputValue(),
          "30",
        );
        await page.getByLabel("Proximidad (%)", { exact: true }).fill("35");
        assert.equal(
          await page
            .getByRole("button", { name: "Guardar cambios", exact: true })
            .isDisabled(),
          true,
        );
        await page.getByLabel("Urgencia (%)", { exact: true }).fill("25");
        await page
          .getByRole("button", { name: "Disminuir paradas", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
        assert.equal(
          await page.getByLabel("Proximidad (%)", { exact: true }).inputValue(),
          "30",
        );
        await page.getByLabel("Proximidad (%)", { exact: true }).fill("35");
        await page.getByLabel("Urgencia (%)", { exact: true }).fill("25");
        await page
          .getByRole("button", { name: "Disminuir paradas", exact: true })
          .click();
        state.mutationFailure = true;
        await page
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "No se pudo guardar" })
          .waitFor();
        state.mutationFailure = false;
        await page
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        await page
          .getByText("Configuración guardada.", { exact: true })
          .waitFor();
        assert.equal(Number(state.parameterValues[0]), 0.35);
        assert.equal(state.parameterValues[4], "4");
        await page.reload();
        await page.getByLabel("Proximidad (%)", { exact: true }).waitFor();
        assert.equal(
          await page.getByLabel("Proximidad (%)", { exact: true }).inputValue(),
          "35",
        );
        if (process.env.TEST_SCREENSHOT_DIR) {
          await page.setViewportSize({ width: 1440, height: 1024 });
          await page.getByLabel("Proximidad (%)", { exact: true }).focus();
          await page.locator(".page-content").evaluate(async (element) => {
            await Promise.all(
              element
                .getAnimations({ subtree: true })
                .map((a) => a.finished.catch(() => {})),
            );
          });
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              "settings-mockup-desktop.png",
            ),
          });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.screenshot({
            path: require("node:path").join(
              process.env.TEST_SCREENSHOT_DIR,
              "settings-mockup-mobile.png",
            ),
            fullPage: true,
          });
        }
      },
    );
    await scenario(
      "rol asesor: usuarios restringidos y consulta de donaciones",
      async ({ page, state, login }) => {
        state.roles = ["ASESOR_BANCO"];
        await login();
        await page.getByText("Donaciones creadas", { exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole("link", { name: "Usuarios", exact: true })
            .count(),
          0,
        );
        await page.goto(`${base}/#/usuarios`);
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
        await page.locator(".table-card table").waitFor();
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




