import { ReportesModel } from '../models/reportesModel.js';

export const ReportesService = {
	// ✅ Añadido fincaId en todos los métodos
	getTotalAnualPorAño(fincaId, anio, options = {}) {
		const ytd = options?.modo === 'ytd';
		if (options?.soloPropio && options?.usuarioId) {
			if (ytd) {
				return ReportesModel.obtenerTotalAnualPorAñoYtdUsuario(
					fincaId,
					anio,
					options.usuarioId,
				);
			}
			return ReportesModel.obtenerTotalAnualPorAñoUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		if (ytd) {
			return ReportesModel.obtenerTotalAnualPorAñoYtd(fincaId, anio);
		}
		return ReportesModel.obtenerTotalAnualPorAño(fincaId, anio);
	},

	getTotalMensual(fincaId, anio, options = {}) {
		const ytd = options?.modo === 'ytd';
		if (options?.soloPropio && options?.usuarioId) {
			if (ytd) {
				return ReportesModel.obtenerTotalMensualYtdUsuario(
					fincaId,
					anio,
					options.usuarioId,
				);
			}
			return ReportesModel.obtenerTotalMensualUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		if (ytd) {
			return ReportesModel.obtenerTotalMensualYtd(fincaId, anio);
		}
		return ReportesModel.obtenerTotalMensual(fincaId, anio);
	},

	getRendimientoCintas(fincaId, anio, options = {}) {
		const ytd = options?.modo === 'ytd';
		if (options?.soloPropio && options?.usuarioId) {
			if (ytd) {
				return ReportesModel.obtenerRendimientoCintasYtdUsuario(
					fincaId,
					anio,
					options.usuarioId,
				);
			}
			return ReportesModel.obtenerRendimientoCintasUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		if (ytd) {
			return ReportesModel.obtenerRendimientoCintasYtd(fincaId, anio);
		}
		return ReportesModel.obtenerRendimientoCintas(fincaId, anio);
	},

	getMejorSemanaPorAño(fincaId, anio, options = {}) {
		const ytd = options?.modo === 'ytd';
		if (options?.soloPropio && options?.usuarioId) {
			if (ytd) {
				return ReportesModel.obtenerMejorSemanaPorAñoYtdUsuario(
					fincaId,
					anio,
					options.usuarioId,
				);
			}
			return ReportesModel.obtenerMejorSemanaPorAñoUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		if (ytd) {
			return ReportesModel.obtenerMejorSemanaPorAñoYtd(fincaId, anio);
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
		const ytd = options?.modo === 'ytd';
		if (options?.soloPropio && options?.usuarioId) {
			if (ytd) {
				return ReportesModel.obtenerPromedioSemanalPorFincaYtdUsuario(
					fincaId,
					anio,
					options.usuarioId,
				);
			}
			return ReportesModel.obtenerPromedioSemanalPorFincaUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		if (ytd) {
			return ReportesModel.obtenerPromedioSemanalPorFincaYtd(fincaId, anio);
		}
		return ReportesModel.obtenerPromedioSemanalPorFinca(fincaId, anio);
	},

	getTotalSemanal(fincaId, anio, options = {}) {
		const ytd = options?.modo === 'ytd';
		if (options?.soloPropio && options?.usuarioId) {
			if (ytd) {
				return ReportesModel.obtenerTotalSemanalYtdUsuario(
					fincaId,
					anio,
					options.usuarioId,
				);
			}
			return ReportesModel.obtenerTotalSemanalUsuario(
				fincaId,
				anio,
				options.usuarioId,
			);
		}
		if (ytd) {
			return ReportesModel.obtenerTotalSemanalYtd(fincaId, anio);
		}
		return ReportesModel.obtenerTotalSemanal(fincaId, anio);
	},

	getAlertas(filtros) {
		return ReportesModel.obtenerAlertas(filtros);
	},

	registrarFumigacion(payload) {
		return ReportesModel.registrarFumigacion(payload);
	},

	getFumigaciones(filtros) {
		return ReportesModel.obtenerFumigaciones(filtros);
	},

	getAuditoria(filtros) {
		return ReportesModel.obtenerAuditoria(filtros);
	},
};
