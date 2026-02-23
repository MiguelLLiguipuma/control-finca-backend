import { Router } from 'express';
import { RolController } from '../controllers/rolController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();
router.use(verificarSesion, autorizarRoles('ADMIN'));
router.get('/', RolController.list);
router.get('/:id', RolController.get);
router.post('/', RolController.create);
router.put('/:id', RolController.update);
router.delete('/:id', RolController.remove);

export default router;
