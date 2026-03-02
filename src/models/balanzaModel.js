import { query } from '../db/db.js';

function buildScopedFilter(baseSql, params, fincaId, allowedFincas, columnName = 'finca_id') {
  const clauses = [];

  if (Number.isInteger(fincaId) && fincaId > 0) {
    params.push(fincaId);
    clauses.push(`${columnName} = $${params.length}`);
  }

  if (Array.isArray(allowedFincas)) {
    if (!allowedFincas.length) {
      return { sql: `${baseSql} WHERE 1=0`, params };
    }
    params.push(allowedFincas);
    clauses.push(`${columnName} = ANY($${params.length}::int[])`);
  }

  if (!clauses.length) {
    return { sql: baseSql, params };
  }

  return { sql: `${baseSql} WHERE ${clauses.join(' AND ')}`, params };
}

export const BalanzaModel = {
  async findDeviceByCredentials(deviceId, token) {
    const { rows } = await query(
      `SELECT d.id, d.device_id, d.finca_id, d.activo, f.nombre AS finca_nombre
       FROM balanza_dispositivos d
       JOIN fincas f ON f.id = d.finca_id
       WHERE d.device_id = $1 AND d.token = $2
       LIMIT 1`,
      [deviceId, token],
    );
    return rows[0] || null;
  },

  async insertEvento(payload) {
    await query(
      `INSERT INTO balanza_eventos
       (device_id, finca_id, event_type, session_id, cajas, peso_kg, peso_pico_kg, event_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        payload.deviceId,
        payload.fincaId,
        payload.eventType,
        payload.sessionId,
        payload.cajas,
        payload.pesoKg,
        payload.pesoPicoKg,
        payload.eventTs,
      ],
    );
  },

  async upsertEstadoLive(payload) {
    await query(
      `INSERT INTO balanza_estado_actual
       (device_id, finca_id, session_id, estado, cajas, peso_neto_kg, peso_pico_kg, event_ts, updated_at)
       VALUES ($1, $2, $3, 'RUN', $4, $5, NULL, $6, NOW())
       ON CONFLICT (device_id)
       DO UPDATE SET
         finca_id = EXCLUDED.finca_id,
         session_id = EXCLUDED.session_id,
         estado = 'RUN',
         cajas = EXCLUDED.cajas,
         peso_neto_kg = EXCLUDED.peso_neto_kg,
         event_ts = EXCLUDED.event_ts,
         updated_at = NOW()`,
      [
        payload.deviceId,
        payload.fincaId,
        payload.sessionId,
        payload.cajas,
        payload.pesoKg,
        payload.eventTs,
      ],
    );
  },

  async upsertEstadoSessionEnd(payload) {
    await query(
      `INSERT INTO balanza_estado_actual
       (device_id, finca_id, session_id, estado, cajas, peso_neto_kg, peso_pico_kg, event_ts, updated_at)
       VALUES ($1, $2, $3, 'IDLE', 0, 0, $4, $5, NOW())
       ON CONFLICT (device_id)
       DO UPDATE SET
         finca_id = EXCLUDED.finca_id,
         session_id = EXCLUDED.session_id,
         estado = 'IDLE',
         cajas = 0,
         peso_neto_kg = 0,
         peso_pico_kg = EXCLUDED.peso_pico_kg,
         event_ts = EXCLUDED.event_ts,
         updated_at = NOW()`,
      [
        payload.deviceId,
        payload.fincaId,
        payload.sessionId,
        payload.pesoPicoKg,
        payload.eventTs,
      ],
    );
  },

  async upsertSesion(payload) {
    await query(
      `INSERT INTO balanza_sesiones
       (device_id, finca_id, session_id, cajas, peso_pico_kg, finalizado_en)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (device_id, session_id)
       DO UPDATE SET
         finca_id = EXCLUDED.finca_id,
         cajas = EXCLUDED.cajas,
         peso_pico_kg = EXCLUDED.peso_pico_kg,
         finalizado_en = EXCLUDED.finalizado_en`,
      [
        payload.deviceId,
        payload.fincaId,
        payload.sessionId,
        payload.cajas,
        payload.pesoPicoKg,
        payload.eventTs,
      ],
    );
  },

  async getUltimaLectura(fincaId, allowedFincas) {
    const scoped = buildScopedFilter(
      `SELECT ea.session_id,
              ea.finca_id,
              f.nombre AS finca_nombre,
              ea.cajas,
              ea.peso_neto_kg,
              ea.peso_pico_kg,
              ea.estado,
              ea.event_ts AS timestamp
       FROM balanza_estado_actual ea
       JOIN fincas f ON f.id = ea.finca_id`,
      [],
      fincaId,
      allowedFincas,
      'ea.finca_id',
    );

    const { rows } = await query(
      `${scoped.sql}
       ORDER BY ea.event_ts DESC
       LIMIT 1`,
      scoped.params,
    );

    return rows[0] || null;
  },

  async getSesiones({ fincaId, allowedFincas, limit }) {
    const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const scoped = buildScopedFilter(
      `SELECT s.session_id,
              s.finca_id,
              f.nombre AS finca_nombre,
              s.cajas,
              s.peso_pico_kg,
              s.iniciado_en,
              s.finalizado_en,
              s.finalizado_en AS timestamp
       FROM balanza_sesiones s
       JOIN fincas f ON f.id = s.finca_id`,
      [],
      fincaId,
      allowedFincas,
      's.finca_id',
    );

    scoped.params.push(boundedLimit);

    const { rows } = await query(
      `${scoped.sql}
       ORDER BY s.finalizado_en DESC
       LIMIT $${scoped.params.length}`,
      scoped.params,
    );

    return rows;
  },
};
