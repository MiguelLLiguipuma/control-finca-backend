import express from 'express';
// Subimos dos niveles:
// 1. Salimos de la carpeta 'cosecha'
// 2. Salimos de la carpeta 'routes'
import {
	registrarCosecha,
	getBalanceCampo,
} from '../../controllers/cosecha/cosechaController.js';
import { obtenerPrediccionCosecha } from '../../controllers/cosecha/prediccionController.js';

const router = express.Router();

router.post('/registrar-liquidacion', registrarCosecha);
router.get('/balance/:fincaId', getBalanceCampo);
// Ruta para obtener la predicción de una finca específica
router.get('/prediccion/:finca_id', obtenerPrediccionCosecha);

export default router;
