# FindFood Web

Panel administrativo en React, Vite y TypeScript para ADMIN y ASESOR_BANCO. El modo predeterminado `api` usa Supabase Auth, la API de FindFood y canales privados de Realtime. El modo `demo` permite recorrer el diseño con datos de ejemplo.

La integración actual se contrastó con la rama `Generacion-de-rutas-dinamicas` de la API, commit `a518f9dfab720e2225cb48a430d1daac7b441434`.

- [Revisión de requerimientos del manual y matriz de cumplimiento](docs/revision-requerimientos-web.md).
- [Configuración, permisos y conexión](docs/conexion-web.md).
- [Inventario de pantallas del diseño](docs/pantallas.md).

## Ejecutar

Usar Node 24 o posterior y npm:

```powershell
npm ci
npm run dev
```

Crear `.env.local` a partir de `.env.example` y configurar API, Supabase y Google Maps. Las variables `VITE_` son públicas: no incluir credenciales del servidor. Reiniciar Vite al modificarlas. Ajustar CORS en la API y usar el mismo proyecto de Supabase.

## Operación del panel

Incluye usuarios internos y verificación de voluntarios, donaciones/historial/candidatos/reasignación, planificación y operación manual de flota, entrega en sede, recepción, inventario FEFO y ajustes, sedes, distribuciones, incidencias, alertas, evidencias, notificaciones, indicadores por periodo y configuración del banco/alimentos/asignación/tareas. Los permisos efectivos son los de la API; ADMIN no hereda las operaciones exclusivas de ASESOR_BANCO.

Inicio ofrece accesos a distribuciones e incidencias. Configuración incorpora Asignación, Banco y flota, Alimentos y Tareas. Reportes conserva el registro local de acciones; no es una bitácora compartida del backend. La matriz de requerimientos identifica las limitaciones pendientes.

La recuperación del panel usa un código enviado por la API y verificado en Supabase. La plantilla Reset Password debe mostrar `{{ .Token }}`. La aplicación también conserva el manejo de sesiones de recuperación recibidas por enlace.

## Estructura

- `src/integration`: servicios y pantallas conectados, sesión, Realtime y operaciones.
- `src/pages`, `src/data`, `src/services`: presentación y adaptador de demostración.
- `src/components`: controles y drawers compartidos.
- `public/brand`, `public/fonts`: identidad visual.
- `scripts/check-integration.cjs`: pruebas de navegador con servicios simulados.

## Validar y compilar

```powershell
npm run lint
npm run test:render
npm run build
npm run test:integration
```

Las pruebas de integración inician Vite en 5178 e interceptan API, Auth, Storage, Maps y WebSocket. Requieren Chromium de Playwright (`npx playwright install chromium`) o `TEST_CHROMIUM_PATH` apuntando a Edge/Chrome. No usan cuentas reales ni modifican `.env.local`. `TEST_SCENARIO` permite seleccionar un escenario por su nombre.

Build genera `dist`. Las pruebas simuladas no certifican las políticas de Supabase, el despliegue, la facturación, el SMTP ni las reglas transaccionales de una base real. La lista de verificaciones del entorno está en la revisión de requerimientos.
