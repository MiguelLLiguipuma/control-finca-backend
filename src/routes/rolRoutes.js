import { Router } from 'express';
import { RolController } from '../controllers/rolController.js';

const router = Router();
router.get('/', RolController.list);
router.get('/:id', RolController.get);
router.post('/', RolController.create);
router.put('/:id', RolController.update);
router.delete('/:id', RolController.remove);

export default router;
