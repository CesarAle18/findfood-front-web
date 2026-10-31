# Cambios de administración

El frontend usa `GET /admin/auditoria` para consultar registros compartidos del servidor, en lugar de presentar la bitácora local de la cuenta. El endpoint admite `desde` inclusivo, `hasta` exclusivo, `limite` y `desplazamiento`; devuelve `{ datos, total, limite, desplazamiento }`.

La implementación del backend está en `.tools/admin-api`, una copia de la rama `Conexion_Front` de `CesarAle18/findfood-api`, basada en `5bd5dc6ff78a4609eece88228d0db612eb07ae93`. El archivo `backend-administrador.patch` permite aplicar los cambios a otro checkout de esa misma rama:

```powershell
# Ejecutar desde el repositorio del backend; ajustar la ruta del parche.
git apply --check "ruta/al/frontend/docs/backend-administrador.patch"
git apply "ruta/al/frontend/docs/backend-administrador.patch"
npm ci
npm run build
npm test -- --runInBand auditoria.spec parametros-conjunto.spec alimentos-admin.spec
```

No se publicaron cambios en GitHub ni se modificó la base de producción. Para activar el reporte hay que desplegar el backend actualizado y el frontend. Aplicar también la migración `20261030000000_minimo_dos_paradas.sql` con el procedimiento de migraciones del proyecto; corrige configuraciones antiguas inferiores a dos paradas.

## Auditoría

- Solo ADMIN puede consultar el endpoint; abarca todos los actores, sin filtrar por la cuenta conectada.
- Combina `auditoria`, `historial_estado` y `movimiento_inventario`. Una operación puede tener varios registros de trazabilidad, por ejemplo un movimiento y el cambio de estado correspondiente.
- Incluye actor, roles activos actuales, fecha, acción en infinitivo, descripción y detalles operativos. Los roles mostrados no son una reconstrucción histórica de los roles del actor.
- El interceptor añade las operaciones nuevas que no tenían una auditoría explícita. Excluye autenticación y lectura de notificaciones, y omite rutas que ya auditan transaccionalmente para no duplicar sus entradas de auditoría.
- El interceptor permite conservar el resultado de una operación confirmada si falla la escritura de su auditoría y registra el fallo en el log del servidor. La trazabilidad transaccional existente se mantiene.
- No expone el JSON completo de auditoría, contraseñas, tokens, documentos, IP ni user-agent.
- Los movimientos históricos disponibles son los que ya estaban registrados en el servidor; las acciones que solo existían en el almacenamiento local de un navegador no se pueden recuperar como auditoría compartida.
- El frontend consulta todas las páginas del periodo y fija una fecha de corte para evitar desplazamientos al entrar movimientos nuevos. Para consultas superiores a 10.000 registros pide reducir el periodo y evita mostrar un resultado parcial como completo.

## Configuración y almacenes

- Porcentajes enteros entre 0 y 100, con suma de 100%; al guardar se convierten al formato de ponderación 0–1 que necesita el motor.
- Máximo de paradas configurable entre 2 y 5, validado en frontend y backend.
- Nuevo almacén obtiene las coordenadas desde `/geo/geocodificar` usando su dirección. El servicio de direcciones del backend debe estar configurado; una dirección que no pueda ubicarse no genera coordenadas ficticias.
- Banco no muestra coordenadas. Conserva la ubicación al editar otros datos y vuelve a ubicar el banco si cambia su dirección o ciudad.
- El botón se llama «Editar Banco». «Administrar sedes y almacenes» queda al final y se retira el listado duplicado de sedes.
- Configuración solo muestra Asignación, Banco y Alimentos. Ocultar Tareas no detiene la ejecución de los trabajos del servidor.
- Alimentos usa `GET /admin/tipos-alimento` (solo ADMIN), con búsqueda `q` por nombre/código, `estado=ACTIVO|INACTIVO`, `tipo_almacenamiento=SECO|REFRIGERADO`, `limite` y `desplazamiento`. Devuelve la misma envoltura paginada que el resto de los listados. Sin estado seleccionado incluye activos e inactivos.
- El listado permite reactivar o desactivar el registro existente con `PATCH /admin/tipos-alimento/:id` y `{ activo: true|false }`. La edición mantiene el valor real de `activo`. El catálogo `/catalogos` que usan los formularios sigue mostrando únicamente alimentos activos.
- Los controles de Alimentos y su tabla tienen contenedores separados. El dashboard tiene separación explícita entre indicadores adicionales y el resumen de donaciones.

## Validación

Se comprobó la compilación de ambos proyectos, 30 pruebas unitarias del backend, las pruebas existentes de renderizado, actividad y presentación de donaciones, y escenarios de navegador con servicios simulados. El escenario de administración comprueba el reporte de varios roles, sus filtros y exportación, el límite mínimo de paradas, los porcentajes, la edición del banco y la creación de almacenes sin campos de coordenadas. El escenario de alimentos comprueba paginación, filtros combinados, estado real de edición, reactivación, separación de contenedores y ausencia de Tareas. No se ejecutaron consultas contra la base de producción.
