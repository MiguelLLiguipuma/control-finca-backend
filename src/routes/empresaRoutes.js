import { Router } from 'express';
import { EmpresaController } from '../controllers/empresaController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();
router.use(verificarSesion);
router.get('/', EmpresaController.list);
router.get('/:id', EmpresaController.get);
router.post('/', autorizarRoles('ADMIN'), EmpresaController.create);
router.put('/:id', autorizarRoles('ADMIN'), EmpresaController.update);
router.delete('/:id', autorizarRoles('ADMIN'), EmpresaController.remove);
export default router;
