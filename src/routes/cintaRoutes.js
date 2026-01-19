import { Router } from 'express';
import { CintaController } from '../controllers/cintaController.js';

const router = Router();
router.get('/', CintaController.list);
router.get('/:id', CintaController.get);
router.post('/', CintaController.create);
router.put('/:id', CintaController.update);
router.delete('/:id', CintaController.remove);
export default router;
