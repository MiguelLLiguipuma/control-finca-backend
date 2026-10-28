import test from 'node:test';
import assert from 'node:assert/strict';
import { validarLabor, listarLabores, registrarLabor } from '../src/services/laboresSueloService.js';

const user = { id: 1, rol: 'ADMIN' };
const datos = () => ({ tipo: 'fertilizacion', fecha: '2026-01-31', intervalo_dias: 30,
  observaciones: ' Labor registrada ', solicitud_id: '11111111-1111-4111-8111-111111111111' });
test('labores de campo admite deshoje deshije riego y drenaje sin duplicar fumigaciones', () => {
  for (const tipo of ['deshoje', 'deshije', 'riego', 'drenaje']) assert.equal(validarLabor({ ...datos(), tipo }).tipo, tipo);
  assert.throws(() => validarLabor({ ...datos(), tipo: 'fumigacion' }), { status: 400 });
});
test('labor calcula proxima fecha cruzando meses sin asignar un intervalo por defecto', () => {
  const labor = validarLabor(datos(), '2026-10-28');
  assert.equal(labor.proxima_fecha, '2026-03-02');
  assert.equal(labor.observaciones, 'Labor registrada');
  assert.equal(validarLabor({ ...datos(), intervalo_dias: null }, '2026-10-28').proxima_fecha, null);
});
test('labor rechaza fecha irreal, futura, tipo desconocido, intervalo y UUID invalidos', () => {
  for (const cambio of [{ fecha: '2026-02-30' }, { fecha: '2026-10-29' }, { tipo: 'fumigacion' },
    { fecha: '0000-01-01' }, { intervalo_dias: true }, { intervalo_dias: [30] }, { intervalo_dias: {} },
    { observaciones: 'texto\0invalido' },
    { intervalo_dias: 0 }, { intervalo_dias: 1.5 }, { intervalo_dias: 731 }, { solicitud_id: 'x' }, { observaciones: 'x'.repeat(1001) }]) {
    assert.throws(() => validarLabor({ ...datos(), ...cambio }, '2026-10-28'), { status: 400 });
  }
});
test('IDs de finca no aceptan booleanos, arrays, objetos ni desbordan integer de PostgreSQL', async () => {
  for (const id of [true, [1], {}, '', '1e0', 2147483648]) {
    await assert.rejects(listarLabores(id, user, async () => { assert.fail('No debe consultar con ID invalido'); }), { status: 400 });
  }
});
test('operador no registra y administrador tampoco accede a finca de otra empresa', async () => {
  let calls = 0;
  const consultar = async sql => { calls++; assert.match(sql, /u\.empresa_id = f\.empresa_id/); return { rows: [] }; };
  await assert.rejects(registrarLabor(4, { id: 1, rol: 'OPERADOR' }, datos(), consultar), { status: 403 });
  assert.equal(calls, 0);
  await assert.rejects(listarLabores(4, user, consultar), { status: 403 });
  assert.equal(calls, 1);
});
test('historial consulta ultimas labores por separado para no perder una fertilizacion antigua', async () => {
  let calls = 0;
  const result = await listarLabores(4, user, async (sql, params) => {
    calls++;
    assert.equal(params[0], 4);
    if (calls === 1) return { rows: [{ id: 4, nombre: 'Prueba' }] };
    if (calls === 2) { assert.match(sql, /LIMIT 101/); return { rows: Array.from({ length: 101 }, (_, id) => ({ id })) }; }
    assert.match(sql, /DISTINCT ON/); return { rows: [{ tipo: 'fertilizacion', fecha: '2026-01-01' }] };
  });
  assert.equal(result.registros.length, 100); assert.equal(result.limitado, true); assert.equal(result.ultimas.length, 1);
});
test('reintento devuelve la misma labor sin insertar dos veces y rechaza cambios de contenido', async () => {
  const normal = validarLabor(datos(), '2026-10-28');
  const consultar = async (sql, params) => {
    if (sql.startsWith('SELECT f.id')) return { rows: [{ id: 4 }] };
    if (sql.startsWith('INSERT')) { assert.match(sql, /ON CONFLICT.*DO NOTHING/); assert.equal(params[1], 1); return { rows: [] }; }
    return { rows: [{ ...normal, id: 7, finca_id: 4 }] };
  };
  assert.equal((await registrarLabor(4, user, datos(), consultar)).repetido, true);
  await assert.rejects(registrarLabor(4, user, { ...datos(), tipo: 'roza' }, consultar), { status: 409 });
});
