import { Router } from 'express';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';
import { listarLabores, registrarLabor } from '../services/laboresSueloService.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(verificarSesion);
function responderError(res, error) {
  const status = Number(error.status) || (error.code === '42P01' ? 503 : 500);
  logger.error('labores_suelo_error', { code: error.code || null, status });
  return res.status(status).json({ message: status < 500 ? error.message : error.code === '42P01'
    ? 'El registro de labores de suelo requiere actualizar la base de datos.' : 'No se pudo completar la operacion de suelo.' });
}
router.get('/', autorizarRoles('ADMIN', 'SUPERVISOR', 'OPERADOR'), async (req, res) => {
  try { res.json(await listarLabores(req.query.finca_id, req.user)); }
  catch (error) { responderError(res, error); }
});
router.post('/', autorizarRoles('ADMIN', 'SUPERVISOR'), async (req, res) => {
  try { const data = await registrarLabor(req.body?.finca_id, req.user, req.body); res.status(data.repetido ? 200 : 201).json(data); }
  catch (error) { responderError(res, error); }
});
export default router;
