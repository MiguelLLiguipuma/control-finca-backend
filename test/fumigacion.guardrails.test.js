import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportesController } from '../src/controllers/reporteController.js';
import { ReportesService } from '../src/services/reportesService.js';
import { ReportesModel } from '../src/models/reportesModel.js';
import { validarFechaLabor, validarObservacionesLabor } from '../src/utils/laborValidation.js';

test('validacion de labores usa fecha real no futura y texto acotado', () => {
  assert.equal(validarFechaLabor('2024-02-29', '2026-10-28'), '2024-02-29');
  for (const value of ['2026-02-29', '2026-10-29', '0000-01-01', ['2026-01-01'], null]) {
    assert.throws(() => validarFechaLabor(value, '2026-10-28'), { status: 400 });
  }
  assert.equal(validarObservacionesLabor(' prueba '), 'prueba');
  for (const value of [true, {}, 'a'.repeat(1001), 'a\0b']) assert.throws(() => validarObservacionesLabor(value), { status: 400 });
});

test('controller de fumigacion rechaza fecha futura antes de persistir', async t => {
  const guardar = t.mock.method(ReportesService, 'registrarFumigacion', async () => assert.fail('No debe guardar'));
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await ReportesController.registrarFumigacion({ body: { finca_id: 1, fecha_fumigacion: '9999-01-01' }, user: { id: 1, rol: 'ADMIN' } }, res);
  assert.equal(res.code, 400); assert.match(res.body.error, /no futura/); assert.equal(guardar.mock.callCount(), 0);
});

test('consulta general de fumigaciones pasa usuario autenticado para filtrar empresa', async t => {
  const listar = t.mock.method(ReportesService, 'getFumigaciones', async () => []);
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await ReportesController.fumigaciones({ query: {}, user: { id: 7, rol: 'ADMIN' } }, res);
  assert.equal(listar.mock.calls[0].arguments[0].usuarioId, 7);
  assert.deepEqual(res.body, []);
});

test('fumigaciones no expone errores internos de PostgreSQL al frontend', async t => {
  t.mock.method(ReportesService, 'getFumigaciones', async () => { throw new Error('SQL interno confidencial'); });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await ReportesController.fumigaciones({ query: {}, user: { id: 7, rol: 'ADMIN' } }, res);
  assert.equal(res.code, 500); assert.doesNotMatch(res.body.error, /SQL/);
});

test('modelo de fumigacion bloquea escritura si empresa cambia y filtra lectura por usuario activo', async () => {
  await assert.rejects(ReportesModel.registrarFumigacion({ fincaId: 1, usuarioId: 2, fechaFumigacion: '2026-01-01' }, async sql => {
    assert.match(sql, /u.empresa_id = f.empresa_id/); return { rows: [] };
  }), { status: 403 });
  await ReportesModel.obtenerFumigaciones({ fincaIds: [1], usuarioId: 2 }, async (sql, params) => {
    assert.match(sql, /empresa_id FROM usuarios WHERE id = \$1 AND activo = true/);
    assert.deepEqual(params, [2, [1], 30]); return { rows: [] };
  });
});
