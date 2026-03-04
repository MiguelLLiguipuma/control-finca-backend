import { BalanzaService } from '../services/balanzaService.js';
import {
	assertFincaInScope,
	resolveFincaScope,
} from '../utils/accessScope.js';

function manejarError(res, err, fallback = 500) {
  const status = Number(err?.status) || fallback;
  return res.status(status).json({ error: err.message || 'Error interno' });
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
  const scope = await resolveFincaScope({
    rol: req.user?.rol,
    userId: Number(req.user?.id || 0),
  });
  if (fincaId) {
    assertFincaInScope(fincaId, scope);
  }
  return {
    fincaId: fincaId || null,
    allowedFincas: scope.enforce ? scope.allowedFincaIds : null,
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
