import { Router } from 'express';
import { FincaController } from '../controllers/fincaController.js';

const router = Router();
router.get('/', FincaController.list);
router.get('/:id', FincaController.get);
router.post('/', FincaController.create);
router.put('/:id', FincaController.update);
router.delete('/:id', FincaController.remove);
export default router;
