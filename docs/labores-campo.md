# Labores de campo

## Contrato

- `GET /api/labores-suelo?finca_id=ID`: ADMIN, SUPERVISOR y OPERADOR.
- `POST /api/labores-suelo`: ADMIN y SUPERVISOR.
- ADMIN se limita a las fincas de su empresa. Los otros roles necesitan una asignacion vigente en usuarios_fincas.
- El usuario responsable se obtiene de la sesion. El cliente no puede elegir usuario o empresa.
- Tipos: fertilizacion, herbicida, roza, deshoje, deshije, riego y drenaje.

Ejemplo de POST (solo ilustrativo; no ejecutar contra una finca real):

```json
{
  "finca_id": 1,
  "tipo": "fertilizacion",
  "fecha": "2026-10-28",
  "intervalo_dias": 30,
  "observaciones": "Sector trabajado y novedades",
  "solicitud_id": "11111111-1111-4111-8111-111111111111"
}
```

Fecha real no futura segun America/Guayaquil. Intervalo opcional entero de 1 a 730 dias; null significa sin programacion. No se recomienda una frecuencia por defecto. Observaciones: texto de hasta 1000 caracteres, sin NUL.

La proxima fecha se calcula en el servidor. El primer guardado responde 201. Un reintento con el mismo usuario, UUID y contenido responde 200 sin duplicar; cambiar contenido con ese UUID responde 409.

GET devuelve finca, hoy, registros, ultimas y limitado. Registros contiene hasta 100 filas recientes con usuario_nombre; ultimas se consulta aparte por tipo para no perder una labor antigua fuera de ese limite. El frontend agrupa herbicida y roza como alternativas del mismo ciclo de maleza.

## Fumigacion existente

La nueva pantalla conserva `/api/reportes/fumigaciones` y `fumigaciones_sanidad`; no crea otra copia en labores_suelo. Siguen funcionando los calculos de sanidad y alertas existentes.

Se agregaron controles de fecha real/no futura, longitud de observaciones, empresa del usuario activo y asignacion de finca al consultar una finca concreta o registrar. La consulta general tambien filtra por empresa. El INSERT verifica de nuevo la empresa para no depender solo de una validacion previa. Los errores internos no se devuelven al navegador.

No se cambiaron los roles de escritura de la API antigua de fumigacion: un operador autorizado conserva su acceso existente, aunque la nueva vista reserve el registro a ADMIN/SUPERVISOR. Esta API antigua no implementa idempotencia por UUID. Ante timeout, comprobar el historial antes de repetir; no prometer entrega exactamente una vez. Los intervalos nuevos no sustituyen la configuracion de alertas de fumigacion.

## Migraciones y despliegue

1. Con respaldo y entorno de pruebas, aplicar en orden `025_labores_suelo.sql` y `026_labores_campo_tipos.sql` usando `npm run migrate` desde el backend con las variables del destino correcto. El migrador registra cada archivo y ejecuta cada migracion dentro de una transaccion.
2. La 025 crea tabla, indice, restricciones y politica RLS; depende de las tablas fincas/usuarios y de las funciones de RLS de migraciones anteriores. La 026 agrega los tipos de labores de campo sin eliminar registros existentes.
3. Desplegar el backend con ambas migraciones aplicadas antes de publicar el frontend. Si falta la tabla, la API de labores devuelve 503; no confundirlo con un historial vacio.
4. Comprobar con usuarios de prueba: guardar, reintentar el UUID, listar, cambiar finca y denegar acceso a otra empresa. Verificar que una fumigacion aparece una sola vez y sigue alimentando sanidad.
5. No revertir eliminando la tabla si ya hay registros; volver al codigo anterior manteniendo los datos y analizar la correccion necesaria.

No se modifico CORS ni se desplego o migro Railway al preparar esta entrega. Las nuevas agendas no incluyen cola offline, edicion/anulacion ni envio automatico de notificaciones externas.

## Verificacion

- `npm run lint`: chequeo sintactico.
- `npm test`: pruebas unitarias y HTTP; las integraciones que requieren variables se omiten cuando no estan configuradas.
- `LABORES_TEST_DATABASE_URL=... node --test test/laboresSuelo.postgres.test.js`: usar exclusivamente PostgreSQL temporal vacio, con permiso para crear tablas y un rol de prueba. El test ejecuta las migraciones 007, 010, 025 y 026 y revierte toda la transaccion al finalizar. Nunca usa DATABASE_URL como fallback.

Revision 2026-10-28: 63 pruebas locales aprobadas; 3 integraciones omitidas en la suite general por falta de sus variables. La integracion de labores se ejecuto aparte y paso en PostgreSQL 16 temporal, incluyendo roles ADMIN/SUPERVISOR/OPERADOR, una finca de otra empresa, una finca no asignada y el filtro de empresa de fumigacion. Permanecen sin ejecutar el E2E de despliegue multiempresa y la integracion PostgreSQL de clima en esta revision. Esto no certifica el estado de Railway ni el aislamiento de todos los modulos del sistema.
