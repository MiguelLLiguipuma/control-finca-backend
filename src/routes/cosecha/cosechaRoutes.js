import express from 'express';
import {
	registrarCosecha,
	getBalanceCampo,
	getFechasOcupadas,
	getInventarioHistorico,
	cerrarInventarioHistorico,
} from '../../controllers/cosecha/cosechaController.js';
import {
	obtenerPrediccionCosecha,
	obtenerPrediccionCosechaMulti,
	obtenerProyeccionEmbarqueComparativa,
} from '../../controllers/cosecha/prediccionController.js';
import { verificarSesion } from '../../middlewares/auth.js';
import { autorizarRoles } from '../../middlewares/authorizeRoles.js';

const router = express.Router();

router.use(verificarSesion);

/**
 * @route   POST /api/cosecha/registrar-liquidacion
 * @desc    Registra la cosecha física y dispara el Trigger SQL 80/20 para actualizar ratios.
 */
router.post('/registrar-liquidacion', registrarCosecha);

/**
 * @route   GET /api/cosecha/balance/:fincaId
 * @desc    Obtiene el balance de inventario plano (Legacy/Compatibilidad).
 */
router.get('/balance/:fincaId', getBalanceCampo);
router.get('/fechas-ocupadas', getFechasOcupadas);
router.get('/inventario-historico', getInventarioHistorico);
router.post(
	'/inventario-historico/cerrar',
	autorizarRoles('ADMIN', 'SUPERVISOR'),
	cerrarInventarioHistorico,
);

/**
 * @route   GET /api/cosecha/prediccion/:finca_id
 * @desc    EL MOTOR: Obtiene inventario cruzado con Unidades Calor (GDD) y proyecciones de cajas.
 */
router.get('/prediccion/:finca_id', obtenerPrediccionCosecha);
router.get('/prediccion-multi', obtenerPrediccionCosechaMulti);
router.get(
	'/prediccion-embarque-comparativa/:finca_id',
	obtenerProyeccionEmbarqueComparativa,
);

export default router;
