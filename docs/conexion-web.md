# Integración de FindFood web con la API

> Actualización del 23/10/2026: la integración vigente usa Generacion-de-rutas-dinamicas (a518f9d). Consultar [la matriz de requerimientos](revision-requerimientos-web.md) para el alcance actual, nuevos endpoints y límites; los apartados históricos siguientes describen etapas previas.

Fuentes: rama Conexion_Back del frontend (base 6a339dc) y Conexion_Front de la API (base 20b9a90), obtenidas de los repositorios compartidos. La API incorpora PUT /v1/admin/parametros para guardar la configuración completa en una transacción. Debe actualizarse junto con el frontend. Las capturas de Swagger se contrastaron con los controladores, permisos, DTO y servicios de esa rama.

## Arranque local

Conserva tu configuración de entorno y usa Node 24 o superior, requerido por la API.

En la API, ejecuta `npm ci`, `npm run build` y `npm run start:dev`. Debe tener acceso a la base de datos y a su proyecto de Supabase. Comprueba GET http://localhost:3002/health, ajustando el puerto.

En el frontend, ejecuta `npm ci`, copia .env.example a .env.local si aún no existe y completa:

```dotenv
VITE_DATA_MODE=api
VITE_API_URL=http://localhost:3002/v1
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Usa la clave pública publishable o anon del mismo proyecto de Supabase que usa la API. Nunca uses service_role, sb_secret ni secretos de la base de datos en VITE: esas variables son públicas. Reinicia Vite tras modificar la configuración.

En el .env de la API configura `CORS_ORIGENES=http://localhost:5173` (o el origen exacto que muestra tu navegador). Reinicia NestJS. Luego ejecuta `npm run dev -- --port 5173 --strictPort` en el frontend.

La rama actual solicita la recuperación mediante POST /panel/recuperar-contrasena y verifica el código con Supabase. La plantilla Reset Password debe mostrar {{ .Token }}. Para compatibilidad con sesiones de recuperación por enlace, configurar también Site URL y Redirect URL del entorno. El modo demo conserva el cascarón y se activa con VITE_DATA_MODE=demo.

## Cobertura del panel

Las rutas de la tabla llevan /v1 salvo /health.

| Pantalla | Consultas y acciones integradas | Permisos de escritura |
| --- | --- | --- |
| Identidad | Supabase Auth; GET /panel/sesion; PATCH /me; POST /panel/recuperar-contrasena; recuperación, primer ingreso y cambio de contraseña | Cuenta propia |
| Inicio/reportes | GET /kpis/resumen y GET /almacenes para total actual de existencias y desglose por almacén | Consulta |
| Configuración | GET /admin/parametros y PUT /admin/parametros para Asignación | ADMIN |
| Usuarios | GET/POST /admin/usuarios; PATCH /admin/usuarios/:id/estado; POST suspender/reactivar | ADMIN |
| Voluntarios | GET /admin/usuarios?rol=VOLUNTARIO | Consulta de cuentas |
| Pendientes | GET /admin/verificaciones y detalle; POST aprobar/rechazar | ADMIN |
| Donaciones | Lista, detalle, historial y candidatos; POST cancelar y reasignar | Cancelar: ADMIN; reasignar: ADMIN/ASESOR_BANCO |
| Asignaciones | Donación y candidatos; reasignación automática | ADMIN/ASESOR_BANCO |
| Almacenes | GET/POST /almacenes; PATCH /almacenes/:id | Crear: ADMIN; editar: ADMIN/ASESOR_BANCO |
| Recepción | Donación/productos y POST /recepciones, incluida aceptación parcial y rechazo | ASESOR_BANCO |
| Recepciones | GET /recepciones y detalle | Consulta |
| Inventario | GET lotes y detalle; POST /inventario/lotes/:id/ajuste | ASESOR_BANCO |
| Distribuciones | GET lista/detalle; POST crear/confirmar/anular | ASESOR_BANCO |
| Alertas | GET /alertas; POST /alertas/:id/atender | ASESOR_BANCO |
| Incidencias | GET lista/detalle; POST crear/revisar/resolver | Crear/revisar: personal; resolver: ADMIN |
| Rutas | GET lista/detalle/seguimiento; POST crear/iniciar/cancelar | Creación e inicio: ASESOR_BANCO para flota; cancelación según contrato |
| Paradas | Llegada, confirmación manual y recogida fallida dentro del detalle | ASESOR_BANCO: flota y entrega en sede según contrato |
| Evidencias | Consulta, URL firmada de subida, binario directo a Storage y registro en API | Personal autorizado por la API |
| Notificaciones | GET y contador; POST leer una/leer todas | Cuenta propia |

Distribuciones e incidencias se abren desde Inicio → Operación del banco. Alertas conserva su acceso desde Inventario. Las acciones de registros se abren desde Ver, en formularios laterales. Nuevo almacén usa el mismo patrón. Los detalles se presentan en tablas de campo y valor; las colecciones separan cada producto o registro con un encabezado. Nueva distribución permite añadir/quitar productos. La recepción se abre con Recibir desde Donaciones.

ADMIN no hereda los permisos exclusivos de ASESOR_BANCO. No se muestra un botón de escritura si el rol no está autorizado. La API valida además los estados, propiedad, disponibilidad de inventario y reglas de negocio: ocultar un botón no sustituye esas verificaciones.

## Reglas que afectan las pruebas reales

- La creación de usuarios solo admite ADMIN/ASESOR_BANCO. Donantes y voluntarios se registran desde la app. Una cuenta con contraseña temporal debe cambiarla antes de operar.
- El administrador no puede inactivar/suspender su propia cuenta. ACTIVO/INACTIVO y SUSPENDIDO son operaciones distintas.
- Aprobar/rechazar verifica documentación y estados de la solicitud; los motivos se obtienen del ámbito correspondiente. Un motivo puede exigir comentario.
- Asignar/reasignar inicia la cascada de ofertas de la API. No existe selección administrativa directa de un voluntario concreto.
- Una ruta del banco requiere flota configurada y donaciones elegibles. El máximo de paradas lo valida la API. La confirmación web es manual sin GPS y queda marcada para auditoría; adjunta la foto de evidencia antes de confirmar.
- La recepción exige una donación ENTREGADA y una sede de destino. En recepción parcial se envían solo los productos aceptados, con cantidad y peso numéricos. Rechazo/aceptación parcial requieren motivo.
- AJUSTE admite signo; MERMA/VENCIMIENTO descuentan una cantidad positiva. Cero no es válido.
- Crear una distribución reserva existencias FEFO. Se confirma o anula únicamente según su estado; stock insuficiente produce un error visible.
- La sección Asignación de Configuración conserva el mockup: cuatro sliders/porcentajes, suma de 100%, valores predeterminados 30/30/25/15 y paradas de 1 a 5. Cancelar restaura lo guardado. Guardar envía los cinco parámetros juntos mediante PUT /v1/admin/parametros con cuerpo {valores:[{clave,valor},...]}. La API valida el conjunto, bloquea las filas, actualiza y audita dentro de una transacción. El PUT individual sigue disponible, pero no se utiliza para guardar los cuatro pesos desde esta pantalla.

- La web consulta y adjunta evidencias: URL firmada de subida, binario directo a Storage y metadatos enviados a la API. Muestra url_lectura y foto_url; las lecturas se renuevan mediante una nueva consulta, sin enlaces públicos.

## Validación automática

Frontend:

```powershell
npm run build
npm run lint
npm run test:render
npx playwright install chromium
npm run test:integration
```

Las pruebas inician Vite en 5178 e interceptan los servicios en 4300/4301. No modifican tu .env.local ni usan usuarios reales.

Para contrastar también las solicitudes del navegador con los controladores/DTO/roles de la rama actual de la API, compila primero la API. Desde el frontend, indica su carpeta:

```powershell
$env:TEST_API_SOURCE = (Resolve-Path ..\findfood-api).Path
npm run test:integration
```

El comprobador carga las clases compiladas y valida rutas, métodos, roles, cuerpos y query strings. TEST_SCENARIO permite ejecutar un escenario por parte de su nombre. TEST_SCREENSHOT_DIR permite guardar capturas y TEST_CHROMIUM_PATH seleccionar Chromium en entornos Linux.

La suite cubre los flujos de sesión existentes y operaciones ADMIN/ASESOR, errores con reintento y ausencia de controles sin permiso. Las respuestas, identidad y persistencia están simuladas: los DTO/roles son los de la API real, pero estas pruebas no sustituyen la prueba de negocio contra tu base de datos, SMTP, motor de asignación y Storage.

## Servicios fuera del panel administrativo

Los endpoints de registro/disponibilidad/ubicación del voluntario, ofertas/aceptación/rechazo/abandono/calificación, creación/edición/publicación de donaciones, impacto y dispositivos están reservados a DONANTE/VOLUNTARIO por la API. No se incorporaron al panel ADMIN/ASESOR ni se amplió su autorización. El móvil queda fuera de esta entrega.

No existe GET de auditoría ni una edición administrativa general de nombres/correo/rol ajenos: se conservan los límites del contrato actual. La edición de almacén solo envía los campos aceptados por PATCH (nombre, capacidad y activo).

## Prueba manual recomendada

1. Ingresar como ADMIN, crear un asesor y completar su primer cambio de contraseña.
2. Configurar banco/flota, revisar catálogos y crear un almacén válido.
3. Consultar una solicitud pendiente y aprobarla o rechazarla con un motivo válido.
4. Con datos de donación creados desde la app, consultar candidatos/historial y probar la reasignación.
5. Ingresar como ASESOR, crear una ruta de flota, adjuntar evidencia y ejecutar sus paradas.
6. Registrar una recepción total/parcial, consultar el lote y probar ajuste/merma.
7. Crear una distribución con stock, confirmar/anular un borrador y atender una alerta.
8. Registrar/revisar una incidencia; ingresar como ADMIN para resolverla.
9. Leer una notificación y comprobar que el contador se actualiza.

Conserva los mensajes de error y revisa Network si una regla impide operar. 401 indica sesión/token; 403 permiso/estado de cuenta; 409/422 regla de negocio; fallo de conexión exige revisar API, URL y CORS. La guía no contiene credenciales ni cambios en datos reales.


## Reportes e indicadores

Reportes consulta `GET /admin/auditoria`, restringido a ADMIN, para mostrar movimientos registrados en el servidor de todos los roles. Incluye filtros por periodo, usuario, rol, módulo y acción, descripciones y exportación CSV. Requiere desplegar los cambios del backend de `Conexion_Front` incluidos en [la guía y parche de administración](cambios-administrador.md). Los datos locales del navegador no se presentan como auditoría global. Los indicadores generales siguen disponibles en Inicio mediante `GET /v1/kpis/resumen`.

## Ajustes de interfaz del 16 de octubre de 2026

- El indicador Alimentos recuperados conserva los kilos recibidos del periodo. Inventario actual consulta GET /almacenes y suma kg_en_inventario de todos los almacenes, sin filtrar fechas ni limitarse a la primera página de lotes. La API agrega lotes en estado DISPONIBLE o RESERVADO; los lotes agotados, vencidos o descartados no forman parte de esa cifra. El total puede incluir registros iniciales de prueba sin recepciones del periodo.
- Si no se puede consultar el inventario o hay un peso inválido, se muestra un error con reintento, no un cero ficticio. La carga de existencias no impide mostrar los otros indicadores. Los cambios realizados desde el panel invalidan los datos del resumen.
- Los formularios laterales de consulta usan tablas Campo y Valor. Los productos, paradas y otras colecciones quedan separados; los enlaces de documentos y acciones se conservan. No se alteran los formularios de edición ni sus contratos.
- Configuración solo expone Asignación. Se retiraron las pestañas de Banco, Parámetros, Catálogos y Operación; no se eliminaron servicios de la API.
- Se eliminó Título del listado de Donaciones, conservando el dato en el detalle cuando lo devuelve la API.
- No se requieren cambios en la API para estos ajustes. Se contrastaron las consultas con Conexion_Front en dec8886. La base del frontend es la entrega anterior 2e78681; el remoto Conexion_Back sigue en 6a339dc.

Validación: compilación, lint, renderizado y escenarios de navegador con servicios simulados. La comprobación de contratos usa la API local compilada; no equivale a una prueba de integración contra la base de datos real.

## Permisos y consulta de rutas

El asesor no ve Usuarios ni Configuración en el menú. Usuarios, Lista de voluntarios, Pendientes y Configuración siguen protegidos al entrar por URL; no se solicitan sus servicios administrativos para el asesor. ADMIN conserva esos accesos.

Actualización 23/10/2026: Rutas permite planificar/iniciar flota y operar sus paradas con ASESOR_BANCO; también confirmar entregas en sede. La cancelación de rutas planificadas respeta los roles de la API. Se agrega subida directa de evidencias y seguimiento privado. Esta ampliación reemplaza la restricción histórica de solo consulta.

Almacenes muestra el total de existencias, separado de la capacidad. Tabla y detalle formatean los pesos numéricos o decimales recibidos como texto de la misma forma. El detalle se actualiza con el registro del listado tras refrescar los datos, en vez de retener una copia antigua de la selección.

Revisión del servicio: GET /almacenes calcula kg_en_inventario sumando peso_disponible_kg en lotes DISPONIBLE o RESERVADO, por almacen_id y sin filtro de fechas. La capacidad configurada no constituye inventario y un peso recibido histórico no equivale a las existencias actuales. No se modificó la consulta ni se alteraron datos de la base. No se dispuso de las dos capturas nuevas ni de la respuesta de la API local del usuario para confirmar una diferencia concreta entre sus registros.

### Flujo de recepción

1. La recogida y entrega deben haberse completado y la donación debe estar ENTREGADA en una sede. El asesor puede completar las operaciones de flota y la entrega en sede desde el detalle de Rutas; el voluntario ejecuta su recorrido desde el móvil.
2. El asesor abre Donaciones y pulsa Recibir en una donación ENTREGADA. ADMIN no recibe esa acción. Entrar por URL a una donación no entregada también bloquea el formulario.
3. Selecciona Aceptada, Aceptada parcialmente o Rechazada. En los dos últimos casos el motivo es obligatorio; algunos motivos requieren observación. En aceptación parcial indica productos, cantidades y pesos aceptados.
4. Registrar recepción crea los lotes aceptados en el almacén de destino y deja la donación RECIBIDA; el rechazo total no crea lotes y deja la donación RECHAZADA.
5. La web abre Recepciones. Consulta el detalle y comprueba los lotes en Inventario y el peso actual en Almacenes.

## Consulta de imágenes y evidencias

Se eliminaron de la web el selector de tipo, el campo de archivo y Guardar evidencia, incluida toda la lógica de solicitar subida, subir el binario y registrar la evidencia. Las API de escritura se mantienen para el cliente operativo; no se alteraron los servicios.

GET /v1/evidencias?donacion_id=UUID (o parada_id, recepcion_id, incidencia_id) devuelve registros con url_lectura firmada durante 300 segundos. Cada evidencia muestra vista previa y apertura en otra pestaña. Actualizar enlaces consulta nuevamente el listado para obtener URL vigentes. Si una imagen no se puede previsualizar, se conserva el enlace y se informa del fallo. HEIC puede requerir abrir o descargar el archivo según el navegador.

Las fotos de los productos llegan por GET /v1/donaciones/:id en items[].foto_url, también firmadas durante 300 segundos. Se muestran junto a la información de cada producto. Actualizar detalle renueva esos enlaces. No se interpreta una lista de evidencias de publicación vacía como ausencia de fotos de productos.

### Diagnóstico de enlaces que no cargan

- url_lectura o foto_url con dominio storage.simulado corresponde a STORAGE_SIMULADO=true en el backend. Para trabajar con archivos reales, configura STORAGE_SIMULADO=false en el entorno de la API, verifica su configuración de Supabase y reinicia el servicio. La web informa cuando recibe una URL simulada.
- Si existe un registro con url_lectura=null, la evidencia no está vacía: no se obtuvo una URL válida. Revisa el log URL de lectura no firmada y el bucket, la ruta y la configuración de acceso de la API. El servicio espera rutas con formato bucket/usuario/archivo, no una URL pública persistida.
- Si GET /evidencias devuelve [], no existen registros de evidencia asociados a ese contexto. Tener un archivo en Storage no lo registra automáticamente: el cliente que lo carga debe completar el registro con el padre correcto. Una foto de producto se consulta aparte en items[].foto_url.
- Si devuelve una URL firmada pero la imagen falla, renueva el enlace y comprueba la respuesta HTTP y el formato del archivo. No debe sustituirse el enlace privado por una URL pública construida en la web.

Validación con respuestas simuladas: lectura en donaciones, recepciones, incidencias y paradas; fotos de productos; URL nula o inválida; fallo de imagen; renovación; almacenamiento simulado; error de consulta y lista vacía. No se usaron las credenciales ni el Storage real del usuario.

## Mapa de rutas y distribución de asignaciones

Rutas muestra un mapa en la pantalla principal con selector sobre las rutas de la página y del filtro actuales. Consulta GET /rutas/:id al cambiar la selección. Las paradas se ordenan por orden y se ubican mediante lat/lng válidos; las que no incluyen coordenadas se omiten del mapa y se informa. Si no hay coordenadas, se muestra un estado vacío. El mapa permite acercar, alejar y centrar, con cartografía OpenStreetMap y atribución visible. Se respeta la caché del navegador; solo se solicitan las teselas visibles (https://operations.osmfoundation.org/policies/tiles/).

Cuando el detalle incluye geometria o geometry de tipo GeoJSON LineString, se dibuja ese trazado. De lo contrario, la línea discontinua conecta las paradas e indica que la API no entrega el recorrido GPS. No se calcula un recorrido por calles ni se interpreta la conexión entre paradas como un historial de posiciones. Para visualizar el recorrido efectivamente realizado, el backend debe incluir esa geometría en el detalle.

Asignaciones presenta un resumen de donación y dos columnas: candidatos en el orden de la API y desglose del candidato seleccionado con la acción de reasignación. Todos los datos originales siguen accesibles en secciones desplegables. No se inventan métricas, filtros de elegibilidad, tiempos de oferta ni acciones de oferta manual que la API no expone. El desglose se muestra si llega como desglose o desglose_puntaje; si no, se informa su ausencia. En móvil las columnas se apilan.

## Actualización de notificaciones y actividad

El contador y la lista GET /me/notificaciones se actualizan cada 15 segundos y al volver a una pestaña visible. La actualización conserva los datos visibles mientras consulta y no interrumpe una petición en curso. Se mantienen las acciones de lectura de notificaciones del servidor.

Además, la campana observa rutas y donaciones y, para ADMIN, usuarios y verificaciones PENDIENTE/APROBADA. Consulta todas las páginas en lotes de 100 cada 15 segundos mientras la pestaña está visible, al volver a ella y tras guardar una operación. Las consultas de administración solo se realizan para ADMIN. Si una fuente falla, conserva su referencia previa y la vuelve a intentar en el siguiente ciclo.

Los nuevos identificadores generan avisos de ruta, donación o usuario creado, voluntario pendiente y voluntario aprobado. Los cambios a EXPIRADA de una donación, COMPLETADA de una ruta o de PENDIENTE/PENDIENTE_VERIFICACION a ACTIVO de un usuario generan avisos propios. Una reactivación de SUSPENDIDO no se presenta como aprobación. Una fecha de recogida pasada no basta para anunciar vencimiento: el estado debe confirmarlo la API. Aprobar un voluntario desde la web sigue generando su aviso inmediatamente después de una respuesta exitosa.

En la primera consulta solo se anuncian los voluntarios pendientes creados en los últimos 7 días (created_at válido, no futuro); el resto de los registros establece la referencia sin anunciar altas históricas. Los estados conocidos se guardan por usuario y fuente en localStorage: al recargar o volver a entrar se detectan altas y cambios frente a la última consulta completa. Se evita repetir cada evento por entidad. El intervalo de 7 días está definido en recentPendingDays en src/integration/activity-events.ts.

Las notificaciones del servidor y la actividad del navegador se presentan en una sola lista, ordenada por fecha descendente, con búsqueda y un único botón Marcar todas como leídas. La consulta recorre todas las páginas del servidor en lotes de 100; la interfaz muestra inicialmente 20 avisos y permite Mostrar más. Se conserva la actividad local existente, separada por usuario, hasta 100 avisos. Cada aviso puede marcarse individualmente: los locales actualizan localStorage y los del servidor usan POST /me/notificaciones/:id/leer. Marcar todas actualiza ambas fuentes y usa POST /me/notificaciones/leer-todas cuando corresponde. No se requiere confirmar una segunda ventana para marcar lectura. Si falla la consulta del servidor, se informa y se mantienen visibles los avisos disponibles.

La actividad local es observada por este navegador: al volver puede detectar diferencias respecto al último estado guardado, pero no reconstruye transiciones intermedias, entidades eliminadas antes de consultar ni un historial anterior a la primera referencia. Para entrega duradera a todos los usuarios y dispositivos, la API debe registrar los eventos en /me/notificaciones. No se agregó un endpoint de escritura ni se modificaron permisos del backend.

Validación: npm run test:activity comprueba altas, ventana de pendientes recientes, cambios de estado, ausencia de duplicados y fechas inválidas. El escenario de integración «actividad importante» comprueba campana, listado, paginación más allá de 100 donaciones y persistencia al recargar.


Inventario FEFO consulta todas las páginas de los lotes filtrados por sede y tipo antes de ordenar por vencimiento. Las fechas sin hora se interpretan al final del día en Colombia. Prioridad roja: vencido o hasta 24 horas; naranja: hasta 3 días; verde: posterior. Sin fecha queda al final. Los indicadores se calculan antes de los filtros; el régimen solo se muestra si viene informado. Se conservan las acciones de detalle y ajuste. Los accesos a Distribuciones e Incidencias se retiraron de Inventario.



