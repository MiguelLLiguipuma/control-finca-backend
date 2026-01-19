import { Router } from 'express';
import { EmpresaController } from '../controllers/empresaController.js';

const router = Router();
router.get('/', EmpresaController.list);
router.get('/:id', EmpresaController.get);
router.post('/', EmpresaController.create);
router.put('/:id', EmpresaController.update);
router.delete('/:id', EmpresaController.remove);
export default router;
