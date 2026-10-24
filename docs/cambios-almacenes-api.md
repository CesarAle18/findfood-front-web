# Ampliación de edición de almacenes en la API

API local encontrada: C:/Users/Ryzen 7/OneDrive/Escritorio/findfood-api-configuracion/findfood-api.

Se prepararon cambios en `.tools/warehouse-api-update` (junto con copias originales):

- ActualizarAlmacenDto: campos opcionales direccion (5–255 caracteres), tipo (SECO / REFRIGERADO) y ubicacion (CoordenadaDto).
- AlmacenesService.actualizar: persiste dirección y tipo; actualiza las coordenadas dentro de la misma transacción y conserva auditoría.
- La capacidad en kg se aplica al régimen de la sede; no se crea un segundo cupo refrigerado independiente.
- No cambia el modelo de datos, el banco único ni los permisos ADMIN/ASESOR_BANCO del PATCH.

El aplicador verifica que los archivos originales no hayan cambiado antes de escribir y compila la API al terminar. El destino está fuera del workspace autorizado, por lo que aplicar requiere permiso del entorno. No se aplica ningún cambio a la base de datos ni se usan credenciales.

Estado: ampliación aplicada y compilada en la API local. Validación de DTO y servicio auditado aprobada con transacción simulada. La opción de interfaz Sí/No se guarda como régimen REFRIGERADO/SECO del almacén; la capacidad en kg es independiente de esa opción.
