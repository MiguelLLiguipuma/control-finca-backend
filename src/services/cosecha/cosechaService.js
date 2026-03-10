import crypto from 'crypto';
import { pool } from '../../db/db.js';
import { CosechaModel } from '../../models/cosecha/cosechaModel.js';
import {
	applyFincaScopeToRequestedIds,
	assertFincaInScope,
	resolveFincaScope,
} from '../../utils/accessScope.js';

const IDEMPOTENCIA_RETENCION_DIAS = 30;
const LIMPIEZA_INTERVALO_MS = 60 * 60 * 1000;
let ultimaLimpieza = 0;
let schemaIdempotenciaInicializado;
const ALLOW_RUNTIME_DDL = String(process.env.ALLOW_RUNTIME_DDL || 'false').toLowerCase() === 'true';

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

function validarFechaISO(fecha) {
	if (typeof fecha !== 'string') return false;
	const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return false;
	}
	const d = new Date(Date.UTC(year, month - 1, day));
	return (
		d.getUTCFullYear() === year &&
		d.getUTCMonth() + 1 === month &&
		d.getUTCDate() === day
	);
}

function normalizarFechaISO(fecha) {
	if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
		return fecha.toISOString().slice(0, 10);
	}
	if (typeof fecha !== 'string') return null;
	const raw = fecha.trim();
	const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	return match ? match[1] : null;
}

function parsearFincaIds(inputIds, inputId) {
	const ids = new Set();

	if (Array.isArray(inputIds)) {
		for (const value of inputIds) {
			const n = Number(value);
			if (Number.isInteger(n) && n > 0) ids.add(n);
		}
	} else if (typeof inputIds === 'string') {
		for (const part of inputIds.split(',')) {
			const n = Number(String(part).trim());
			if (Number.isInteger(n) && n > 0) ids.add(n);
		}
	}

	const single = Number(inputId);
	if (Number.isInteger(single) && single > 0) ids.add(single);

	return Array.from(ids);
}

function esUuid(val) {
	if (typeof val !== 'string') return false;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		val,
	);
}

function normalizarDetalle(detalle) {
	return {
		calendario_id: Number(detalle.calendario_id),
		cantidad_racimos: toEnteroNoNegativo(detalle.cantidad_racimos),
		cantidad_rechazo: toEnteroNoNegativo(detalle.cantidad_rechazo),
	};
}

function hashPayload(payload) {
	return crypto
		.createHash('sha256')
		.update(JSON.stringify(payload))
		.digest('hex');
}

async function obtenerTablasFaltantes(tablas) {
	const faltantes = [];
	for (const tabla of tablas) {
		const r = await pool.query('SELECT to_regclass($1) AS reg', [
			`public.${tabla}`,
		]);
		if (!r.rows?.[0]?.reg) faltantes.push(tabla);
	}
	return faltantes;
}

async function asegurarTablaIdempotencia() {
	if (!schemaIdempotenciaInicializado) {
		schemaIdempotenciaInicializado = (async () => {
			const faltantes = await obtenerTablasFaltantes(['cosecha_idempotencia']);
			if (!faltantes.length) return;

			if (!ALLOW_RUNTIME_DDL) {
				throw crearError(
					`Esquema incompleto: faltan tablas [${faltantes.join(', ')}]. Ejecute: npm run migrate`,
					500,
				);
			}

			console.warn(
				`[DDL-RUNTIME] Creando tablas faltantes de cosecha: ${faltantes.join(', ')}`,
			);

			await pool.query(`
				CREATE TABLE IF NOT EXISTS cosecha_idempotencia (
					id_local UUID PRIMARY KEY,
					payload_hash TEXT NOT NULL,
					status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
					response_json JSONB,
					error_message TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_cosecha_idempotencia_status_updated
				ON cosecha_idempotencia(status, updated_at DESC)
			`);
		})();
	}
	await schemaIdempotenciaInicializado;
}

async function limpiarIdempotenciaAntiguaSiAplica() {
	const ahora = Date.now();
	if (ahora - ultimaLimpieza < LIMPIEZA_INTERVALO_MS) return;
	ultimaLimpieza = ahora;

	await pool.query(
		`DELETE FROM cosecha_idempotencia
     WHERE updated_at < NOW() - ($1::text || ' days')::interval`,
		[String(IDEMPOTENCIA_RETENCION_DIAS)],
	);
}

async function reservarIdempotencia(idLocal, payloadHash) {
	await asegurarTablaIdempotencia();
	await limpiarIdempotenciaAntiguaSiAplica();

	const insertRes = await pool.query(
		`INSERT INTO cosecha_idempotencia (id_local, payload_hash, status)
     VALUES ($1, $2, 'processing')
     ON CONFLICT (id_local) DO NOTHING
     RETURNING id_local`,
		[idLocal, payloadHash],
	);

	if (insertRes.rows.length) {
		return { reservar: true };
	}

	const existenteRes = await pool.query(
		`SELECT id_local, payload_hash, status, response_json
     FROM cosecha_idempotencia
     WHERE id_local = $1`,
		[idLocal],
	);

	if (!existenteRes.rows.length) {
		throw crearError('No se pudo verificar idempotencia', 500);
	}

	const existente = existenteRes.rows[0];

	if (existente.payload_hash !== payloadHash) {
		throw crearError(
			'El id_local ya fue usado con un payload distinto',
			409,
		);
	}

	if (existente.status === 'completed') {
		return {
			reservar: false,
			duplicated: true,
			response: existente.response_json || null,
		};
	}

	if (existente.status === 'processing') {
		throw crearError('La liquidacion ya esta en procesamiento', 409);
	}

	const retryRes = await pool.query(
		`UPDATE cosecha_idempotencia
     SET status = 'processing',
         error_message = NULL,
         updated_at = NOW()
     WHERE id_local = $1
       AND status = 'failed'
       AND payload_hash = $2
     RETURNING id_local`,
		[idLocal, payloadHash],
	);

	if (!retryRes.rows.length) {
		throw crearError('No fue posible retomar la liquidacion', 409);
	}

	return { reservar: true };
}

async function marcarIdempotenciaCompletada(idLocal, responseObj) {
	if (!idLocal) return;
	await pool.query(
		`UPDATE cosecha_idempotencia
     SET status = 'completed',
         response_json = $2::jsonb,
         error_message = NULL,
         updated_at = NOW()
     WHERE id_local = $1`,
		[idLocal, JSON.stringify(responseObj || {})],
	);
}

async function marcarIdempotenciaFallida(idLocal, errorMessage) {
	if (!idLocal) return;
	try {
		await pool.query(
			`UPDATE cosecha_idempotencia
       SET status = 'failed',
           error_message = $2,
           updated_at = NOW()
       WHERE id_local = $1`,
			[idLocal, errorMessage || 'Error desconocido'],
		);
	} catch {
		// No interrumpimos el flujo por fallo de trazabilidad
	}
}

export const CosechaService = {
	procesarLiquidacion: async (payload, contexto = {}) => {
		const { id_local, finca_id, fecha, detalles } = payload || {};
		const fincaId = Number(finca_id);
		const fechaIso = normalizarFechaISO(fecha);
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});

		if (!fincaId) throw crearError('finca_id es requerido', 400);
		if (!usuarioId) throw crearError('Sesión inválida: usuario no autenticado', 401);
		assertFincaInScope(fincaId, scope);
		if (!fechaIso || !validarFechaISO(fechaIso)) {
			throw crearError('fecha debe estar en formato YYYY-MM-DD', 400);
		}
		if (!Array.isArray(detalles) || !detalles.length) {
			throw crearError('detalles debe contener al menos un elemento', 400);
		}

		if (id_local && !esUuid(id_local)) {
			throw crearError('id_local invalido, debe ser UUID', 400);
		}

		const detallesNormalizados = detalles
			.map(normalizarDetalle)
			.filter((d) => d.cantidad_racimos > 0 || d.cantidad_rechazo > 0);
		const detallesOrdenados = [...detallesNormalizados].sort(
			(a, b) => a.calendario_id - b.calendario_id,
		);

		if (!detallesOrdenados.length) {
			throw crearError('No hay cantidades válidas para registrar', 400);
		}

		for (const d of detallesOrdenados) {
			if (!Number.isInteger(d.calendario_id) || d.calendario_id <= 0) {
				throw crearError('calendario_id inválido en detalles', 400);
			}
		}

			const payloadCanonico = {
				finca_id: fincaId,
				fecha: fechaIso,
				usuario_id: usuarioId,
				detalles: detallesOrdenados,
			};
			const payloadHash = hashPayload(payloadCanonico);

		if (id_local) {
			const estadoIdempotencia = await reservarIdempotencia(
				id_local,
				payloadHash,
			);

			if (estadoIdempotencia.duplicated) {
				return {
					duplicated: true,
					id_local,
					...(estadoIdempotencia.response || { registros: [] }),
				};
			}
		}

			const client = await pool.connect();
			try {
				await client.query('BEGIN');

				const registros = await CosechaModel.insertarCosechaLoteAtomic(
					{
						finca_id: fincaId,
						usuario_id: usuarioId,
						fecha: fechaIso,
						detalles: detallesOrdenados,
					},
					client,
				);

				await client.query('COMMIT');

				const responseObj = {
					registros,
					total: registros.length,
				};
				await marcarIdempotenciaCompletada(id_local, responseObj);

				return {
					duplicated: false,
					id_local,
					...responseObj,
				};
			} catch (error) {
			await client.query('ROLLBACK');
			await marcarIdempotenciaFallida(id_local, error.message);
			throw error;
		} finally {
			client.release();
		}
	},

	obtenerEstadoInventario: async (fincaId, contexto = {}) => {
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});
		assertFincaInScope(Number(fincaId), scope);
		return await CosechaModel.obtenerBalancePorFinca(fincaId);
	},

	obtenerFechasOcupadas: async (query = {}, contexto = {}) => {
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});
		const requestedFincaIds = parsearFincaIds(query.finca_ids, query.finca_id);

		const fechaHastaNormalizada =
			normalizarFechaISO(query.fecha_hasta) || new Date().toISOString().slice(0, 10);
		const fechaDesdeNormalizada =
			normalizarFechaISO(query.fecha_desde) ||
			new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

		if (
			!validarFechaISO(fechaDesdeNormalizada) ||
			!validarFechaISO(fechaHastaNormalizada)
		) {
			throw crearError('fecha_desde/fecha_hasta invalidas (YYYY-MM-DD)', 400);
		}
		const fincaIds = applyFincaScopeToRequestedIds(requestedFincaIds, scope);
		if (!fincaIds.length) {
			if (!scope.enforce) {
				throw crearError('Debe enviar finca_id o finca_ids valido(s)', 400);
			}
			return {
				finca_ids: [],
				fecha_desde: fechaDesdeNormalizada,
				fecha_hasta: fechaHastaNormalizada,
				fechas: [],
			};
		}

		const cosechaRes = await pool.query(
			`SELECT DISTINCT rc.fecha::date AS fecha
       FROM registro_cosecha rc
       WHERE rc.finca_id = ANY($1::int[])
         AND rc.fecha BETWEEN $2 AND $3
       ORDER BY rc.fecha ASC`,
			[fincaIds, fechaDesdeNormalizada, fechaHastaNormalizada],
		);

		const voucherRes = await pool.query(
			`SELECT DISTINCT e.fecha_embarque::date AS fecha
       FROM embarques e
       WHERE e.fecha_embarque BETWEEN $2 AND $3
         AND EXISTS (
           SELECT 1
           FROM embarque_detalles d
           WHERE d.embarque_id = e.id
             AND d.finca_id = ANY($1::int[])
         )
       ORDER BY e.fecha_embarque ASC`,
			[fincaIds, fechaDesdeNormalizada, fechaHastaNormalizada],
		);

		const mapFechas = new Map();
		for (const row of cosechaRes.rows) {
			const fecha = normalizarFechaISO(row.fecha);
			if (!fecha) continue;
			const entry = mapFechas.get(fecha) || { fecha, cosecha: false, voucher: false };
			entry.cosecha = true;
			mapFechas.set(fecha, entry);
		}
		for (const row of voucherRes.rows) {
			const fecha = normalizarFechaISO(row.fecha);
			if (!fecha) continue;
			const entry = mapFechas.get(fecha) || { fecha, cosecha: false, voucher: false };
			entry.voucher = true;
			mapFechas.set(fecha, entry);
		}

		const fechas = Array.from(mapFechas.values()).sort((a, b) =>
			a.fecha.localeCompare(b.fecha),
		);

		return {
			finca_ids: fincaIds,
			fecha_desde: fechaDesdeNormalizada,
			fecha_hasta: fechaHastaNormalizada,
			fechas,
		};
		},
	};

export const __cosechaServiceInternals = {
	validarFechaISO,
};
