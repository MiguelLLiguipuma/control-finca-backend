import { Router } from 'express';
import { AlertaController } from '../controllers/alertaController.js';
import { verificarSesion } from '../middlewares/auth.js';
import { autorizarRoles } from '../middlewares/authorizeRoles.js';

const router = Router();

router.use(verificarSesion);

router.get('/', AlertaController.listar);
router.get('/resumen', AlertaController.resumen);
router.get(
	'/contactos',
	autorizarRoles('ADMIN', 'SUPERVISOR'),
	AlertaController.listarContactos,
);
router.put(
	'/contactos/:usuarioId',
	autorizarRoles('ADMIN', 'SUPERVISOR'),
	AlertaController.guardarContacto,
);
router.post(
	'/generar',
	autorizarRoles('ADMIN', 'SUPERVISOR'),
	AlertaController.generar,
);
router.patch('/:id/leida', AlertaController.marcarLeida);
router.patch(
	'/:id/resolver',
	autorizarRoles('ADMIN', 'SUPERVISOR'),
	AlertaController.resolver,
);

export default router;
