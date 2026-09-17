# Find Food web

Frontend web en React, Vite y TypeScript, basado en `Mock Up Proyecto de grado.fig`. Incluye módulos operativos, formularios y paneles laterales navegables. Es una demostración visual sin backend ni autenticación real.

## Ejecutar

Usar Node.js 22.13 o posterior (Node 24 recomendado) y npm. Extraer Findfood_Web.zip, abrir la carpeta findfood-front-web y ejecutar:

```bash
npm ci
npm run dev
```

Abrir la dirección que indique Vite, normalmente http://localhost:5173. Detener con Ctrl+C. Este proyecto no utiliza Expo ni QR.

## Recorrer

Iniciar sesión abre el dashboard sin autenticar. El menú lateral conecta los módulos. La campana abre notificaciones; el avatar permite cambiar contraseña o volver al login. «Ver todas las pantallas» abre una galería con 23 destinos que cubren los 24 marcos web (dos variantes de recepción comparten pantalla).

En las tablas, «Ver» abre detalles, «Editar» abre un formulario y los botones «Nuevo» muestran el formulario correspondiente. Los filtros y búsquedas funcionan con datos de ejemplo. En Usuarios, «Voluntarios pendientes» permite revisar postulantes y abrir su detalle. Configuración permite mover ponderaciones y cambiar las paradas para revisar estados visuales. No se guarda ningún cambio.

Las acciones que necesitan servicios están deshabilitadas: crear, guardar, aprobar/rechazar, enviar instrucciones, ofertar, confirmar recepción, exportar reporte y actualizar contraseña. No se solicitan cámara, ubicación ni datos externos. Las fotografías son placeholders y los mapas esquemas sin geolocalización.

## Estructura

- src/pages: pantallas de acceso, gestión y operación.
- src/components: controles, mapas ilustrativos, notificaciones y drawer accesible mediante dialog nativo.
- src/domain: modelos de presentación.
- src/data: registros, configuración de tablas y galería.
- src/services: puerto de lectura y adaptador de demostración.
- src/state: contexto de datos y navegación por hash.
- public/brand y public/fonts: logotipo e Inter locales.
- docs/integracion-backend.md: guía y límites de preparación para backend.
- docs/pantallas.md: inventario del Figma.

## Verificar y compilar

```bash
npm run lint
npm run test:render
npm run build
npm run preview
```

Build incluye la comprobación TypeScript y genera dist. Las pruebas de renderizado comprueban pantallas, enlaces internos y registros inexistentes mediante React DOM Server, sin navegador; no prueban clics ni apariencia visual. El entorno de revisión bloquea el servidor local, por lo que queda pendiente revisar la UI en navegador. No se garantiza fidelidad píxel a píxel.

## Publicar más adelante

`dist` es una salida estática. Las rutas por hash facilitan recargar enlaces sin reglas de reescritura. Esta entrega no publica el sitio ni actualiza GitHub. No desplegar como aplicación real con usuarios hasta integrar seguridad y backend.
