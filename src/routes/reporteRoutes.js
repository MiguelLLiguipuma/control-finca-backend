import { Router } from 'express';
import { ReportesController } from '../controllers/reporteController.js';
import { verificarSesion } from '../middlewares/auth.js';

const router = Router();

// ✅ Todas las rutas ahora incluyen :fincaId para filtrar correctamente
router.get(
	'/total-anual/:fincaId/:anio',
	verificarSesion,
	ReportesController.totalAnual,
);

router.get(
	'/total-mensual/:fincaId/:anio',
	verificarSesion,
	ReportesController.totalMensual,
);

router.get(
	'/rendimiento-cintas/:fincaId/:anio',
	verificarSesion,
	ReportesController.rendimientoCintas,
);

router.get(
	'/mejor-semana/:fincaId/:anio',
	verificarSesion,
	ReportesController.mejorSemana,
);

router.get(
	'/bajas-produccion/:fincaId',
	verificarSesion,
	ReportesController.bajasProduccion,
);

router.get(
	'/comparativo-anual/:fincaId',
	verificarSesion,
	ReportesController.comparativoAnual,
);

router.get(
	'/promedio-semanal-finca/:fincaId/:anio',
	verificarSesion,
	ReportesController.promedioSemanalPorFinca,
);

router.get(
	'/total-semanal/:fincaId/:anio',
	verificarSesion,
	ReportesController.totalSemanal,
);

export default router;
