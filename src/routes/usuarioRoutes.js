import { Router } from 'express';
import { UsuarioController } from '../controllers/usuarioController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();
router.use(verificarSesion, autorizarRoles('ADMIN'));
router.get('/', UsuarioController.list);
router.get('/:id', UsuarioController.get);
router.post('/', UsuarioController.create);
router.put('/:id', UsuarioController.update);
router.delete('/:id', UsuarioController.remove);
export default router;
