import { Router } from 'express';
import { ClimaController } from '../controllers/climaController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();

router.use(verificarSesion);
router.get('/status', ClimaController.status);
router.post('/sync', autorizarRoles('ADMIN', 'SUPERVISOR'), ClimaController.sync);

export default router;
