import { Router } from 'express';
import { FincaController } from '../controllers/fincaController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();
router.use(verificarSesion);
router.get('/', FincaController.list);
router.get('/:id', FincaController.get);
router.post('/', autorizarRoles('ADMIN'), FincaController.create);
router.put('/:id', autorizarRoles('ADMIN'), FincaController.update);
router.delete('/:id', autorizarRoles('ADMIN'), FincaController.remove);
export default router;
