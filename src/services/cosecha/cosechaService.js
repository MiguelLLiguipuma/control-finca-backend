import { pool } from '../../db/db.js';
import { CosechaModel } from '../../models/cosecha/cosechaModel.js';

const IDEMPOTENCIA_TTL_MS = 24 * 60 * 60 * 1000;
const idempotenciaMemoria = new Map();

function limpiarIdempotenciaExpirada() {
	const ahora = Date.now();
	for (const [idLocal, ts] of idempotenciaMemoria.entries()) {
		if (ahora - ts > IDEMPOTENCIA_TTL_MS) idempotenciaMemoria.delete(idLocal);
	}
}

function crearError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function toEnteroNoNegativo(valor) {
	const num = Number(valor);
	if (!Number.isFinite(num)) return 0;
	return Math.max(0, Math.trunc(num));
}

function normalizarDetalle(detalle) {
	return {
		calendario_id: Number(detalle.calendario_id),
		cantidad_racimos: toEnteroNoNegativo(detalle.cantidad_racimos),
		cantidad_rechazo: toEnteroNoNegativo(detalle.cantidad_rechazo),
	};
}

function validarFechaISO(fecha) {
	return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

export const CosechaService = {
	procesarLiquidacion: async (payload) => {
		limpiarIdempotenciaExpirada();

		const { id_local, finca_id, fecha, usuario_id, detalles } = payload || {};
		const fincaId = Number(finca_id);
		const usuarioId = Number(usuario_id);

		if (!fincaId) throw crearError('finca_id es requerido', 400);
		if (!usuarioId) throw crearError('usuario_id es requerido', 400);
		if (!validarFechaISO(fecha)) {
			throw crearError('fecha debe estar en formato YYYY-MM-DD', 400);
		}
		if (!Array.isArray(detalles) || !detalles.length) {
			throw crearError('detalles debe contener al menos un elemento', 400);
		}

		if (id_local && idempotenciaMemoria.has(id_local)) {
			return {
				duplicated: true,
				id_local,
				registros: [],
			};
		}

		const detallesNormalizados = detalles
			.map(normalizarDetalle)
			.filter((d) => d.cantidad_racimos > 0 || d.cantidad_rechazo > 0);

		if (!detallesNormalizados.length) {
			throw crearError('No hay cantidades válidas para registrar', 400);
		}

		for (const d of detallesNormalizados) {
			if (!Number.isInteger(d.calendario_id) || d.calendario_id <= 0) {
				throw crearError('calendario_id inválido en detalles', 400);
			}
		}

		const acumuladoPorCalendario = new Map();
		for (const d of detallesNormalizados) {
			const previo = acumuladoPorCalendario.get(d.calendario_id) || 0;
			acumuladoPorCalendario.set(
				d.calendario_id,
				previo + d.cantidad_racimos + d.cantidad_rechazo,
			);
		}

		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			for (const [calendarioId, totalSolicitado] of acumuladoPorCalendario.entries()) {
				const saldo = await CosechaModel.obtenerSaldoCalendario(
					fincaId,
					calendarioId,
					client,
				);
				if (saldo === null) {
					throw crearError(
						`Calendario ${calendarioId} no pertenece a la finca o no tiene saldo`,
						400,
					);
				}
				if (totalSolicitado > saldo) {
					throw crearError(
						`Saldo excedido en calendario ${calendarioId}. Disponible: ${saldo}, solicitado: ${totalSolicitado}`,
						409,
					);
				}
			}

			const registros = [];
			for (const item of detallesNormalizados) {
				const nuevoRegistro = await CosechaModel.insertarCosecha(
					{
						finca_id: fincaId,
						fecha,
						usuario_id: usuarioId,
						calendario_id: item.calendario_id,
						cantidad_racimos: item.cantidad_racimos,
						cantidad_rechazo: item.cantidad_rechazo,
					},
					client,
				);
				registros.push(nuevoRegistro);
			}

			await client.query('COMMIT');

			if (id_local) {
				idempotenciaMemoria.set(id_local, Date.now());
			}

			return {
				duplicated: false,
				id_local,
				registros,
			};
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	obtenerEstadoInventario: async (fincaId) => {
		return await CosechaModel.obtenerBalancePorFinca(fincaId);
	},
};
