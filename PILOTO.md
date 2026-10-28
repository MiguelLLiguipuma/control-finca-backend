# Configuracion previa al piloto

Esta entrega no despliega cambios ni ejecuta migraciones. No constituye una certificacion de seguridad de produccion.

## Cambios que afectan el despliegue

- El registro publico esta cerrado por defecto, incluido el alta automatica con Google. Las cuentas existentes pueden iniciar sesion. Para abrir altas se requiere ALLOW_PUBLIC_REGISTRATION=true de forma expresa; para el piloto mantenerlo ausente o false.
- Los previews de Vercel necesitan un origen exacto en CORS_ORIGINS. Ya no basta con que el hostname se parezca al del proyecto. No conectar previews arbitrarios a produccion.
- Cambiar rol, empresa, estado, contrasena o fincas asignadas revoca sesiones. El usuario afectado debe iniciar sesion nuevamente.
- El token se compara con el rol y empresa actuales de la base. Un token viejo sin empresa vigente puede requerir nuevo login.
- La cache de sesion es local al proceso, maximo 30 segundos y 1000 entradas. La invalidacion se propaga inmediatamente en el proceso que modifica el usuario, no entre replicas. Para exigencias de revocacion inmediata distribuida revisar cache compartida o verificar en cada solicitud.
- Los limitadores tienen contadores independientes, memoria acotada y parametros validados. Siguen siendo por proceso; verificar proxy y concurrencia en Railway.
- Los errores temporales de verificacion de sesion responden 503, sin fingir que la contrasena o el token son incorrectos.

## Comprobaciones

1. npm run lint: chequeo sintactico, no auditoria semantica.
2. npm run test:security: pruebas locales y HTTP sin modificar datos de produccion.
3. npm run verify:release: exige primero fixture E2E, luego lint, seguridad y pruebas de aislamiento.

Variables E2E obligatorias: E2E_BASE_URL, E2E_TOKEN_OPERATOR, E2E_TOKEN_SUPERVISOR, E2E_TOKEN_ADMIN, E2E_FINCA_PERMITIDA, E2E_FINCA_NO_PERMITIDA, E2E_FINCA_OTRA_EMPRESA.

Los usuarios del fixture pertenecen a empresa A. La finca permitida pertenece a A y esta asignada al operador. La no permitida pertenece a A pero no esta asignada al operador. La tercera pertenece a B. Los IDs son distintos. El administrador es de empresa A, no global. Usar exclusivamente staging y secretos de ese entorno.

Las pruebas E2E actuales son de lectura; deben ampliarse a escrituras, exportaciones y sincronizacion. No interpretar una ejecucion omitida como evidencia positiva.

## Pendientes que impiden certificar lanzamiento publico

- Restauracion de respaldo real en base separada; RPO/RTO definidos.
- Separacion de administrador de plataforma y empresa; auditoria completa de filtros y RLS usando el rol real de PostgreSQL.
- Transacciones en operaciones administrativas, revision de asignaciones entre empresas y pruebas concurrentes.
- Migracion coordinada de tokens del navegador a sesiones seguras, con CSRF y renovacion.
- Verificacion de certificado PostgreSQL (configuracion existente rejectUnauthorized:false), proxy, cabeceras reales y limites distribuidos.
- Recuperacion de cuenta, formulario de retroalimentacion con seguimiento, privacidad y monitoreo operativo.

El seguimiento ampliado esta en frontend/docs/preparacion-piloto.md del proyecto.

## Labores de campo

La nueva interfaz requiere desplegar la API de labores y aplicar las migraciones 025 y 026 en orden. El contrato, los permisos, las pruebas y las limitaciones de la integracion de fumigacion estan en [docs/labores-campo.md](docs/labores-campo.md). La preparacion de commits no ejecuta migraciones en Railway.

## Preparacion de commits: 2026-10-28

- Aprobadas 28 pruebas de seguridad y 22 pruebas adicionales de cosecha, idempotencia, deteccion, contrasenas y clima.
- Chequeo sintactico aprobado para 90 archivos. Auditoria npm de dependencias de produccion: cero vulnerabilidades reportadas.
- No se ejecutaron las pruebas E2E reales entre empresas: requieren un entorno separado y las variables anteriores. No declarar verificado el aislamiento por estas pruebas locales.
- node_modules se retiro del seguimiento Git en un commit de limpieza separado, conservando la instalacion local. La carpeta permanece ignorada. Usar npm ci al instalar desde package-lock.json; no volver a agregar las dependencias generadas al repositorio.
- La preparacion de estos commits no ejecuta migraciones, no modifica datos de produccion y no hace push ni despliega. Revisar CORS_ORIGINS y la politica de registro antes de desplegar.
