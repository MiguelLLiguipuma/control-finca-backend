import { ReportesService } from '../services/reportesService.js';

function parseFincaId(params) {
	const fincaId = Number(params.fincaId);
	if (!Number.isInteger(fincaId) || fincaId <= 0) {
		const err = new Error('fincaId invalido');
		err.status = 400;
		throw err;
	}
	return fincaId;
}

function parseAnio(params) {
	const anio = Number(params.anio);
	if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
		const err = new Error('anio invalido');
		err.status = 400;
		throw err;
	}
	return anio;
}

function manejarError(res, err, fallback = 500) {
	const status = Number(err?.status) || fallback;
	return res.status(status).json({ error: err.message || 'Error interno' });
}

function parseDateISO(raw) {
	if (!raw) return null;
	const value = String(raw).trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export const ReportesController = {
	async totalAnual(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			const anio = parseAnio(req.params);
			const data = await ReportesService.getTotalAnualPorAño(fincaId, anio);
			res.json(data);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async totalMensual(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			const anio = parseAnio(req.params);
			res.json(await ReportesService.getTotalMensual(fincaId, anio));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async rendimientoCintas(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			const anio = parseAnio(req.params);
			res.json(await ReportesService.getRendimientoCintas(fincaId, anio));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async mejorSemana(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			const anio = parseAnio(req.params);
			const data = await ReportesService.getMejorSemanaPorAño(fincaId, anio);
			res.json(data);
		} catch (err) {
			console.error('❌ Error mejorSemana:', err);
			manejarError(res, err);
		}
	},

	async bajasProduccion(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			res.json(await ReportesService.getBajasProduccion(fincaId));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async comparativoAnual(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			res.json(await ReportesService.getComparativoAnual(fincaId));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async promedioSemanalPorFinca(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			const anio = parseAnio(req.params);
			res.json(await ReportesService.getPromedioSemanalPorFinca(fincaId, anio));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async totalSemanal(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			const anio = parseAnio(req.params);
			const data = await ReportesService.getTotalSemanal(fincaId, anio);
			res.json(data);
		} catch (err) {
			console.error('❌ Error totalSemanal:', err);
			manejarError(res, err);
		}
	},

	async alertas(req, res) {
		try {
			const fincaId = req.query?.finca_id
				? Math.max(0, Number(req.query.finca_id) || 0)
				: null;
			const dias = Math.min(Math.max(Number(req.query?.dias) || 7, 1), 30);
			const rechazoMinPct = Math.min(
				Math.max(Number(req.query?.rechazo_min_pct) || 20, 1),
				80,
			);
			const data = await ReportesService.getAlertas({
				fincaId: fincaId || null,
				dias,
				rechazoMinPct,
			});
			res.json(data);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async auditoria(req, res) {
		try {
			const fechaDesde = parseDateISO(req.query?.fecha_desde);
			const fechaHasta = parseDateISO(req.query?.fecha_hasta);
			const accion = req.query?.accion ? String(req.query.accion).toUpperCase() : null;
			const usuarioId = req.query?.usuario_id
				? Math.max(0, Number(req.query.usuario_id) || 0)
				: null;
			const fincaId = req.query?.finca_id
				? Math.max(0, Number(req.query.finca_id) || 0)
				: null;
			const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 1000);

			const data = await ReportesService.getAuditoria({
				fechaDesde,
				fechaHasta,
				accion,
				usuarioId: usuarioId || null,
				fincaId: fincaId || null,
				limit,
			});
			res.json(data);
		} catch (err) {
			manejarError(res, err);
		}
	},
};
