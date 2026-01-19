import { ReportesModel } from '../models/reportesModel.js';

export const ReportesService = {
	// ✅ Añadido fincaId en todos los métodos
	getTotalAnualPorAño(fincaId, anio) {
		return ReportesModel.obtenerTotalAnualPorAño(fincaId, anio);
	},

	getTotalMensual(fincaId, anio) {
		return ReportesModel.obtenerTotalMensual(fincaId, anio);
	},

	getRendimientoCintas(fincaId, anio) {
		return ReportesModel.obtenerRendimientoCintas(fincaId, anio);
	},

	getMejorSemanaPorAño(fincaId, anio) {
		return ReportesModel.obtenerMejorSemanaPorAño(fincaId, anio);
	},

	getBajasProduccion(fincaId) {
		return ReportesModel.obtenerBajasProduccion(fincaId);
	},

	getComparativoAnual(fincaId) {
		return ReportesModel.obtenerComparativoAnual(fincaId);
	},

	getPromedioSemanalPorFinca(fincaId, anio) {
		return ReportesModel.obtenerPromedioSemanalPorFinca(fincaId, anio);
	},

	getTotalSemanal(fincaId, anio) {
		return ReportesModel.obtenerTotalSemanal(fincaId, anio);
	},
};
