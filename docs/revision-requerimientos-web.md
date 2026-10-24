# Revisión de requerimientos del aplicativo web

Fecha: 23 de octubre de 2026 (America/Bogota).

## Fuentes y criterio de evaluación

- Manual: `FindFood Manual Tecnico.pdf`, 63 páginas. Requerimientos funcionales: páginas impresas 7–13; no funcionales: 14–15; alcance del panel: sección 21.3, página impresa 59. La tabla de contenido y la numeración de esa sección no coinciden; se tomó el contenido real de las páginas.
- API: rama `Generacion-de-rutas-dinamicas`, commit `a518f9dfab720e2225cb48a430d1daac7b441434`, de https://github.com/CesarAle18/findfood-api/tree/Generacion-de-rutas-dinamicas.
- Frontend: fuentes de este workspace, especialmente `src/integration` y sus pruebas de navegador.
- Se contrastaron controladores, DTO, servicios, permisos y migraciones. La leyenda «Implementado» del manual no se tomó como prueba de implementación en este frontend.
- Alcance: panel ADMIN / ASESOR_BANCO. No se trasladaron a la web las funciones exclusivas de DONANTE / VOLUNTARIO ni se ampliaron permisos en el backend.

«Integrado» indica que existe una interfaz conectada al contrato inspeccionado. No certifica el despliegue, sus credenciales, políticas, datos reales, rendimiento ni el comportamiento transaccional de la base.

## Faltantes encontrados e implementación realizada

| Requerimiento | Situación encontrada | Cambio realizado | Integración |
| --- | --- | --- | --- |
| RF-03 y RF-04: acceso del personal | Login en Supabase y control visual de roles; no se utilizaba la validación específica del panel | El perfil de sesión se valida con el endpoint del panel. Si rechaza el acceso por rol, se cierra la sesión local y se presenta el motivo | GET `/panel/sesion` |
| Recuperación del panel | El cliente enviaba la solicitud directamente a Supabase | Solicitud pública a la API del panel, respuesta genérica y formulario para verificar el código antes de establecer la nueva contraseña | POST `/panel/recuperar-contrasena` + Supabase `verifyOtp(type: recovery)` |
| RF-24: planificar flota del banco | Rutas solo consultables | Selección de donaciones PUBLICADA / EXPIRADA, planificación, inicio y cancelación según rol y estado | POST `/rutas`, `/rutas/:id/iniciar`, `/rutas/:id/cancelar` |
| RF-25/26/27: operación y entrega en sede | No había controles operativos de paradas | Llegada, confirmación manual explícita, peso real para recogidas y parada fallida para recogidas de flota. El asesor puede confirmar una entrega en sede de una ruta de voluntario | POST `/paradas/:id/llegada`, `/confirmar`, `/fallida` |
| RF-29: seguimiento en vivo | Mapa con ruta/paradas, sin posición ni ETA dinámica | Suscripción privada de la ruta, marcador del vehículo en memoria y consulta del trayecto/ETA hasta la siguiente parada | Canal privado `ruta:<id>` + GET `/rutas/:id/seguimiento` |
| RF-30: adjuntar evidencias | Evidencias de solo lectura | Subida directa del binario a Storage; registro de metadatos en la API; reintento del registro con el mismo UUID y sin repetir una subida exitosa | POST `/evidencias/upload-url`, PUT de la foto a la URL firmada, POST `/evidencias` |
| RF-33: inventario por sede y tipo | Búsqueda textual y régimen; faltaban filtros explícitos | Filtros de sede y tipo enviados a la API, paginación completa del resultado, enriquecimiento del régimen con el catálogo | GET `/inventario/lotes?almacen_id=&tipo_alimento_id=` + `/almacenes` y `/catalogos` |
| RF-36: indicadores del periodo | Resumen parcial con periodo fijo | Fechas seleccionables en horario de Colombia, estados de donaciones, tasa de expiración, ofertas por donación, merma, kilos distribuidos y recepción por sede | GET `/kpis/resumen?desde=&hasta=` |
| RF-38: bandeja en vivo | Observación periódica de algunos cambios; la lista no escuchaba el canal del banco | Suscripción privada al evento de donaciones, invalidación agrupada de consultas, refresco tras suscripción/reconexión y consulta periódica como respaldo | Canal `banco:donaciones`, evento `donacion_estado` + consultas a la API |
| RF-41: tareas programadas | Endpoint existente, sin pantalla | Sección Tareas: últimas ejecuciones y éxitos, resultado, error y ciclos omitidos, con actualización manual y periódica | GET `/admin/tareas` |
| Sección 21.3: banco y flota | Había definición de formulario pero no acceso desde Configuración | Sección Banco y flota para consultar y guardar los datos del banco y su indicador de flota propia | GET/PUT `/admin/banco` |
| Sección 21.3: catálogo de alimentos | Había definición de formulario pero no pantalla operativa | Sección Alimentos con listado activo, alta y edición, incluyendo vida útil y desactivación | GET `/catalogos?incluir=tipos_alimento`, POST/PATCH `/admin/tipos-alimento` |
| Acceso a distribuciones e incidencias | Tras quitar los botones de Inventario no quedaba un acceso visible en la navegación normal | Accesos en Inicio, en Operación del banco. Inventario conserva los cambios solicitados anteriormente | `#/distribuciones`, `#/incidencias` |

En rutas, el ADMIN no recibe permisos de creación, inicio o confirmación exclusivos de ASESOR_BANCO. La API mantiene la validación de ventanas, capacidad, flota, estados, orden de recogidas/entrega y evidencia obligatoria. La web no sustituye el optimizador ni calcula una asignación alternativa.

La confirmación del panel es presencial/manual y se envía con `confirmacion_manual: true`, con aceptación explícita del asesor y hora del dispositivo; no se inventa una posición GPS. La operación con GPS y la cola offline del voluntario pertenecen al móvil.

## Matriz completa de requerimientos funcionales

| ID | Función | Evaluación del panel después de los cambios |
| --- | --- | --- |
| RF-01 | Registro móvil y OTP | Fuera de alcance web; móvil + API |
| RF-02 | Registro Google y teléfono | Fuera de alcance del panel; no se permite autorregistro de ADMIN/ASESOR |
| RF-03 | Login de personal y cambio temporal | Integrado; se conserva el cambio obligatorio existente y se agrega la validación de sesión del panel |
| RF-04 | Identidad, estado y rol por petición | Bearer en solicitudes, control de acceso del panel y manejo de errores; comprobación autoritativa en guards de la API |
| RF-05 | Crear ADMIN / ASESOR_BANCO | Ya integrado en Usuarios |
| RF-06 | Listar, suspender y reactivar cuentas | Ya integrado en Usuarios |
| RF-07 | Solicitar voluntariado con documentos | Solicitud en móvil; revisión administrativa en RF-08 |
| RF-08 | Revisar, aprobar o rechazar voluntarios | Ya integrado en Pendientes y documentos firmados |
| RF-09 | Franjas y disponibilidad del voluntario | Fuera de alcance web; móvil + API |
| RF-10 | Alta/baja de dispositivo push | Fuera de alcance web; Expo/móvil |
| RF-11 | Crear/editar borrador del donante | Fuera de alcance del panel según permisos de API |
| RF-12 | Publicar donación y escoger sede | Publicación en móvil; selección y cálculo en API |
| RF-13 | Cancelar donación con motivo | Ya integrado para ADMIN |
| RF-14 | Trazabilidad de donación | Ya integrado en detalle con GET `/donaciones/:id/historial`; no se sustituye por auditoría local |
| RF-15 | Listar y consultar donaciones del banco | Ya integrado; se agrega refresco por broadcast |
| RF-16 | Filtrar voluntarios factibles | Motor de API; consulta de candidatos en Asignaciones |
| RF-17 | Puntaje multicriterio | Motor de API; el front muestra el ranking y puntaje que recibe |
| RF-18 | Ofertas secuenciales con vencimiento | Motor/tareas de API; no debe reimplementarse en el panel |
| RF-19 | Aceptar/rechazar/abandonar oferta | Exclusivo del voluntario en móvil |
| RF-20 | Reabrir/expirar tras abandono | Motor de API |
| RF-21 | Reasignar y explicar selección | Reasignación y consulta de candidatos ya integradas. La API devuelve puntaje total, pero no el desglose por criterio; explicación completa sigue parcial |
| RF-22 | Calificación mutua | Exclusivo del donante/voluntario en móvil |
| RF-23 | Agrupar recogidas del voluntario | Móvil + optimizador de API |
| RF-24 | Planificar rutas de flota | Faltaba en web; integrado en este cambio |
| RF-25 | Iniciar y ejecutar recogidas | Voluntario en móvil; agregado equivalente manual del asesor para flota |
| RF-26 | Confirmar entrega en sede | Faltaba en web; integrado para ASESOR_BANCO |
| RF-27 | Parada fallida y cancelación | Agregado para recogidas de flota y cancelación de rutas planificadas, con roles correspondientes |
| RF-28 | Trabajo offline e idempotencia | Cola de ruta exclusiva del móvil. En web, el reintento de registro de evidencia conserva su UUID; no se afirma soporte offline general |
| RF-29 | Posición en vivo | Faltaba en web; integrado con canal privado, ubicación efímera y seguimiento API |
| RF-30 | Subida directa de fotografías | Faltaba en web; integrado para registros accesibles al personal |
| RF-31 | Recepción total/parcial/rechazo | Ya integrado en Recepción; la API crea los lotes y movimientos |
| RF-32 | Distribución FEFO con reserva/confirmación/anulación | Ya integrado; se recupera acceso visible desde Inicio |
| RF-33 | Consulta por sede/tipo, libro mayor y ajustes | Detalle/movimientos/ajustes existentes; agregados filtros explícitos |
| RF-34 | Alertas y atención | Consulta y atención existentes; generación y umbrales corresponden al backend |
| RF-35 | Crear/activar/desactivar sedes | Ya integrado en Almacenes según rol |
| RF-36 | KPI por periodo | Parcial antes; ampliado y con rango de fechas en Inicio |
| RF-37 | Avisos relevantes y bandeja | Bandeja y lectura ya integradas; Expo Push corresponde al móvil y al outbox de la API |
| RF-38 | Bandeja de donaciones sin recargar | Faltaba suscripción al canal requerido; integrada |
| RF-39 | Pesos y máximo de paradas | Ya integrado mediante PUT atómico de cinco parámetros; se conserva |
| RF-41 | Estado de tareas | Faltaba en web; integrado en Configuración → Tareas |
| RF-42 | Borrar no confirmados y purgar rankings | Tareas de backend; consulta de sus ejecuciones desde Tareas cuando han corrido |

El documento no contiene RF-40. Tampoco contiene RNF-14 ni RNF-15 en la tabla de no funcionales; no se inventaron requerimientos para esos números.

## Pendientes que no resuelve el frontend por sí solo

1. **Explicación del puntaje (RF-21).** El endpoint de candidatos expone ranking y puntaje total, pero no sus componentes. Una explicación detallada de proximidad, urgencia, confiabilidad y holgura necesita ampliar el DTO/consulta del backend. El panel conserva su aviso actual y no calcula valores ficticios.
2. **Auditoría central del mockup.** No hay GET de auditoría en esta rama. La pantalla actual registra acciones locales por cuenta/navegador; no ofrece el historial de todos los usuarios, IP ni valores antes/después. El manual exige historial de donación (RF-14/RNF-05), que sí tiene endpoint; una bitácora administrativa central adicional necesita contrato de API, filtros, permisos y paginación. No se consultó la tabla `auditoria` directamente.
3. **Catálogo inactivo y umbrales.** El catálogo público devuelve solo tipos activos y no existe un listado administrativo de inactivos en la rama inspeccionada. La edición permite desactivar, pero recuperar/listar inactivos requiere ampliar el backend. Los umbrales de `banco_tipo_alimento` citados en RF-34 tampoco tienen CRUD administrativo expuesto; no se inventó un formulario que simule guardarlos.
4. **Integración real de servicios.** Verificar la API desplegada con esta rama, SMTP/plantilla de recuperación, Storage y políticas Realtime del mismo proyecto de Supabase. Estas comprobaciones no se sustituyen con servicios simulados.

## Requerimientos no funcionales: evidencia y límites

| ID | Evaluación |
| --- | --- |
| RNF-01 | P95 de candidatos y carga ≥100 solicitudes: requiere benchmark del backend con datos del piloto; no certificado por esta revisión |
| RNF-02 | Factibilidad y ausencia de violaciones de filtros: reglas de API/SQL; requiere pruebas de negocio y datos reales |
| RNF-03 | Distancia respecto al óptimo: función/benchmark del planificador en API; el front usa el recorrido recibido |
| RNF-04 | FEFO del despacho: responsabilidad del backend y sus transacciones; ordenar la tabla no demuestra corrección del despacho |
| RNF-05 | Historial de donación integrado; el ciclo completo requiere prueba e2e real hasta recepción |
| RNF-06 | Roles de controles y solicitudes revisados; pruebas simuladas para acceso denegado, ADMIN y ASESOR; guards siguen siendo autoritativos |
| RNF-07 | El panel usa la API para datos y broadcast privado para Realtime; no usa SELECT/INSERT directo sobre tablas de Supabase |
| RNF-08 | No se añadieron secretos ni se cambiaron credenciales; claves del servidor siguen fuera de VITE. Esto no es una auditoría del despliegue ni de su historial Git |
| RNF-09 | Posición en vivo solo en memoria, sin almacenar muestras en localStorage; no se certifica cumplimiento legal integral |
| RNF-10 | Fallback de cálculo y continuidad de tareas son del backend/despliegue; el front conserva refresco periódico si Realtime falla |
| RNF-11 | Exclusión y consistencia transaccional deben probarse en API/BD; deshabilitar controles en web no las garantiza |
| RNF-12 | Idempotencia offline del móvil fuera de este proyecto; reintento de metadatos de evidencia en web con UUID estable probado |
| RNF-13 | Nuevos rangos y fechas civiles tratados en Colombia; navegador de escritorio probado con Edge/Chromium. Android/móvil no evaluado |
| RNF-16 | Seguimiento consulta el endpoint cacheado; no llama a Routes/Matrix desde el navegador. Se reutiliza la instancia del mapa al actualizar la posición. Facturación real no evaluada |

## Validación realizada

- Compilación TypeScript/Vite y ESLint.
- Pruebas de navegador con API, Auth, Storage, Google Maps y WebSocket Realtime simulados.
- Casos añadidos: filtro por sede/tipo; rango de fechas Colombia con límite superior exclusivo; configuración banco/alimento/tareas; rechazo de acceso y cierre de sesión; OTP inválido y válido; planificación/inicio de flota; subida de imagen y reintento de registro con UUID estable; confirmación manual de entrega; evento privado que actualiza donaciones; evento de posición que dispara consulta de seguimiento sin persistir coordenadas.
- Regresión de los flujos administrativos previos y de inventario/auditoría local. La suite se actualiza para la pantalla actual de Reportes y Google Maps.

Comando de los casos específicos (usa Edge instalado si Playwright no tiene Chromium descargado):

```powershell
$env:TEST_SCENARIO = 'manual RF'
$env:TEST_CHROMIUM_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/check-integration.cjs
```

Para la suite completa, quitar `TEST_SCENARIO`. No se usaron cuentas reales, no se subieron archivos a tu Storage y no se ejecutaron operaciones sobre la base real.

## Verificación de despliegue pendiente

1. Confirmar que la API en `VITE_API_URL` corresponde al commit revisado o a uno compatible; el inicio de sesión admite /me como compatibilidad únicamente si /panel/sesion devuelve 404. Se mantienen los controles de rol y los errores 401/403; los demás servicios requieren contratos compatibles.
2. En Supabase, la plantilla Reset Password de esta rama debe incluir el código `{{ .Token }}`. La rama envía códigos, aunque la sección 21.3 del manual describe un flujo anterior con token_hash.
3. Verificar las políticas de los canales privados `banco:donaciones` y `ruta:<id>` y que el móvil emita coordenadas `lat`/`lng` (directas o dentro de `ubicacion`). El panel consume broadcasts; no crea publicaciones GPS ficticias.
4. Probar con asesor una donación real elegible, banco con flota y sede: planificar → iniciar → adjuntar evidencia → confirmar recogidas → adjuntar evidencia de entrega → confirmar sede → registrar recepción.
5. Como ADMIN, verificar Tareas tras sus ejecuciones. Una respuesta vacía no prueba que el reloj esté activo; la información se reinicia con el proceso de API.
6. Probar la privacidad/roles y medir los RNF de rendimiento, concurrencia, optimización y retención en el entorno de prueba del backend.

Resultado de la revisión local: 26 escenarios completos de integración aprobados; renderizado de 23 rutas de galería y 5 rutas adicionales aprobado; prueba de actividad aprobada. Las pruebas usan servicios simulados, no la API desplegada.

Compatibilidad de sesión: se comprobó que la API local devuelve 404 en /panel/sesion y sí expone /me. El front recurre a /me solo para ese 404, valida roles de personal también en esa respuesta y conserva el rechazo/cierre de sesión de las cuentas ajenas al panel. Pruebas específicas de compatibilidad y rechazo 403 aprobadas.


Cambio de alcance solicitado posteriormente: Distribuciones e Incidencias se retiran del panel web, incluidos accesos de Inicio, rutas de navegación y registro de paradas fallidas que creaba incidencias. No deben reincorporarse a partir de la cobertura histórica del manual. Los servicios de backend se conservan; no se eliminan datos.

Correcciones de acceso y recepción: el asesor es redirigido a Inicio antes de montar Usuarios, Voluntarios, Pendientes o Configuración. Recepción separa las decisiones ya registradas de las donaciones ENTREGADA pendientes de revisión; estas últimas permiten aceptar, aceptar parcialmente o rechazar con el contrato POST /recepciones existente. Una decisión final no se presenta como pendiente de segunda aprobación. Configuración muestra el banco único con sus sedes, y el indicador Usuarios únicos explica que cuenta cuentas distintas en los resultados filtrados.

Recepciones por ruta finalizada: el asesor dispone de Crear recepción, elige una ruta COMPLETADA y selecciona donaciones de sus recogidas completadas que siguen ENTREGADA. Cada donación conserva su decisión independiente (ACEPTADA, ACEPTADA_PARCIAL o RECHAZADA), motivo y productos aceptados mediante POST /recepciones. No se inventa una operación masiva atómica. Las ya recibidas, rechazadas o no entregadas quedan bloqueadas; el formulario conserva los éxitos si otra donación falla. Se probó selección múltiple, los tres resultados, reintento sin repetir donaciones exitosas y restricción de rol/estado con servicios simulados.

### Evidencias en la web (23/10/2026)
Por decisión de alcance, la web solo consulta evidencias existentes y renueva enlaces de lectura. Se elimina el cargue en todos los formularios, incluidas las paradas de rutas. La API conserva sus validaciones de confirmación. Esta decisión sustituye las referencias anteriores a subir evidencias desde el panel.
