# Consulta de alimentos: error Cannot GET

La rama `Conexion_Front`, verificada en `2b48a41069404c6807e9a854fa1e7ffe63dc7571`, incluye POST y PATCH de alimentos, pero no `GET /v1/admin/tipos-alimento`. El endpoint nuevo de auditoría es independiente de esta consulta.

El frontend ahora utiliza el catálogo de activos si la consulta administrativa devuelve 404. Conserva búsqueda, filtro de régimen y paginación, y muestra una indicación explícita de que aún no puede consultar inactivos. No hace esta sustitución ante errores de permisos, autenticación u otros fallos del servidor.

Para consultar y reactivar inactivos hay que publicar el GET administrativo. El parche `backend-alimentos.patch` solo añade el listado, su DTO, la consulta de servicio y sus pruebas, sin modificar auditoría ni requerir migraciones de base de datos.

Desde tu checkout del backend en la rama `Conexion_Front`, con los cambios propios guardados:

```powershell
git apply --check "C:/Users/Ryzen 7/OneDrive/Escritorio/findfood-web-configuracion/findfood-front-web/docs/backend-alimentos.patch"
git apply "C:/Users/Ryzen 7/OneDrive/Escritorio/findfood-web-configuracion/findfood-front-web/docs/backend-alimentos.patch"
npm run build
npm test -- --runInBand alimentos-admin.spec auditoria.spec
```

Después publicar los cambios con el procedimiento habitual del repositorio y desplegar el backend; desplegar también el frontend para activar su compatibilidad. Los cambios de esta sesión son locales y no se subieron a GitHub ni a producción.

El parche se aplicó y compiló en un checkout aislado de la versión remota actual, `.tools/alimentos-api`; pasaron 21 pruebas del backend y el escenario de navegador que reproduce el 404. La consulta nueva permite incluir activos e inactivos, filtrar por nombre/código, estado y régimen, y paginar. La reactivación continúa usando el PATCH existente con `{ "activo": true }`.
