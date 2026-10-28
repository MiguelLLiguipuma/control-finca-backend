import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { listarLabores, registrarLabor } from '../src/services/laboresSueloService.js';
import { ReportesModel } from '../src/models/reportesModel.js';

// Only an explicitly provided disposable, empty database. Never use DATABASE_URL.
const databaseUrl = process.env.LABORES_TEST_DATABASE_URL;
test('migracion de suelo, reintentos y aislamiento RLS en PostgreSQL real', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE fincas(id integer PRIMARY KEY, empresa_id integer, nombre text);
      CREATE TABLE usuarios(id integer PRIMARY KEY, empresa_id integer, activo boolean, nombre text);
      CREATE TABLE usuarios_fincas(usuario_id integer, finca_id integer);
      INSERT INTO fincas VALUES (1, 10, 'A'), (2, 20, 'B'), (3, 10, 'A no asignada');
      INSERT INTO usuarios VALUES (1, 10, true, 'A'), (2, 20, true, 'B');
      INSERT INTO usuarios_fincas VALUES (1, 1), (2, 2);
      CREATE TABLE registro_enfunde(id integer, finca_id integer);
      CREATE TABLE registro_cosecha(id integer, finca_id integer);
      CREATE TABLE embarque_detalles(id integer, finca_id integer, embarque_id integer);
      CREATE TABLE embarques(id integer);`);
    await client.query(await readFile(new URL('../src/db/migrations/007_fumigaciones_sanidad.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../src/db/migrations/010_rls_tenant_guardrails.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../src/db/migrations/025_labores_suelo.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../src/db/migrations/026_labores_campo_tipos.sql', import.meta.url), 'utf8'));
    const consultar = (sql, params) => client.query(sql, params);
    const user = { id: 1, rol: 'ADMIN' };
    const payload = { tipo: 'fertilizacion', fecha: '2026-01-01', intervalo_dias: 30, solicitud_id: '11111111-1111-4111-8111-111111111111', observaciones: '' };
    const first = await registrarLabor(1, user, payload, consultar);
    assert.equal(first.registro.proxima_fecha, '2026-01-31');
    assert.equal((await registrarLabor(1, user, payload, consultar)).repetido, true);
    await assert.rejects(registrarLabor(1, user, { ...payload, tipo: 'roza' }, consultar), { status: 409 });
    await assert.rejects(listarLabores(2, user, consultar), { status: 403 });
    assert.equal((await listarLabores(1, user, consultar)).registros.length, 1);
    await registrarLabor(2, { id: 2, rol: 'ADMIN' }, payload, consultar);
    await ReportesModel.registrarFumigacion({ fincaId: 1, usuarioId: 1, fechaFumigacion: '2026-01-01' }, consultar);
    await ReportesModel.registrarFumigacion({ fincaId: 2, usuarioId: 2, fechaFumigacion: '2026-01-01' }, consultar);
    await assert.rejects(ReportesModel.registrarFumigacion({ fincaId: 2, usuarioId: 1, fechaFumigacion: '2026-01-01' }, consultar), { status: 403 });
    assert.equal((await ReportesModel.obtenerFumigaciones({ usuarioId: 1 }, consultar)).length, 1);
    assert.equal((await ReportesModel.obtenerFumigaciones({ usuarioId: 1, fincaIds: [2] }, consultar)).length, 0);
    await client.query(`CREATE ROLE suelo_test_reader NOLOGIN;
      GRANT USAGE ON SCHEMA public TO suelo_test_reader;
      GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO suelo_test_reader;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO suelo_test_reader;
      SELECT set_config('app.user_id','1',true), set_config('app.empresa_id','10',true), set_config('app.role','ADMIN',true),
        set_config('app.allowed_fincas','1',true), set_config('app.scope_enforced','false',true);
      SET LOCAL ROLE suelo_test_reader;`);
    assert.equal((await client.query('SELECT * FROM labores_suelo')).rows.length, 1);
    assert.equal((await listarLabores(1, user, consultar)).registros.length, 1);
    const registered = await registrarLabor(1, user, { ...payload, solicitud_id: '22222222-2222-4222-8222-222222222222', tipo: 'roza' }, consultar);
    assert.equal(registered.registro.tipo, 'roza');
    await client.query('SAVEPOINT rejected_write');
    await assert.rejects(client.query(`INSERT INTO labores_suelo (finca_id,usuario_id,solicitud_id,tipo,fecha)
      VALUES (2,1,'33333333-3333-4333-8333-333333333333','roza','2026-01-01')`), { code: '42501' });
    await client.query('ROLLBACK TO SAVEPOINT rejected_write');
    await client.query("SELECT set_config('app.role','OPERADOR',true)");
    assert.equal((await client.query('SELECT * FROM labores_suelo')).rows.length, 2);
    await client.query('SAVEPOINT operator_write');
    await assert.rejects(client.query(`INSERT INTO labores_suelo (finca_id,usuario_id,solicitud_id,tipo,fecha)
      VALUES (1,1,'44444444-4444-4444-8444-444444444444','roza','2026-01-01')`), { code: '42501' });
    await client.query('ROLLBACK TO SAVEPOINT operator_write');
    await client.query("SELECT set_config('app.role','ADMIN',true)");
    for (const [i, tipo] of ['deshoje', 'deshije', 'riego', 'drenaje'].entries()) {
      const nueva = await registrarLabor(1, user, { ...payload, tipo, solicitud_id: `55555555-5555-4555-8555-55555555555${i}` }, consultar);
      assert.equal(nueva.registro.tipo, tipo);
    }
    const historial = await listarLabores(1, user, consultar);
    assert.equal(historial.registros.length, 6);
    assert.ok(historial.registros.every(r => r.usuario_nombre === 'A'));
    assert.equal(historial.ultimas.length, 6);
    await client.query("SELECT set_config('app.role','SUPERVISOR',true), set_config('app.scope_enforced','true',true)");
    const supervisor = { id: 1, rol: 'SUPERVISOR' };
    await assert.rejects(listarLabores(3, supervisor, consultar), { status: 403 });
    await assert.rejects(registrarLabor(3, supervisor, payload, consultar), { status: 403 });
    assert.equal((await listarLabores(1, supervisor, consultar)).registros.length, 6);
    const nueva = await registrarLabor(1, supervisor, { ...payload, tipo: 'roza', solicitud_id: '66666666-6666-4666-8666-666666666666' }, consultar);
    assert.equal(nueva.registro.usuario_id, 1);
    assert.equal((await ReportesModel.obtenerFumigaciones({ usuarioId: 1 }, consultar)).length, 1);
    await client.query("SELECT set_config('app.allowed_fincas','',true)");
    assert.equal((await client.query('SELECT * FROM labores_suelo')).rows.length, 0);
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
