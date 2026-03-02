import { query } from '../db/db.js';
import { BalanzaService } from '../services/balanzaService.js';

function manejarError(res, err, fallback = 500) {
  const status = Number(err?.status) || fallback;
  return res.status(status).json({ error: err.message || 'Error interno' });
}

function normalizeRole(role) {
  const raw = String(role || '').trim().toUpperCase();
  if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
  if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
  return raw;
}

async function getFincasPermitidasByUser(usuarioId) {
  const { rows } = await query(
    `SELECT finca_id
     FROM usuarios_fincas
     WHERE usuario_id = $1`,
    [usuarioId],
  );
  return rows.map((r) => Number(r.finca_id));
}

function parseFincaId(queryParams) {
  if (!queryParams?.finca_id) return null;
  const fincaId = Number(queryParams.finca_id);
  if (!Number.isInteger(fincaId) || fincaId <= 0) {
    const err = new Error('finca_id invalido');
    err.status = 400;
    throw err;
  }
  return fincaId;
}

async function resolveScope(req, fincaId) {
  const role = normalizeRole(req.user?.rol);
  if (role !== 'OPERADOR') {
    return { fincaId, allowedFincas: null };
  }

  const allowedFincas = await getFincasPermitidasByUser(Number(req.user?.id || 0));
  if (!allowedFincas.length) {
    return { fincaId: null, allowedFincas: [] };
  }

  if (fincaId && !allowedFincas.includes(fincaId)) {
    const err = new Error('No tiene permisos para consultar esta finca');
    err.status = 403;
    throw err;
  }

  return {
    fincaId: fincaId || null,
    allowedFincas,
  };
}

export const BalanzaController = {
  async eventos(req, res) {
    try {
      const data = await BalanzaService.procesarEvento(req.body || {});
      return res.status(200).json(data);
    } catch (err) {
      return manejarError(res, err, 400);
    }
  },

  async ultimaLectura(req, res) {
    try {
      const fincaId = parseFincaId(req.query);
      const scope = await resolveScope(req, fincaId);
      const data = await BalanzaService.getUltimaLectura(scope);
      return res.json(data || null);
    } catch (err) {
      return manejarError(res, err);
    }
  },

  async sesiones(req, res) {
    try {
      const fincaId = parseFincaId(req.query);
      const scope = await resolveScope(req, fincaId);
      const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 200);
      const data = await BalanzaService.getSesiones({ ...scope, limit });
      return res.json(data);
    } catch (err) {
      return manejarError(res, err);
    }
  },
};
