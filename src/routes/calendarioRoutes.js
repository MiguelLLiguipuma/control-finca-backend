import { Router } from 'express';
import { CalendarioController } from '../controllers/calendarioController.js';

const router = Router();

router.get('/resumen', CalendarioController.getResumen); // GET /api/calendarios-enfunde/resumen

router.get('/', CalendarioController.list);
router.get('/:id', CalendarioController.get);
router.post('/', CalendarioController.create); // <-- Esta es la que usa el Frontend
router.put('/:id', CalendarioController.update);
router.delete('/:id', CalendarioController.remove);
// ...

export default router;
