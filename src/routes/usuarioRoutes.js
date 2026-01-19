import { Router } from 'express';
import { UsuarioController } from '../controllers/usuarioController.js';

const router = Router();
router.get('/', UsuarioController.list);
router.get('/:id', UsuarioController.get);
router.post('/', UsuarioController.create);
router.put('/:id', UsuarioController.update);
router.delete('/:id', UsuarioController.remove);
export default router;
