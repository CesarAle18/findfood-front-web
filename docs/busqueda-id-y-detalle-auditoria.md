# Búsqueda por ID y detalle de auditoría

Los listados tienen un campo «ID» para pegar identificadores. La coincidencia es exacta, ignora espacios al inicio/final y diferencias entre mayúsculas y minúsculas, y acepta tanto identificadores numéricos como UUID. Se consideran los campos `id`, los terminados en `_id` y los identificadores de objetos relacionados disponibles en la respuesta. No busca coincidencias parciales dentro del nombre o la descripción.

Está disponible en Usuarios, Donaciones, Rutas, Recepciones, Inventario, Almacenes, Voluntarios, Pendientes, Alertas, Alimentos, Notificaciones y Reportes, además de los listados del modo de demostración. Los paneles de resumen y formularios sin listados no tienen un buscador de registros.

Las búsquedas mantienen los demás filtros y permisos. El asesor continúa sin ver donaciones expiradas. En listados paginados se consultan las páginas necesarias antes de aplicar el filtro por ID y presentar el total; no se limita la coincidencia a las filas de la página visible. Las consultas que necesitan recorrer más de 10.000 registros se interrumpen con un mensaje para reducir filtros, en vez de presentar resultados parciales como completos. No requiere endpoints nuevos del backend: el parámetro interno de búsqueda se retira antes de realizar la petición HTTP.

En el detalle de auditoría, «Valores anteriores» y «Valores nuevos» se convierten de sus cadenas JSON a campos y grupos legibles. Se muestran nombres de campos, estados formateados y valores Sí/No para booleanos. Los objetos anidados y listas conservan su estructura visual; los valores nulos muestran «Sin valores registrados» y el contenido mal formado presenta un mensaje sin mostrar el JSON roto.

Validación: compilación y lint; pruebas de coincidencia exacta, normalización y páginas posteriores; prueba de navegador para los módulos principales y notificaciones; reporte de auditoría sin JSON y con búsqueda; búsqueda de alimentos por ID y restricción de donaciones expiradas para el asesor. Las pruebas de navegador usan servicios simulados.
