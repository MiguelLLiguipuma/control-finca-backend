import { ReportesService } from '../services/reportesService.js';
import { autorizarFincaLabor } from '../services/laboresSueloService.js';
import { validarFechaLabor, validarObservacionesLabor } from '../utils/laborValidation.js';
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

function parseSemana(query) {
	if (!query?.semana) return null;
	const semana = Number(query.semana);
	if (!Number.isInteger(semana) || semana < 1 || semana > 53) {
		const err = new Error('semana invalida');
		err.status = 400;
		throw err;
	}
	return semana;
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

function manejarErrorFumigacion(res, err) {
	const status = Number(err?.status);
	if (status >= 400 && status < 500) return manejarError(res, err);
	return res.status(status === 503 ? 503 : 500).json({ error: 'No se pudo completar la operacion de fumigacion.' });
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

function getIsoWeekNow() {
	const now = new Date();
	const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
	return { anio: d.getUTCFullYear(), semana: weekNo };
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
			const fechaFumigacion = validarFechaLabor(req.body?.fecha_fumigacion);
			const observacion = validarObservacionesLabor(req.body?.observacion);
			// Preserve existing fumigation roles while enforcing the company boundary.
			const { id: fincaId } = await autorizarFincaLabor(req.body?.finca_id, req.user);
			const usuarioId = Number(req.user?.id || 0) || null;

			const data = await ReportesService.registrarFumigacion({
				fincaId,
				fechaFumigacion,
				observacion,
				usuarioId,
			});
			res.status(201).json(data);
		} catch (err) {
			manejarErrorFumigacion(res, err);
		}
	},

	async fumigaciones(req, res) {
		try {
			if (req.query?.finca_id !== undefined) await autorizarFincaLabor(req.query.finca_id, req.user);
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
				usuarioId: Number(req.user?.id || 0),
				limit,
			});
			res.json(data);
		} catch (err) {
			manejarErrorFumigacion(res, err);
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

	async scoreSaludSemanal(req, res) {
		try {
			const fincaId = parseFincaId(req.params);
			await asegurarAccesoFinca(req, fincaId);

			const anio = parseAnio(req.params);
			const semanaParam = parseSemana(req.query);
			const refreshRaw = String(req.query?.refresh || '').toLowerCase();
			const refresh = refreshRaw === '1' || refreshRaw === 'true';
			const { semana: semanaActual } = getIsoWeekNow();
			const semana = semanaParam || semanaActual;

			const data = await ReportesService.getScoreSaludSemanal({
				fincaId,
				anio,
				semana,
				usuarioId: Number(req.user?.id || 0) || null,
				refresh,
			});
			res.json(data || null);
		} catch (err) {
			manejarError(res, err);
		}
	},
};
