import express from 'express';
// Importaciones con rutas relativas corregidas
import {
	registrarCosecha,
	getBalanceCampo,
} from '../../controllers/cosecha/cosechaController.js';

import { obtenerPrediccionCosecha } from '../../controllers/cosecha/prediccionController.js';

const router = express.Router();

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

/**
 * @route   GET /api/cosecha/prediccion/:finca_id
 * @desc    EL MOTOR: Obtiene inventario cruzado con Unidades Calor (GDD) y proyecciones de cajas.
 */
router.get('/prediccion/:finca_id', obtenerPrediccionCosecha);

export default router;
