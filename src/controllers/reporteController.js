import { ReportesService } from '../services/reportesService.js';
import { query } from '../db/db.js';

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

function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	return raw;
}

async function getFincasPermitidasByUser(usuarioId) {
	const { rows } = await query(
		`SELECT finca_id
     FROM usuarios_fincas
     WHERE usuario_id = $1`,
		[usuarioId],
	);
	return rows.map((r) => Number(r.finca_id));
}

async function asegurarAccesoFinca(req, fincaId) {
	const role = normalizeRole(req.user?.rol);
	if (role !== 'OPERADOR') return;
	const userId = Number(req.user?.id || 0);
	const permitidas = await getFincasPermitidasByUser(userId);
	if (!permitidas.includes(Number(fincaId))) {
		const err = new Error(
			'No tiene permisos para consultar datos de esta finca',
		);
		err.status = 403;
		throw err;
	}
}

function parseDateISO(raw) {
	if (!raw) return null;
	const value = String(raw).trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function esOperador(req) {
	return normalizeRole(req.user?.rol) === 'OPERADOR';
}

function scopeReportes(req) {
	return {
		soloPropio: esOperador(req),
		usuarioId: Number(req.user?.id || 0),
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
			console.error('❌ Error mejorSemana:', err);
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
			console.error('❌ Error totalSemanal:', err);
			manejarError(res, err);
		}
	},

	async alertas(req, res) {
		try {
			const fincaId = req.query?.finca_id
				? Math.max(0, Number(req.query.finca_id) || 0)
				: null;
			const role = normalizeRole(req.user?.rol);
			let fincaFilter = fincaId || null;
			if (role === 'OPERADOR') {
				const permitidas = await getFincasPermitidasByUser(
					Number(req.user?.id || 0),
				);
				if (!permitidas.length) return res.json([]);
				if (fincaFilter && !permitidas.includes(Number(fincaFilter))) {
					return res
						.status(403)
						.json({ error: 'No tiene permisos para consultar alertas de esta finca' });
				}
				// Si no envía finca, acotamos a la primera permitida para evitar visión global.
				fincaFilter = fincaFilter || permitidas[0];
			}
			const dias = Math.min(Math.max(Number(req.query?.dias) || 7, 1), 30);
			const rechazoMinPct = Math.min(
				Math.max(Number(req.query?.rechazo_min_pct) || 20, 1),
				80,
			);
			const data = await ReportesService.getAlertas({
				fincaId: fincaFilter,
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
