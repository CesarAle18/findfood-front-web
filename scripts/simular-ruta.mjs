// Simula el teléfono del voluntario: recorre una ruta y emite su posición por el canal privado
// `ruta:<id>` de Supabase Realtime, como lo hará la app móvil (arquitectura §9.2). Sirve para
// probar el mapa en vivo del panel sin un teléfono. Las políticas de realtime.messages solo
// dejan emitir al voluntario asignado, con la ruta PLANIFICADA o EN_CURSO.
//
//   SIM_EMAIL=voluntario@correo SIM_PASSWORD='...' npm run simular:ruta [-- <ruta_id>]
//
// Sin <ruta_id> usa la ruta EN_CURSO más reciente del voluntario.
// Opcionales: SIM_KMH (velocidad, 30), SIM_INTERVALO_S (segundos entre envíos, 3),
// SIM_ACELERAR (multiplica la distancia por envío, 1), SIM_REPETIR=1 (vuelve a empezar).
import { createClient } from "@supabase/supabase-js";

let rutaId = process.argv[2];
const env = process.env;
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
if (rutaId && !/^[0-9a-f-]{36}$/i.test(rutaId)) fail("El id de la ruta debe ser un uuid.");
for (const name of ["VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "SIM_EMAIL", "SIM_PASSWORD"])
  if (!env[name]) fail(`Falta ${name}.`);
const kmh = Number(env.SIM_KMH || 30);
const intervalo = Number(env.SIM_INTERVALO_S || 3);
const acelerar = Number(env.SIM_ACELERAR || 1);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});
const { data: login, error: loginError } = await supabase.auth.signInWithPassword({
  email: env.SIM_EMAIL,
  password: env.SIM_PASSWORD,
});
if (loginError) fail(`No se pudo iniciar sesión como voluntario: ${loginError.message}`);

// La API solo entrega al voluntario sus propias rutas: confirma que la cuenta es la correcta.
// El token se lee en cada llamada: supabase-js lo renueva en simulaciones largas.
const api = async (path, init = {}) => {
  const { data } = await supabase.auth.getSession();
  return fetch(`${env.VITE_API_URL.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? login.session.access_token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
};
// El título del problem+json de la API, para no adivinar la causa de un error.
const problema = async (r) => {
  const body = await r.json().catch(() => null);
  return `${r.status}${body?.title ? ` (${body.title}${body.detail ? `: ${body.detail}` : ""})` : ""}`;
};
if (!rutaId) {
  const lista = await api("/rutas?estado=EN_CURSO&limite=1");
  if (lista.status === 403) fail("GET /rutas respondió 403: la cuenta no es de un voluntario.");
  if (!lista.ok) fail(`GET /rutas respondió ${await problema(lista)}. Revisa el log de la API y reintenta.`);
  rutaId = (await lista.json()).datos?.[0]?.id;
  if (!rutaId) fail("Este voluntario no tiene rutas EN_CURSO. Inicia una o indica el id de la ruta.");
}
const respuesta = await api(`/rutas/${rutaId}`);
if (respuesta.status === 404) fail(`GET /rutas/${rutaId} respondió 404: la ruta no existe o no es de este voluntario.`);
if (!respuesta.ok) fail(`GET /rutas/${rutaId} respondió ${await problema(respuesta)}. Revisa el log de la API y reintenta.`);
const ruta = await respuesta.json();
if (!["PLANIFICADA", "EN_CURSO"].includes(ruta.estado))
  fail(`La ruta está ${ruta.estado}: solo se emite con la ruta PLANIFICADA o EN_CURSO.`);
if (ruta.estado !== "EN_CURSO")
  console.warn("! La ruta está PLANIFICADA: el panel solo muestra la posición en vivo de rutas EN_CURSO.");

// Trazado de la API si existe; si no, las paradas en orden.
const geometria = ruta.geometria;
const camino =
  geometria?.type === "LineString" && geometria.coordinates?.length > 1
    ? geometria.coordinates.map(([lng, lat]) => ({ lat, lng }))
    : (ruta.paradas ?? [])
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({ lat: p.lat, lng: p.lng }));
if (camino.length < 2) fail("La ruta no tiene al menos dos puntos con coordenadas.");

const rad = (g) => (g * Math.PI) / 180;
const metros = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
};
const rumbo = (a, b) => {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
};
// Puntos cada `paso` metros a lo largo del camino, con el rumbo del tramo.
function* recorrido(paso) {
  for (let i = 0; i < camino.length - 1; i++) {
    const a = camino[i], b = camino[i + 1], largo = metros(a, b), r = rumbo(a, b);
    for (let d = 0; d < largo; d += paso) {
      const k = d / largo;
      yield { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k, rumbo: r };
    }
  }
  const fin = camino.at(-1);
  yield { ...fin, rumbo: rumbo(camino.at(-2), fin) };
}

const canal = supabase.channel(`ruta:${rutaId}`, { config: { private: true } });
await new Promise((resolve) =>
  canal.subscribe((status, err) => {
    if (status === "SUBSCRIBED") resolve();
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
      fail(`El canal ruta:${rutaId} rechazó la conexión (${status}${err ? `: ${err.message}` : ""}). ¿Están aplicadas las políticas de realtime.messages en Supabase?`);
  }),
);
console.log(`✓ ${ruta.codigo ?? rutaId} · ${camino.length} puntos · ${kmh} km/h · envío cada ${intervalo} s`);

let detener = false;
process.on("SIGINT", () => { detener = true; });
const espera = (s) => new Promise((r) => setTimeout(r, s * 1000));
// Como el rastreo de la app (tracking.ts): una muestra en ultima_ubicacion como mucho cada 60 s.
let ultimaMuestra = 0;
do {
  for (const p of recorrido((kmh / 3.6) * intervalo * acelerar)) {
    if (detener) break;
    const payload = {
      lat: Number(p.lat.toFixed(6)),
      lng: Number(p.lng.toFixed(6)),
      rumbo: Math.round(p.rumbo),
      velocidad_kmh: kmh,
      precision_m: 8,
      at: new Date().toISOString(),
    };
    const resultado = await canal.send({ type: "broadcast", event: "posicion", payload });
    console.log(`${resultado === "ok" ? "→" : `✗ ${resultado}`} ${payload.lat}, ${payload.lng} · ${payload.rumbo}°`);
    if (Date.now() - ultimaMuestra >= 60_000) {
      ultimaMuestra = Date.now();
      const muestra = await api("/voluntario/ubicacion", {
        method: "POST",
        body: JSON.stringify({ lat: payload.lat, lng: payload.lng }),
      });
      if (!muestra.ok) console.warn(`! POST /voluntario/ubicacion respondió ${muestra.status}`);
    }
    await espera(intervalo);
  }
} while (env.SIM_REPETIR === "1" && !detener);

await supabase.removeChannel(canal);
await supabase.auth.signOut({ scope: "local" });
console.log("✓ Simulación terminada.");
