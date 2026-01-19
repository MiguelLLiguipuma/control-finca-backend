import { Router } from 'express';
import { RegistroController } from '../controllers/registroController.js';

const router = Router();
router.get('/', RegistroController.list);
router.get('/:id', RegistroController.get);
router.post('/', RegistroController.create);
router.put('/:id', RegistroController.update);
router.delete('/:id', RegistroController.remove);
// Esta línea debe coincidir exactamente con la URL que falló en tu consola
router.get('/finca/:fincaId/:anio', RegistroController.getByFinca);
export default router;
