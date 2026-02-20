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
};
