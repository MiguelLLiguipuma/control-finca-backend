import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/db.js';
import { CosechaModel } from '../src/models/cosecha/cosechaModel.js';
import { CosechaService } from '../src/services/cosecha/cosechaService.js';

const payload = {
  id_local: '11111111-1111-4111-8111-111111111111', finca_id: 4, fecha: '2026-09-17',
  detalles: [{ calendario_id: 388, cantidad_racimos: 3, cantidad_rechazo: 1 }],
};
const contexto = { usuarioIdSesion: 1, rolUsuario: 'ADMIN' };

function preparar(t) {
  const state = { rows: new Map(), harvests: [], events: [], failComplete: false, failConnect: false };
  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('to_regclass')) return { rows: [{ reg: 'cosecha_idempotencia' }] };
    if (sql.includes('DELETE FROM cosecha_idempotencia')) return { rows: [] };
    throw new Error('La idempotencia debe usar el cliente de la transaccion');
  });
  t.mock.method(pool, 'connect', async () => {
    if (state.failConnect) throw new Error('conexion fallida');
    const client = {
      rows: null, harvests: [],
      async query(sql, args = []) {
        state.events.push(sql.trim().split(/\s+/).slice(0, 4).join(' '));
        if (sql === 'BEGIN') {
          this.rows = structuredClone(state.rows);
          this.harvests = [...state.harvests];
          return { rows: [] };
        }
        if (sql === 'COMMIT') { state.rows = this.rows; state.harvests = this.harvests; return { rows: [] }; }
        if (sql === 'ROLLBACK') { this.rows = null; return { rows: [] }; }
        if (sql.includes('INSERT INTO cosecha_idempotencia')) {
          if (this.rows.has(args[0])) return { rows: [] };
          this.rows.set(args[0], { id_local: args[0], payload_hash: args[1], status: 'processing' });
          return { rows: [{ id_local: args[0] }] };
        }
        if (sql.includes('SELECT id_local')) return { rows: [this.rows.get(args[0])] };
        if (sql.includes("SET status = 'completed'")) {
          if (state.failComplete) throw new Error('fallo al guardar respuesta');
          Object.assign(this.rows.get(args[0]), { status: 'completed', response_json: JSON.parse(args[1]) });
          return { rows: [] };
        }
        throw new Error('SQL inesperado en prueba');
      },
      release() { state.events.push('RELEASE'); },
    };
    return client;
  });
  t.mock.method(CosechaModel, 'insertarCosechaLoteAtomic', async (data, client) => {
    state.events.push('COSECHA');
    client.harvests.push(data);
    return [{ id: client.harvests.length, cantidad_racimos: 3 }];
  });
  return state;
}

test('reserva, cosecha y respuesta se confirman juntas; reintento devuelve lo ya guardado', async (t) => {
  const state = preparar(t);
  const first = await CosechaService.procesarLiquidacion(payload, contexto);
  assert.equal(first.duplicated, false);
  assert.ok(state.events.indexOf('BEGIN') < state.events.indexOf('INSERT INTO cosecha_idempotencia (id_local,'));
  assert.ok(state.events.findIndex(e => e.startsWith('UPDATE cosecha_idempotencia')) < state.events.indexOf('COMMIT'));
  const retry = await CosechaService.procesarLiquidacion(payload, contexto);
  assert.equal(retry.duplicated, true);
  assert.deepEqual(retry.registros, first.registros);
  assert.equal(state.harvests.length, 1);
});

test('fallo al guardar respuesta revierte tambien la cosecha y permite reintentar', async (t) => {
  const state = preparar(t);
  state.failComplete = true;
  await assert.rejects(CosechaService.procesarLiquidacion(payload, contexto), /guardar respuesta/);
  assert.equal(state.harvests.length, 0);
  assert.equal(state.rows.size, 0);
  assert.ok(state.events.includes('ROLLBACK'));
  assert.ok(!state.events.includes('COMMIT'));
  state.failComplete = false;
  await CosechaService.procesarLiquidacion(payload, contexto);
  assert.equal(state.harvests.length, 1);
});

test('conexion fallida no deja una reserva bloqueada', async (t) => {
  const state = preparar(t);
  state.failConnect = true;
  await assert.rejects(CosechaService.procesarLiquidacion(payload, contexto), /conexion fallida/);
  assert.equal(state.rows.size, 0);
  assert.equal(state.events.length, 0);
});

test('un UUID reutilizado con cantidades distintas se rechaza sin otra cosecha', async (t) => {
  const state = preparar(t);
  await CosechaService.procesarLiquidacion(payload, contexto);
  await assert.rejects(CosechaService.procesarLiquidacion({
    ...payload, detalles: [{ ...payload.detalles[0], cantidad_racimos: 4 }],
  }, contexto), e => e.status === 409);
  assert.equal(state.harvests.length, 1);
});

test('rechaza cantidades negativas, fraccionarias y detalles nulos antes de escribir', async (t) => {
  const state = preparar(t);
  for (const detalle of [null, { calendario_id: 388, cantidad_racimos: -1 }, { calendario_id: 388, cantidad_racimos: 1.5 }]) {
    await assert.rejects(CosechaService.procesarLiquidacion({ ...payload, detalles: [detalle] }, contexto), e => e.status === 400);
  }
  assert.equal(state.harvests.length, 0);
  assert.equal(state.events.length, 0);
});
