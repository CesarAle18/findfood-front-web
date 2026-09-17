# Integración futura del backend

El frontend no solicita servicios remotos. `WebRepository` en `src/services/web-repository.ts` define un puerto asíncrono de lectura `load(signal?)` que devuelve `WebData`. `App` permite inyectar otro repositorio. El adaptador de demostración devuelve `src/data/demo.ts`.

Las tablas, perfiles y notificaciones leen `DataContext`. Algunos valores visuales del dashboard, mapas, asignación y recepción permanecen en sus pantallas; la separación es inicial y no basta con sustituir el repositorio para conectar toda la aplicación.

`src/domain/models.ts` contiene modelos de presentación; no son el contrato HTTP definitivo. Para integrar se deben acordar DTO, roles, estados, unidades, fechas, paginación y errores; reemplazar fixtures y extraer los restantes; añadir métodos de escritura y formularios controlados, validación, carga, confirmación y manejo de errores. No se han inventado endpoints ni tokens.

El rol Administrador es ilustrativo. Login solo navega. Las rutas por hash no tienen protección y el navegador no almacena sesión ni credenciales. El proveedor contempla carga, error, reintento y cancelación para el futuro adaptador; el ejemplo local no acredita conectividad real.

Google Maps, ubicación y evidencias requieren implementación y permisos futuros. Los mapas actuales son esquemas; los documentos y fotografías son placeholders. Configuración cambia sliders y cantidad de paradas en memoria, no configura ningún motor. Filtros operan sobre muestras locales y se reinician al cambiar de módulo. Los formularios no guardan: crear, editar, aprobar, rechazar y exportar permanecen deshabilitados.

La navegación desde Nueva recepción conduce a una recepción de ejemplo seleccionada, sin crear registros. Los detalles de productos en recepción son ilustrativos. Antes de producción se requieren pruebas de integración, autorización y revisión visual/accesible en navegadores reales.
