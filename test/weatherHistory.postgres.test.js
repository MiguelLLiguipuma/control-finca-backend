import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { getWeatherHistory } from '../src/services/clima/weatherHistory.service.js';

// Explicitly opt into a disposable PostgreSQL database, never the application URL.
const databaseUrl = process.env.WEATHER_TEST_DATABASE_URL;
test('historial legacy y migracion de timestamps funcionan en PostgreSQL real', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE fincas (id integer PRIMARY KEY, nombre text, latitud numeric, longitud numeric);
      INSERT INTO fincas VALUES (1, 'Prueba', NULL, NULL);
      CREATE TEMP TABLE historial_clima_fincas (
        finca_id integer, fecha date, temp_media numeric, unidades_calor_dia numeric, precipitacion_mm numeric
      );
      INSERT INTO historial_clima_fincas VALUES (1, '2026-10-05', 28, 14, 2)`);
    const consulta = { fincaId: 1, desde: '2026-10-01', hasta: '2026-10-06', dias: 6, hoy: '2026-10-06' };
    const consultar = (sql, params) => client.query(sql, params);
    const legacy = await getWeatherHistory(consulta, consultar);
    assert.equal(legacy.registros.length, 1);
    assert.equal(legacy.registros[0].actualizado_en, null);
    assert.equal(legacy.ultima_actualizacion, null);
    assert.equal(legacy.dias_atraso, 1);

    const sql = await readFile(new URL('../src/db/migrations/024_historial_clima_timestamps.sql', import.meta.url), 'utf8');
    await client.query(sql);
    await client.query(sql);
    const migrated = await getWeatherHistory(consulta, consultar);
    assert.equal(migrated.ultima_actualizacion, null, 'no inventa fechas para registros antiguos');
    await client.query('UPDATE historial_clima_fincas SET temp_media = 29 WHERE finca_id = 1');
    const updated = await getWeatherHistory(consulta, consultar);
    assert.ok(Number.isFinite(Date.parse(updated.ultima_actualizacion)));
    assert.equal(updated.registros[0].temp_media, 29);
    await client.query(`INSERT INTO historial_clima_fincas (finca_id, fecha, temp_media, unidades_calor_dia, precipitacion_mm)
      VALUES (1, '2026-10-06', 27, 13, 0)`);
    const { rows } = await client.query("SELECT creado_en, actualizado_en FROM historial_clima_fincas WHERE fecha = '2026-10-06'");
    assert.ok(rows[0].creado_en instanceof Date);
    assert.ok(rows[0].actualizado_en instanceof Date);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
