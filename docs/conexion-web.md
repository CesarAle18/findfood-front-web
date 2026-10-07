# Primera conexión del frontend web

Esta entrega utiliza las fuentes web adjuntas y los contratos de la API del ZIP revisado. La API y la base de datos no fueron modificadas.

## Alcance

Conectados:
- Inicio de sesión con correo/contraseña mediante Supabase Auth.
- Sesión: restauración, renovación automática del token, Recordarme y cierre de sesión local.
- Perfil y autorización mediante GET /v1/me. El panel exige ADMIN o ASESOR_BANCO y estado ACTIVO.
- Primer ingreso: debe_cambiar_password obliga a cambiar la contraseña, sin sidebar ni acceso a otros módulos. Cancelar cierra la sesión.
- Recuperación: enviar correo, abrir el enlace real de Supabase y restablecer sin pedir la contraseña actual. Al completar se cierra la sesión y vuelve al login.
- Cambio desde la cuenta: verifica la contraseña actual con una sesión independiente de Supabase, actualiza la contraseña y vuelve a Inicio.
- Mi perfil: consultar y actualizar nombres, apellidos y teléfono mediante GET/PATCH /v1/me.
- Inicio: GET /v1/kpis/resumen, indicadores y resumen por almacén. El periodo por defecto lo define la API (30 días).
- Usuarios: GET /v1/admin/usuarios con filtros/paginación; POST /v1/admin/usuarios para cuentas internas; PATCH /v1/admin/usuarios/:id/estado para Activo ↔ Inactivo (ruta añadida en esta entrega). Solo ADMIN.
- Errores RFC 9457, validaciones, carga, listado vacío, reintentos y timeout de 20 segundos.

Las pantallas administrativas cargan las consultas de la tabla al final de esta guía. El modo demo conserva los ejemplos. Las operaciones de escritura fuera de creación de cuentas internas, perfil propio y cambio de estado quedan pendientes.

## Configuración local (Windows / PowerShell)

1. En la carpeta del frontend:

```powershell
npm install
Copy-Item .env.example .env.local
```

2. Completa `.env.local`:

```dotenv
VITE_DATA_MODE=api
VITE_API_URL=http://localhost:3002/v1
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Ajusta 3002 al puerto real de NestJS. VITE_API_URL debe incluir /v1 una sola vez. La clave debe ser publishable (`sb_publishable_...`) o anon heredada, del mismo proyecto que utiliza la API. Nunca uses service_role, sb_secret, SUPABASE_JWT_SECRET o DATABASE_URL en el frontend: todas las variables VITE son públicas.

3. En el `.env` de la API agrega el origen exacto del frontend:

```dotenv
CORS_ORIGENES=http://localhost:5173
```

Si también utilizas 127.0.0.1:

```dotenv
CORS_ORIGENES=http://localhost:5173,http://127.0.0.1:5173
```

Reinicia NestJS. CORS compara protocolo, dominio y puerto. Postman puede funcionar aunque el navegador sea bloqueado por CORS.

4. En Supabase, Authentication → URL Configuration:
- Site URL: `http://localhost:5173` para esta prueba local.
- Redirect URLs: agrega `http://localhost:5173/?flow=recovery`.
- Si pruebas con 127.0.0.1, agrega también `http://127.0.0.1:5173/?flow=recovery`.

La recuperación usa el flujo implicit del SDK: Supabase agrega los tokens en el fragmento, el SDK consume el enlace y emite PASSWORD_RECOVERY. La aplicación entonces abre #/restablecer-contrasena. No hay que escribir ni copiar tokens manualmente. Una ruta abierta sin enlace de recuperación muestra un aviso y no habilita el formulario.

5. Comprueba que la API responda en `http://localhost:3002/health` y ejecuta:

```powershell
npm run dev -- --port 5173 --strictPort
```

Abre http://localhost:5173. Si cambias `.env.local`, reinicia Vite. Si falta la configuración, se muestra un aviso; no se habilita un login falso.

Para recorrer únicamente el diseño:

```dotenv
VITE_DATA_MODE=demo
```

## Recorrido de prueba con servicios reales

1. Entra con una cuenta ADMIN existente en tu proyecto Supabase y con rol activo en la API. Comprueba que aparece el nombre/iniciales de esa cuenta y los indicadores reales.
2. Abre Usuarios. Busca un correo conocido, filtra por rol/estado y avanza de página si hay más de 20 registros. Un filtro sin coincidencias debe mostrar una lista vacía.
3. Abre Mi perfil desde el menú junto a la campana. Guarda un teléfono válido y revisa la persistencia al recargar.
4. Cambia la contraseña desde el menú de cuenta. Primero prueba una contraseña actual incorrecta y una confirmación que no coincida; ninguna debe actualizarla.
5. Cierra sesión; una URL protegida debe volver al login. Prueba Recordarme desmarcado y marcado: desmarcado conserva la sesión en sessionStorage (por pestaña); marcado utiliza localStorage. La contraseña nunca se guarda.
6. Prueba una cuenta ASESOR_BANCO: puede consultar Inicio, pero Usuarios debe indicar que requiere ADMIN.
7. Para el primer ingreso usa un asesor creado por la API y su contraseña temporal. /me devuelve debe_cambiar_password=true. Tras el cambio se consulta nuevamente /me; no se omite la restricción desde el cliente.
8. En recuperación envía un correo, abre el enlace recibido y define una contraseña nueva. Debe regresar al login. El envío depende de la configuración de correo y límites de Supabase.

La migración `20260922000000_esquema_inicial.sql` contiene `fn_usuario_password_cambiada` y el disparador de auth.users que desmarca debe_cambiar_password. El TXT proporcionado describe tablas, pero no incluye los disparadores. Confirma que la migración esté aplicada si el cambio sigue siendo obligatorio después de guardar la contraseña.

## Organización para próximas integraciones

- `src/integration/config.ts`: modo y configuración pública.
- `src/integration/supabase.ts`: cliente de autenticación y almacenamiento de sesión.
- `src/integration/http.ts`: cliente HTTP con Bearer, abort/timeout y errores.
- `src/integration/contracts.ts`: DTOs tipados; no reutiliza Entity de demostración.
- `src/integration/services.ts`: perfil, usuarios e indicadores.
- `SessionProvider.tsx` y `AuthBoundary.tsx`: sesión, perfil y control de acceso.
- `AuthLive`, `PasswordLive`, `ProfileLive`, `UsersLive`, `DashboardLive`: pantallas conectadas.

Para el siguiente módulo, añade su contrato y servicio, y sustituye su pantalla de demostración al conectarlo. La API es la autoridad para permisos y estados.

## Verificación automatizada

```powershell
npm run build
npm run lint
npm run test:render
```

Las pruebas de render comprueban el modo demo y sus enlaces; no verifican la apariencia.

Las pruebas de integración usan Playwright con respuestas simuladas: no tocan usuarios ni datos reales.

```powershell
npx playwright install chromium
npm run test:integration
```

El script inicia Vite automáticamente en el puerto 5178 con variables de prueba e intercepta los servicios en 4300/4301; no necesitas servidores en esos puertos y tu .env.local no se modifica. Cierra cualquier Vite que ocupe 5178 antes de ejecutarlo. TEST_WEB_URL permite usar un Vite externo configurado para esos mismos servicios simulados.

## Límites de la entrega

No se probó contra una API real porque no se proporcionaron su URL operativa, la URL de Supabase ni la clave pública. La conexión queda configurable, lista para esa prueba. Las respuestas simuladas verifican navegación, peticiones, errores y sesión; no prueban las migraciones ni la configuración de tu proyecto Supabase.


## Formularios laterales de usuarios

- **Ver** abre el detalle en un drawer, con opción **Editar información**.
- **Nuevo usuario** aparece solo para ADMIN. El drawer usa POST /v1/admin/usuarios. Permite elegir ADMIN o ASESOR_BANCO; donantes y voluntarios se registran desde la app.
- Si el servidor no envía correo, se muestra la contraseña temporal una sola vez dentro del drawer. No se guarda en el navegador.
- Al editar la cuenta propia se guardan nombres, apellidos y teléfono mediante PATCH /v1/me.
- El formulario de otro usuario permite guardar el estado ACTIVO/INACTIVO. Los datos de contacto, correo y rol son de consulta: la API no ofrece edición general del perfil ajeno. Las cuentas suspendidas o pendientes no se modifican con esta ruta.
- Se quitó Ver todas las pantallas del sidebar; la ruta de la galería de demostración sigue disponible por URL.


## Instalación de esta actualización

1. Actualiza el frontend conservando tu `.env.local`.
2. Actualiza la API con el ZIP incluido, conservando tu `.env`. No hace falta modificar el esquema de base de datos: ACTIVO e INACTIVO ya existen.
3. En la API ejecuta `npm ci`, `npm run build` y `npm run start:dev`. Reinicia cualquier instancia anterior que esté usando el mismo puerto.
4. En el frontend ejecuta `npm ci` y `npm run dev`. La URL configurada en VITE_API_URL debe terminar en /v1 y coincidir con el puerto real de tu API.

La ruta nueva es PATCH /v1/admin/usuarios/:id/estado, con Authorization Bearer de ADMIN y cuerpo `{"estado":"INACTIVO"}` o `{"estado":"ACTIVO"}`. Si obtienes Cannot PATCH, revisa que estés ejecutando la API actualizada. El endpoint bloquea la inactivación propia, las cuentas eliminadas y los estados suspendido/pendiente. Al activar exige teléfono y correo confirmado. El AuthGuard existente bloquea las cuentas inactivas en cada petición.

## Consultas conectadas en modo API

| Pantalla | GET utilizado |
| --- | --- |
| Inicio y reportes | /v1/kpis/resumen |
| Donaciones y detalle | /v1/donaciones y /v1/donaciones/:id |
| Asignaciones, desde Asignar | /v1/donaciones/:id y /v1/donaciones/:id/candidatos |
| Rutas y detalle | /v1/rutas y /v1/rutas/:id |
| Recepciones y detalle | /v1/recepciones y /v1/recepciones/:id |
| Preparación de recepción | /v1/donaciones/:id |
| Inventario y detalle | /v1/inventario/lotes y /v1/inventario/lotes/:id |
| Almacenes | /v1/almacenes (el detalle usa los campos de la lista: no hay GET /almacenes/:id) |
| Lista de voluntarios | /v1/admin/usuarios?rol=VOLUNTARIO |
| Pendientes y detalle | /v1/admin/verificaciones?estado=PENDIENTE y /v1/admin/verificaciones/:id |
| Configuración | /v1/admin/banco, /v1/admin/parametros y /v1/catalogos, según la pestaña |
| Notificaciones y contador | /v1/me/notificaciones |
| Perfil | /v1/me |

Las listas paginadas usan limite=20 y desplazamiento. La búsqueda de los módulos nuevos filtra la página visible; Usuarios conserva la búsqueda en el servidor. Las tablas muestran carga, error, reintento y ausencia de registros. No reemplazan errores por datos simulados.

Limitaciones: la lista de voluntarios solo incluye la información de cuenta disponible en /admin/usuarios. No existe una lista administrativa de asignaciones ni un GET de auditoría; se muestran candidatos de la donación e indicadores, respectivamente. No se agregaron endpoints de consulta inventados. Las pruebas web usan servicios simulados; las pruebas de la API usan persistencia/identidad simuladas. La conexión real requiere ejecutar ambos proyectos con tu configuración.
