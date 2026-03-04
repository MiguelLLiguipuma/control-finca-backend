import { Router } from 'express';
import { CalendarioController } from '../controllers/calendarioController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();
router.use(verificarSesion);

router.get('/resumen', CalendarioController.getResumen); // GET /api/calendarios-enfunde/resumen

router.get('/', CalendarioController.list);
router.get('/:id', CalendarioController.get);
router.post('/', autorizarRoles('ADMIN', 'SUPERVISOR'), CalendarioController.create); // <-- Esta es la que usa el Frontend
router.put('/:id', autorizarRoles('ADMIN', 'SUPERVISOR'), CalendarioController.update);
router.delete('/:id', autorizarRoles('ADMIN', 'SUPERVISOR'), CalendarioController.remove);
// ...

export default router;
