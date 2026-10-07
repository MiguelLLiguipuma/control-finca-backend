import test from 'node:test';
import assert from 'node:assert/strict';
import { validarConsultaClima, getWeatherHistory } from '../src/services/clima/weatherHistory.service.js';

test('consulta clima valida finca y fechas reales con rango acotado', () => {
  const ok = validarConsultaClima({ finca_id: '4', desde: '2026-07-01', hasta: '2026-07-30' }, '2026-08-01');
  assert.equal(ok.dias, 30);
  for (const input of [
    { finca_id: 0, desde: '2026-07-01', hasta: '2026-07-30' },
    { finca_id: 4, desde: '2026-02-31', hasta: '2026-07-30' },
    { finca_id: 4, desde: '2026-07-30', hasta: '2026-07-01' },
    { finca_id: 4, desde: '2024-01-01', hasta: '2026-07-30' },
    { finca_id: 4, desde: '2026-07-01', hasta: '2026-08-02' },
  ]) assert.throws(() => validarConsultaClima(input, '2026-08-01'), { status: 400 });
});

test('finca no visible no consulta su historial', async () => {
  let queries = 0;
  await assert.rejects(() => getWeatherHistory({ fincaId: 4 }, async () => { queries++; return { rows: [] }; }), { status: 404 });
  assert.equal(queries, 1);
});

test('historial usa parametros, conserva nulos y declara limitacion de muestras', async () => {
  const calls = [];
  const responses = [
    [{ id: 4, nombre: 'Prueba', latitud: null, longitud: null }],
    [{ fecha: '2026-07-02', temp_media: '28.45', unidades_calor_dia: '14.45', precipitacion_mm: null, actualizado_en: '2026-07-03T04:55:00Z' }],
    [{ fecha: '2026-07-02', actualizado_en: '2026-07-03T04:55:00Z' }],
  ];
  const data = await getWeatherHistory({ fincaId: 4, desde: '2026-07-01', hasta: '2026-07-03', dias: 3, hoy: '2026-07-04' }, async (sql, params) => {
    calls.push({ sql, params }); return { rows: responses.shift() };
  });
  assert.deepEqual(calls[1].params, [4, '2026-07-01', '2026-07-03']);
  assert.match(calls[1].sql, /JOIN fincas/);
  assert.equal(data.registros[0].precipitacion_mm, null);
  assert.equal(data.registros[0].temp_media, 28.45);
  assert.equal(data.dias_atraso, 2);
  assert.equal(data.metodologia.lluvia_diaria_disponible, false);
  assert.equal(data.metodologia.tipo, 'MUESTRA_PUNTUAL');
  assert.equal(data.registros.length, 1);
});
