import { Router } from 'express';
import { CintaController } from '../controllers/cintaController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();
router.use(verificarSesion);
router.get('/', CintaController.list);
router.get('/:id', CintaController.get);
router.post('/', autorizarRoles('ADMIN', 'SUPERVISOR'), CintaController.create);
router.put('/:id', autorizarRoles('ADMIN', 'SUPERVISOR'), CintaController.update);
router.delete('/:id', autorizarRoles('ADMIN', 'SUPERVISOR'), CintaController.remove);
export default router;
