import { ReportesModel } from '../models/reportesModel.js';

export const ReportesService = {
	// ✅ Añadido fincaId en todos los métodos
	getTotalAnualPorAño(fincaId, anio, options = {}) {
		if (options?.soloPropio && options?.usuarioId) {
			return ReportesModel.obtenerTotalAnualPorAñoUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		return ReportesModel.obtenerTotalAnualPorAño(fincaId, anio);
	},

	getTotalMensual(fincaId, anio, options = {}) {
		if (options?.soloPropio && options?.usuarioId) {
			return ReportesModel.obtenerTotalMensualUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		return ReportesModel.obtenerTotalMensual(fincaId, anio);
	},

	getRendimientoCintas(fincaId, anio, options = {}) {
		if (options?.soloPropio && options?.usuarioId) {
			return ReportesModel.obtenerRendimientoCintasUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		return ReportesModel.obtenerRendimientoCintas(fincaId, anio);
	},

	getMejorSemanaPorAño(fincaId, anio, options = {}) {
		if (options?.soloPropio && options?.usuarioId) {
			return ReportesModel.obtenerMejorSemanaPorAñoUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		return ReportesModel.obtenerMejorSemanaPorAño(fincaId, anio);
	},

	getBajasProduccion(fincaId) {
		return ReportesModel.obtenerBajasProduccion(fincaId);
	},

	getComparativoAnual(fincaId) {
		return ReportesModel.obtenerComparativoAnual(fincaId);
	},

	getPromedioSemanalPorFinca(fincaId, anio, options = {}) {
		if (options?.soloPropio && options?.usuarioId) {
			return ReportesModel.obtenerPromedioSemanalPorFincaUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		return ReportesModel.obtenerPromedioSemanalPorFinca(fincaId, anio);
	},

	getTotalSemanal(fincaId, anio, options = {}) {
		if (options?.soloPropio && options?.usuarioId) {
			return ReportesModel.obtenerTotalSemanalUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		return ReportesModel.obtenerTotalSemanal(fincaId, anio);
	},

	getAlertas(filtros) {
		return ReportesModel.obtenerAlertas(filtros);
	},

	getAuditoria(filtros) {
		return ReportesModel.obtenerAuditoria(filtros);
	},
};
