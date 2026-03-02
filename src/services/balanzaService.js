import { BalanzaModel } from '../models/balanzaModel.js';

function toPositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`${fieldName} invalido`);
    err.status = 400;
    throw err;
  }
  return n;
}

function toNonNegativeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    const err = new Error(`${fieldName} invalido`);
    err.status = 400;
    throw err;
  }
  return n;
}

function toNonNegativeFloat(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error(`${fieldName} invalido`);
    err.status = 400;
    throw err;
  }
  return Number(n.toFixed(3));
}

function parseEventType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (type !== 'live' && type !== 'session_end') {
    const err = new Error('event invalido');
    err.status = 400;
    throw err;
  }
  return type;
}

function parseTimestamp(raw) {
  if (!raw) return new Date();
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    const err = new Error('timestamp invalido');
    err.status = 400;
    throw err;
  }
  return d;
}

export const BalanzaService = {
  async procesarEvento(payload) {
    const deviceId = String(payload?.id || '').trim();
    const token = String(payload?.token || '').trim();

    if (!deviceId || !token) {
      const err = new Error('id/token requeridos');
      err.status = 400;
      throw err;
    }

    const device = await BalanzaModel.findDeviceByCredentials(deviceId, token);
    if (!device || device.activo !== true) {
      const err = new Error('dispositivo no autorizado');
      err.status = 401;
      throw err;
    }

    const eventType = parseEventType(payload?.event);
    const sessionId = toPositiveInt(payload?.session_id, 'session_id');
    const cajas = toNonNegativeInt(payload?.cajas, 'cajas');
    const eventTs = parseTimestamp(payload?.timestamp);

    const baseEvent = {
      deviceId,
      fincaId: Number(device.finca_id),
      eventType,
      sessionId,
      cajas,
      eventTs,
      pesoKg: null,
      pesoPicoKg: null,
    };

    if (eventType === 'live') {
      baseEvent.pesoKg = toNonNegativeFloat(payload?.peso_kg, 'peso_kg');
    }

    if (eventType === 'session_end') {
      baseEvent.pesoPicoKg = toNonNegativeFloat(payload?.peso_pico_kg, 'peso_pico_kg');
    }

    await BalanzaModel.insertEvento(baseEvent);

    if (eventType === 'live') {
      await BalanzaModel.upsertEstadoLive(baseEvent);
    } else {
      await BalanzaModel.upsertSesion(baseEvent);
      await BalanzaModel.upsertEstadoSessionEnd(baseEvent);
    }

    return {
      ok: true,
      stored: true,
      finca_id: Number(device.finca_id),
      finca_nombre: device.finca_nombre,
    };
  },

  async getUltimaLectura({ fincaId, allowedFincas }) {
    return BalanzaModel.getUltimaLectura(fincaId, allowedFincas);
  },

  async getSesiones({ fincaId, allowedFincas, limit }) {
    const rows = await BalanzaModel.getSesiones({ fincaId, allowedFincas, limit });
    return {
      items: rows,
      meta: { limit: Math.min(Math.max(Number(limit) || 20, 1), 200), count: rows.length },
    };
  },
};
