import { Router } from 'express';
import { BalanzaController } from '../controllers/balanzaController.js';
import { verificarSesion } from '../middlewares/auth.js';

const router = Router();

router.post('/eventos', BalanzaController.eventos);
router.get('/ultima-lectura', verificarSesion, BalanzaController.ultimaLectura);
router.get('/sesiones', verificarSesion, BalanzaController.sesiones);

export default router;
