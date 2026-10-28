import { query } from '../db/db.js';
import { normalizeRole } from '../utils/accessScope.js';
import { hoyLabores, validarFechaLabor, validarObservacionesLabor, enteroLabor } from '../utils/laborValidation.js';
export { hoyLabores } from '../utils/laborValidation.js';

const fallo = (message, status = 400) => Object.assign(new Error(message), { status });
export function validarLabor(input, hoy = hoyLabores()) {
  if (!['fertilizacion', 'herbicida', 'roza', 'deshoje', 'deshije', 'riego', 'drenaje'].includes(input?.tipo)) throw fallo('Seleccione una labor valida.');
  const fecha = validarFechaLabor(input.fecha, hoy);
  const sinIntervalo = input.intervalo_dias == null || input.intervalo_dias === '';
  const intervalo = sinIntervalo ? null : enteroLabor(input.intervalo_dias, 730);
  if (!sinIntervalo && intervalo === null) throw fallo('El intervalo debe ser de 1 a 730 dias.');
  const observaciones = validarObservacionesLabor(input.observaciones);
  if (typeof input.solicitud_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.solicitud_id)) throw fallo('Identificador de solicitud invalido.');
  return { tipo: input.tipo, fecha, intervalo_dias: intervalo,
    proxima_fecha: intervalo === null ? null : new Date(Date.parse(fecha) + intervalo * 86400000).toISOString().slice(0, 10),
    observaciones: observaciones.trim(), solicitud_id: input.solicitud_id.toLowerCase() };
}

// Also enforce company boundaries for ADMIN; never trust a company supplied by the client.
const accesoSql = `SELECT f.id, f.nombre FROM fincas f JOIN usuarios u ON u.id = $2
  WHERE f.id = $1 AND u.activo = true AND u.empresa_id = f.empresa_id
    AND ($3 = 'ADMIN' OR EXISTS (SELECT 1 FROM usuarios_fincas uf WHERE uf.usuario_id = u.id AND uf.finca_id = f.id))`;
export async function autorizarFincaLabor(fincaId, user, consultar = query, escritura = false) {
  const role = normalizeRole(user?.rol);
  if (!['ADMIN', 'SUPERVISOR', 'OPERADOR'].includes(role) || (escritura && role === 'OPERADOR')) throw fallo('No tiene permisos para esta labor.', 403);
  const id = enteroLabor(fincaId, 2147483647);
  const usuario = enteroLabor(user?.id, 2147483647);
  if (id === null || usuario === null) throw fallo('Seleccione una finca valida.');
  const { rows } = await consultar(accesoSql, [id, usuario, role]);
  if (!rows.length) throw fallo('Finca no disponible para esta cuenta.', 403);
  return { finca: rows[0], id, usuario, role };
}
const campos = 'id, finca_id, usuario_id, tipo, fecha::text, intervalo_dias, proxima_fecha::text, observaciones, creado_en';

export async function listarLabores(fincaId, user, consultar = query) {
  const { finca, id } = await autorizarFincaLabor(fincaId, user, consultar);
  const { rows } = await consultar(`SELECT ${campos},
    (SELECT u.nombre FROM usuarios u WHERE u.id = labores_suelo.usuario_id) AS usuario_nombre
    FROM labores_suelo WHERE finca_id=$1 ORDER BY fecha DESC, id DESC LIMIT 101`, [id]);
  const { rows: ultimas } = await consultar(`SELECT DISTINCT ON (tipo)
    ${campos} FROM labores_suelo WHERE finca_id=$1
    ORDER BY tipo, fecha DESC, id DESC`, [id]);
  return { finca, hoy: hoyLabores(), registros: rows.slice(0, 100), limitado: rows.length > 100, ultimas };
}

export async function registrarLabor(fincaId, user, input, consultar = query) {
  const labor = validarLabor(input);
  const { id, usuario, role } = await autorizarFincaLabor(fincaId, user, consultar, true);
  const params = [id, usuario, role, labor.solicitud_id, labor.tipo, labor.fecha, labor.intervalo_dias, labor.proxima_fecha, labor.observaciones];
  const { rows } = await consultar(`INSERT INTO labores_suelo (finca_id, usuario_id, solicitud_id, tipo, fecha, intervalo_dias, proxima_fecha, observaciones)
    SELECT f.id, $2, $4::uuid, $5, $6::date, $7::int, $8::date, $9 FROM (${accesoSql}) f
    ON CONFLICT (usuario_id, solicitud_id) DO NOTHING RETURNING ${campos}`, params);
  if (rows.length) return { registro: rows[0], repetido: false };
  const { rows: anteriores } = await consultar(`SELECT ${campos} FROM labores_suelo WHERE usuario_id=$1 AND solicitud_id=$2::uuid`, [usuario, labor.solicitud_id]);
  const anterior = anteriores[0];
  if (!anterior || Number(anterior.finca_id) !== id || ['tipo', 'fecha', 'intervalo_dias', 'proxima_fecha', 'observaciones'].some(key => anterior[key] !== labor[key])) {
    throw fallo('La solicitud ya fue utilizada con otros datos o el acceso cambio. Actualice la consulta.', 409);
  }
  return { registro: anterior, repetido: true };
}
