import { ReportesService } from '../services/reportesService.js';
import {
	applyFincaScopeToRequestedIds,
	assertFincaInScope,
	resolveFincaScope,
} from '../utils/accessScope.js';

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

async function asegurarAccesoFinca(req, fincaId) {
	const scope = await resolveFincaScope({
		rol: req.user?.rol,
		userId: Number(req.user?.id || 0),
	});
	assertFincaInScope(Number(fincaId), scope);
}

function parseDateISO(raw) {
	if (!raw) return null;
	const value = String(raw).trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseFincaIdFromBody(body) {
	const fincaId = Number(body?.finca_id || 0);
	if (!Number.isInteger(fincaId) || fincaId <= 0) {
		const err = new Error('finca_id invalido');
		err.status = 400;
		throw err;
	}
	return fincaId;
}

function esOperador(req) {
	const raw = String(req.user?.rol || '').trim().toUpperCase();
	return raw === 'OPERADOR' || raw === 'OPERARIO' || raw === 'TRABAJADOR';
}

function scopeReportes(req) {
	const modoRaw = String(req.query?.modo || '').trim().toLowerCase();
	const modo = modoRaw === 'ytd' ? 'ytd' : 'full';
	const scopeRaw = String(req.query?.scope || '').trim().toLowerCase();
	const scope = scopeRaw === 'propio' ? 'propio' : 'finca';
	return {
		soloPropio: esOperador(req) && scope === 'propio',
		usuarioId: Number(req.user?.id || 0),
		modo,
		scope,
	};
}

export const ReportesController = {
	async totalAnual(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			const anio = parseAnio(req.params);
			const data = await ReportesService.getTotalAnualPorAño(
				fincaId,
				anio,
				scopeReportes(req),
			);
			res.json(data);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async totalMensual(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			const anio = parseAnio(req.params);
			res.json(
				await ReportesService.getTotalMensual(
					fincaId,
					anio,
					scopeReportes(req),
				),
			);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async rendimientoCintas(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			const anio = parseAnio(req.params);
			res.json(
				await ReportesService.getRendimientoCintas(
					fincaId,
					anio,
					scopeReportes(req),
				),
			);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async mejorSemana(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			const anio = parseAnio(req.params);
			const data = await ReportesService.getMejorSemanaPorAño(
				fincaId,
				anio,
				scopeReportes(req),
			);
			res.json(data);
		} catch (err) {
			if (Number(err?.status) >= 500) {
				console.error('❌ Error mejorSemana:', err);
			}
			manejarError(res, err);
		}
	},

	async bajasProduccion(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			res.json(await ReportesService.getBajasProduccion(fincaId));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async comparativoAnual(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			res.json(await ReportesService.getComparativoAnual(fincaId));
		} catch (err) {
			manejarError(res, err);
		}
	},

	async promedioSemanalPorFinca(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			const anio = parseAnio(req.params);
			res.json(
				await ReportesService.getPromedioSemanalPorFinca(
					fincaId,
					anio,
					scopeReportes(req),
				),
			);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async totalSemanal(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);
			const anio = parseAnio(req.params);
			const data = await ReportesService.getTotalSemanal(
				fincaId,
				anio,
				scopeReportes(req),
			);
			res.json(data);
		} catch (err) {
			if (Number(err?.status) >= 500) {
				console.error('❌ Error totalSemanal:', err);
			}
			manejarError(res, err);
		}
	},

	async alertas(req, res) {
		try {
			const scope = await resolveFincaScope({
				rol: req.user?.rol,
				userId: Number(req.user?.id || 0),
			});
			const requestedFincaIds = req.query?.finca_id
				? [Math.max(0, Number(req.query.finca_id) || 0)]
				: [];
			const fincaIds = applyFincaScopeToRequestedIds(requestedFincaIds, scope);
			if (scope.enforce && !fincaIds.length) return res.json([]);
			const dias = Math.min(Math.max(Number(req.query?.dias) || 7, 1), 30);
			const rechazoMinPct = Math.min(
				Math.max(Number(req.query?.rechazo_min_pct) || 20, 1),
				80,
			);
			const data = await ReportesService.getAlertas({
				fincaIds: fincaIds.length ? fincaIds : null,
				dias,
				rechazoMinPct,
			});
			res.json(data);
		} catch (err) {
			manejarError(res, err);
		}
	},

	async registrarFumigacion(req, res) {
		try {
			const fincaId = parseFincaIdFromBody(req.body);
			await asegurarAccesoFinca(req, fincaId);

			const fechaFumigacion = parseDateISO(req.body?.fecha_fumigacion);
			if (!fechaFumigacion) {
				return res
					.status(400)
					.json({ error: 'fecha_fumigacion invalida (YYYY-MM-DD)' });
			}

			const observacion = String(req.body?.observacion || '').trim();
			const usuarioId = Number(req.user?.id || 0) || null;

			const data = await ReportesService.registrarFumigacion({
				fincaId,
				fechaFumigacion,
				observacion,
				usuarioId,
			});
			res.status(201).json(data);
		} catch (err) {
			manejarError(res, err, 400);
		}
	},

	async fumigaciones(req, res) {
		try {
			const scope = await resolveFincaScope({
				rol: req.user?.rol,
				userId: Number(req.user?.id || 0),
			});
			const requestedFincaIds = req.query?.finca_id
				? [Math.max(0, Number(req.query.finca_id) || 0)]
				: [];
			const fincaIds = applyFincaScopeToRequestedIds(requestedFincaIds, scope);
			if (scope.enforce && !fincaIds.length) return res.json([]);

			const limit = Math.min(Math.max(Number(req.query?.limit) || 30, 1), 200);
			const data = await ReportesService.getFumigaciones({
				fincaIds: fincaIds.length ? fincaIds : null,
				limit,
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
			const scope = await resolveFincaScope({
				rol: req.user?.rol,
				userId: Number(req.user?.id || 0),
			});
			const requestedFincaIds = req.query?.finca_id
				? [Math.max(0, Number(req.query.finca_id) || 0)]
				: [];
			const fincaIds = applyFincaScopeToRequestedIds(requestedFincaIds, scope);
			if (scope.enforce && !fincaIds.length) return res.json([]);
			const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 1000);

			const data = await ReportesService.getAuditoria({
				fechaDesde,
				fechaHasta,
				accion,
				usuarioId: usuarioId || null,
				fincaIds: fincaIds.length ? fincaIds : null,
				limit,
			});
			res.json(data);
		} catch (err) {
			manejarError(res, err);
		}
	},
};
