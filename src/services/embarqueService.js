import crypto from 'crypto';
import { pool } from '../db/db.js';
import {
	applyFincaScopeToRequestedIds,
	resolveFincaScope,
} from '../utils/accessScope.js';

const IDEMPOTENCIA_RETENCION_DIAS = 30;
const LIMPIEZA_INTERVALO_MS = 60 * 60 * 1000;
let ultimaLimpieza = 0;
let schemaInicializado;
const ALLOW_RUNTIME_DDL = String(process.env.ALLOW_RUNTIME_DDL || 'false').toLowerCase() === 'true';

function crearError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function toNonNegativeNumber(value, fallback = 0) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(0, n);
}

function toNonNegativeInt(value, fallback = 0) {
	return Math.trunc(toNonNegativeNumber(value, fallback));
}

function validarFechaISO(fecha) {
	return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

function normalizarFechaISO(fecha) {
	if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
		return fecha.toISOString().slice(0, 10);
	}

	if (typeof fecha !== 'string') return null;
	const raw = fecha.trim();
	if (!raw) return null;

	const matchIsoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	if (matchIsoPrefix) return matchIsoPrefix[1];

	return null;
}

function parsearFincaIds(input) {
	if (input === undefined || input === null || input === '') return [];
	const valores = Array.isArray(input) ? input : String(input).split(',');
	const ids = valores
		.map((v) => Number(String(v).trim()))
		.filter((n) => Number.isInteger(n) && n > 0);
	return Array.from(new Set(ids));
}

function esUuid(val) {
	if (typeof val !== 'string') return false;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		val,
	);
}

function hashPayload(payload) {
	return crypto
		.createHash('sha256')
		.update(JSON.stringify(payload))
		.digest('hex');
}

function normalizarDetalleLinea(linea) {
	const racimosBuenos = toNonNegativeInt(linea.racimos_buenos);
	const racimosRechazo = toNonNegativeInt(linea.racimos_rechazo);
	const totalRacimos = racimosBuenos + racimosRechazo;
	const cajas = toNonNegativeNumber(linea.cajas_embarcadas);
	const ratioComercial = racimosBuenos > 0 ? cajas / racimosBuenos : 0;
	const ratioOperativo = totalRacimos > 0 ? cajas / totalRacimos : 0;

	return {
		finca_id: Number(linea.finca_id),
		calendario_id:
			linea.calendario_id === null || linea.calendario_id === undefined
				? null
				: Number(linea.calendario_id),
		cinta_color: String(linea.cinta_color || '').trim(),
		semana_enfunde:
			linea.semana_enfunde === null || linea.semana_enfunde === undefined
				? null
				: Number(linea.semana_enfunde),
		anio_enfunde:
			linea.anio_enfunde === null || linea.anio_enfunde === undefined
				? null
				: Number(linea.anio_enfunde),
		racimos_buenos: racimosBuenos,
		racimos_rechazo: racimosRechazo,
		total_racimos: totalRacimos,
		cajas_embarcadas: Number(cajas.toFixed(2)),
		ratio_comercial_linea: Number(ratioComercial.toFixed(4)),
		ratio_operativo_linea: Number(ratioOperativo.toFixed(4)),
	};
}

function calcularTotales(detalles) {
	const base = {
		total_racimos_buenos: 0,
		total_racimos_rechazo: 0,
		total_racimos: 0,
		total_cajas: 0,
		ratio_comercial_global: 0,
		ratio_operativo_global: 0,
	};

	for (const d of detalles) {
		base.total_racimos_buenos += d.racimos_buenos;
		base.total_racimos_rechazo += d.racimos_rechazo;
		base.total_racimos += d.total_racimos;
		base.total_cajas += d.cajas_embarcadas;
	}

	base.total_cajas = Number(base.total_cajas.toFixed(2));
	base.ratio_comercial_global =
		base.total_racimos_buenos > 0
			? Number((base.total_cajas / base.total_racimos_buenos).toFixed(4))
			: 0;
	base.ratio_operativo_global =
		base.total_racimos > 0
			? Number((base.total_cajas / base.total_racimos).toFixed(4))
			: 0;

	return base;
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

async function asegurarSchema() {
	if (!schemaInicializado) {
		schemaInicializado = (async () => {
			const faltantes = await obtenerTablasFaltantes([
				'embarques',
				'embarque_detalles',
				'embarque_auditoria',
				'embarque_idempotencia',
			]);
			if (!faltantes.length) return;

			if (!ALLOW_RUNTIME_DDL) {
				throw crearError(
					`Esquema incompleto: faltan tablas [${faltantes.join(', ')}]. Ejecute: npm run migrate`,
					500,
				);
			}

			console.warn(
				`[DDL-RUNTIME] Creando tablas faltantes de embarque: ${faltantes.join(', ')}`,
			);

			await pool.query(`
				CREATE TABLE IF NOT EXISTS embarques (
					id BIGSERIAL PRIMARY KEY,
					numero_voucher VARCHAR(30) NOT NULL UNIQUE,
					fecha_embarque DATE NOT NULL,
					semana_corte SMALLINT,
					estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR'
						CHECK (estado IN ('BORRADOR', 'CONFIRMADO', 'ANULADO')),
					total_racimos_buenos INTEGER NOT NULL DEFAULT 0,
					total_racimos_rechazo INTEGER NOT NULL DEFAULT 0,
					total_racimos INTEGER NOT NULL DEFAULT 0,
					total_cajas NUMERIC(12,2) NOT NULL DEFAULT 0,
					ratio_comercial_global NUMERIC(12,4) NOT NULL DEFAULT 0,
					ratio_operativo_global NUMERIC(12,4) NOT NULL DEFAULT 0,
					observaciones TEXT,
					motivo_anulacion TEXT,
					usuario_creacion_id INTEGER NOT NULL REFERENCES usuarios(id),
					usuario_confirmacion_id INTEGER REFERENCES usuarios(id),
					usuario_anulacion_id INTEGER REFERENCES usuarios(id),
					confirmed_at TIMESTAMPTZ,
					cancelled_at TIMESTAMPTZ,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_embarques_fecha_estado
				ON embarques (fecha_embarque, estado)
			`);
			await pool.query(`
				CREATE TABLE IF NOT EXISTS embarque_detalles (
					id BIGSERIAL PRIMARY KEY,
					embarque_id BIGINT NOT NULL REFERENCES embarques(id) ON DELETE CASCADE,
					finca_id INTEGER NOT NULL REFERENCES fincas(id),
					calendario_id INTEGER REFERENCES calendarios_enfunde(id),
					cinta_color VARCHAR(30) NOT NULL,
					semana_enfunde SMALLINT,
					anio_enfunde INTEGER,
					racimos_buenos INTEGER NOT NULL DEFAULT 0 CHECK (racimos_buenos >= 0),
					racimos_rechazo INTEGER NOT NULL DEFAULT 0 CHECK (racimos_rechazo >= 0),
					total_racimos INTEGER NOT NULL DEFAULT 0 CHECK (total_racimos >= 0),
					cajas_embarcadas NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cajas_embarcadas >= 0),
					ratio_comercial_linea NUMERIC(12,4) NOT NULL DEFAULT 0,
					ratio_operativo_linea NUMERIC(12,4) NOT NULL DEFAULT 0,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_embarque_detalles_embarque
				ON embarque_detalles (embarque_id)
			`);
			await pool.query(`
				CREATE TABLE IF NOT EXISTS embarque_auditoria (
					id BIGSERIAL PRIMARY KEY,
					embarque_id BIGINT NOT NULL REFERENCES embarques(id) ON DELETE CASCADE,
					accion VARCHAR(20) NOT NULL,
					detalle JSONB,
					usuario_id INTEGER REFERENCES usuarios(id),
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
			await pool.query(`
				CREATE TABLE IF NOT EXISTS embarque_idempotencia (
					id_local UUID PRIMARY KEY,
					voucher_id BIGINT,
					payload_hash TEXT NOT NULL,
					status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
					response_json JSONB,
					error_message TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
		})();
	}

	await schemaInicializado;
}

async function limpiarIdempotenciaAntiguaSiAplica() {
	const ahora = Date.now();
	if (ahora - ultimaLimpieza < LIMPIEZA_INTERVALO_MS) return;
	ultimaLimpieza = ahora;

	await pool.query(
		`DELETE FROM embarque_idempotencia
     WHERE updated_at < NOW() - ($1::text || ' days')::interval`,
		[String(IDEMPOTENCIA_RETENCION_DIAS)],
	);
}

async function reservarIdempotenciaConfirmacion(idLocal, voucherId, payloadHash) {
	await asegurarSchema();
	await limpiarIdempotenciaAntiguaSiAplica();

	const insertRes = await pool.query(
		`INSERT INTO embarque_idempotencia (id_local, voucher_id, payload_hash, status)
     VALUES ($1, $2, $3, 'processing')
     ON CONFLICT (id_local) DO NOTHING
     RETURNING id_local`,
		[idLocal, voucherId, payloadHash],
	);

	if (insertRes.rows.length) return { reservar: true };

	const existenteRes = await pool.query(
		`SELECT id_local, voucher_id, payload_hash, status, response_json
     FROM embarque_idempotencia
     WHERE id_local = $1`,
		[idLocal],
	);

	if (!existenteRes.rows.length) {
		throw crearError('No se pudo verificar idempotencia de confirmacion', 500);
	}

	const existente = existenteRes.rows[0];
	if (Number(existente.voucher_id) !== Number(voucherId)) {
		throw crearError('id_local ya fue usado para otro voucher', 409);
	}
	if (existente.payload_hash !== payloadHash) {
		throw crearError('id_local ya fue usado con payload distinto', 409);
	}

	if (existente.status === 'completed') {
		return {
			reservar: false,
			duplicated: true,
			response: existente.response_json || null,
		};
	}

	if (existente.status === 'processing') {
		throw crearError('La confirmacion ya esta en procesamiento', 409);
	}

	const retryRes = await pool.query(
		`UPDATE embarque_idempotencia
     SET status = 'processing',
         error_message = NULL,
         updated_at = NOW()
     WHERE id_local = $1 AND status = 'failed' AND payload_hash = $2
     RETURNING id_local`,
		[idLocal, payloadHash],
	);

	if (!retryRes.rows.length) {
		throw crearError('No fue posible retomar la confirmacion', 409);
	}

	return { reservar: true };
}

async function marcarIdempotenciaCompletada(idLocal, responseObj) {
	if (!idLocal) return;
	await pool.query(
		`UPDATE embarque_idempotencia
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
			`UPDATE embarque_idempotencia
       SET status = 'failed',
           error_message = $2,
           updated_at = NOW()
       WHERE id_local = $1`,
			[idLocal, errorMessage || 'Error desconocido'],
		);
	} catch {
		// no-op
	}
}

async function generarNumeroVoucher(client, fechaEmbarque) {
	const yyyyMMdd = String(fechaEmbarque).replace(/-/g, '');
	for (let i = 0; i < 6; i += 1) {
		const sufijo = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
		const numero = `EMB-${yyyyMMdd}-${sufijo}`;
		const exists = await client.query(
			'SELECT 1 FROM embarques WHERE numero_voucher = $1 LIMIT 1',
			[numero],
		);
		if (!exists.rows.length) return numero;
	}
	throw crearError('No se pudo generar numero de voucher unico', 500);
}

function validarDetalles(detalles) {
	if (!Array.isArray(detalles) || !detalles.length) {
		throw crearError('detalles debe contener al menos una linea', 400);
	}

	const normalizados = detalles.map(normalizarDetalleLinea);
	for (const d of normalizados) {
		if (!Number.isInteger(d.finca_id) || d.finca_id <= 0) {
			throw crearError('finca_id invalido en detalles', 400);
		}
		if (d.calendario_id !== null && (!Number.isInteger(d.calendario_id) || d.calendario_id <= 0)) {
			throw crearError('calendario_id invalido en detalles', 400);
		}
		if (!d.cinta_color) {
			throw crearError('cinta_color es requerido en detalles', 400);
		}
	}
	return normalizados;
}

function validarDetallesEnScope(detalles, scope) {
	if (!scope?.enforce) return;
	const allowed = scope.allowedFincaIds || [];
	if (!allowed.length) {
		throw crearError('No tiene fincas asignadas para operar vouchers', 403);
	}
	for (const d of detalles) {
		if (!allowed.includes(Number(d.finca_id))) {
			throw crearError('No tiene permisos para usar una o mas fincas en este voucher', 403);
		}
	}
}

async function asegurarAccesoVoucher(clientOrPool, voucherId, scope) {
	if (!scope?.enforce) return;
	const allowed = scope.allowedFincaIds || [];
	if (!allowed.length) {
		throw crearError('No tiene permisos para consultar este voucher', 403);
	}
	const executor = clientOrPool || pool;
	const acceso = await executor.query(
		`SELECT 1
     FROM embarque_detalles
     WHERE embarque_id = $1
       AND finca_id = ANY($2::int[])
     LIMIT 1`,
		[voucherId, allowed],
	);
	if (!acceso.rows.length) {
		throw crearError('No tiene permisos para consultar este voucher', 403);
	}
}

async function insertarDetalles(client, embarqueId, detallesNormalizados) {
	for (const d of detallesNormalizados) {
		await client.query(
			`INSERT INTO embarque_detalles (
        embarque_id, finca_id, calendario_id, cinta_color, semana_enfunde, anio_enfunde,
        racimos_buenos, racimos_rechazo, total_racimos,
        cajas_embarcadas, ratio_comercial_linea, ratio_operativo_linea
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12
      )`,
			[
				embarqueId,
				d.finca_id,
				d.calendario_id,
				d.cinta_color,
				d.semana_enfunde,
				d.anio_enfunde,
				d.racimos_buenos,
				d.racimos_rechazo,
				d.total_racimos,
				d.cajas_embarcadas,
				d.ratio_comercial_linea,
				d.ratio_operativo_linea,
			],
		);
	}
}

async function obtenerVoucherPorId(clientOrPool, voucherId) {
	const executor = clientOrPool || pool;
	const headerRes = await executor.query(
		`SELECT * FROM embarques WHERE id = $1 LIMIT 1`,
		[voucherId],
	);
	if (!headerRes.rows.length) return null;

	const detalleRes = await executor.query(
		`SELECT d.*, f.nombre AS finca_nombre
     FROM embarque_detalles d
     JOIN fincas f ON f.id = d.finca_id
     WHERE d.embarque_id = $1
     ORDER BY d.id ASC`,
		[voucherId],
	);

	const h = headerRes.rows[0];
	return {
		id: Number(h.id),
		numero_voucher: h.numero_voucher,
		fecha_embarque: normalizarFechaISO(h.fecha_embarque),
		semana_corte: h.semana_corte,
		estado: h.estado,
		observaciones: h.observaciones,
		motivo_anulacion: h.motivo_anulacion,
		totales: {
			racimos_buenos: Number(h.total_racimos_buenos || 0),
			racimos_rechazo: Number(h.total_racimos_rechazo || 0),
			total_racimos: Number(h.total_racimos || 0),
			total_cajas: Number(h.total_cajas || 0),
			ratio_comercial_global: Number(h.ratio_comercial_global || 0),
			ratio_operativo_global: Number(h.ratio_operativo_global || 0),
		},
		detalles: detalleRes.rows,
		created_at: h.created_at,
		updated_at: h.updated_at,
		confirmed_at: h.confirmed_at,
		cancelled_at: h.cancelled_at,
	};
}

async function registrarAuditoria(client, embarqueId, accion, usuarioId, detalle = null) {
	await client.query(
		`INSERT INTO embarque_auditoria (embarque_id, accion, detalle, usuario_id)
     VALUES ($1, $2, $3::jsonb, $4)`,
		[embarqueId, accion, JSON.stringify(detalle || {}), usuarioId || null],
	);
}

export const EmbarqueService = {
	async getPreliquidacion({ fecha, finca_id, finca_ids }, contexto = {}) {
		await asegurarSchema();
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: contexto.usuarioIdSesion,
		});
		const fechaISO = normalizarFechaISO(fecha);
		if (!fechaISO || !validarFechaISO(fechaISO)) {
			throw crearError('fecha debe estar en formato YYYY-MM-DD', 400);
		}

		const params = [fechaISO];
		let filtroFinca = '';
		const requestedFincaIds = parsearFincaIds(finca_ids);
		if (finca_id && Number(finca_id) > 0 && !requestedFincaIds.length) {
			requestedFincaIds.push(Number(finca_id));
		}
		const fincaIds = applyFincaScopeToRequestedIds(requestedFincaIds, scope);
		if (!fincaIds.length && scope.enforce) {
			return {
				fecha: fechaISO,
				lineas: [],
				totales: { racimos_buenos: 0, racimos_rechazo: 0, total_racimos: 0 },
			};
		}
		if (fincaIds.length === 1) {
			params.push(fincaIds[0]);
			filtroFinca = ` AND rc.finca_id = $${params.length}`;
		} else if (fincaIds.length > 1) {
			params.push(fincaIds);
			filtroFinca = ` AND rc.finca_id = ANY($${params.length}::int[])`;
		}

		const sql = `
      SELECT
        rc.finca_id,
        f.nombre AS finca_nombre,
        rc.calendario_id,
        COALESCE(c.color, 'SIN_CINTA') AS cinta_color,
        ce.semana AS semana_enfunde,
        ce.anio AS anio_enfunde,
        SUM(rc.cantidad_racimos)::int AS racimos_buenos,
        SUM(rc.cantidad_rechazo)::int AS racimos_rechazo,
        SUM(rc.cantidad_racimos + rc.cantidad_rechazo)::int AS total_racimos
      FROM registro_cosecha rc
      JOIN fincas f ON f.id = rc.finca_id
      LEFT JOIN calendarios_enfunde ce ON ce.id = rc.calendario_id
      LEFT JOIN cintas c ON c.id = ce.color_id
      WHERE rc.fecha = $1
      ${filtroFinca}
      GROUP BY rc.finca_id, f.nombre, rc.calendario_id, c.color, ce.semana, ce.anio
      ORDER BY f.nombre ASC, ce.anio ASC NULLS LAST, ce.semana ASC NULLS LAST, c.color ASC
    `;

		const res = await pool.query(sql, params);
		const lineas = res.rows.map((r) => ({
			finca_id: Number(r.finca_id),
			finca_nombre: r.finca_nombre,
			calendario_id: r.calendario_id ? Number(r.calendario_id) : null,
			cinta_color: r.cinta_color,
			semana_enfunde:
				r.semana_enfunde === null ? null : Number(r.semana_enfunde),
			anio_enfunde: r.anio_enfunde === null ? null : Number(r.anio_enfunde),
			racimos_buenos: toNonNegativeInt(r.racimos_buenos),
			racimos_rechazo: toNonNegativeInt(r.racimos_rechazo),
			total_racimos: toNonNegativeInt(r.total_racimos),
		}));

		const totales = lineas.reduce(
			(acc, x) => {
				acc.racimos_buenos += x.racimos_buenos;
				acc.racimos_rechazo += x.racimos_rechazo;
				acc.total_racimos += x.total_racimos;
				return acc;
			},
			{ racimos_buenos: 0, racimos_rechazo: 0, total_racimos: 0 },
		);

		return { fecha: fechaISO, lineas, totales };
	},

	async crearVoucher(payload, contexto = {}) {
		await asegurarSchema();
		const { fecha_embarque, semana_corte, observaciones, detalles } = payload || {};
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});
		if (!usuarioId) throw crearError('Sesion invalida: usuario no autenticado', 401);
		const fechaEmbarqueISO = normalizarFechaISO(fecha_embarque);
		if (!fechaEmbarqueISO || !validarFechaISO(fechaEmbarqueISO)) {
			throw crearError('fecha_embarque debe estar en formato YYYY-MM-DD', 400);
		}

		const detallesNormalizados = validarDetalles(detalles);
		validarDetallesEnScope(detallesNormalizados, scope);
		const totales = calcularTotales(detallesNormalizados);
		const semanaCorte =
			semana_corte === null || semana_corte === undefined
				? null
				: toNonNegativeInt(semana_corte);

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const numeroVoucher = await generarNumeroVoucher(client, fechaEmbarqueISO);
			const ins = await client.query(
				`INSERT INTO embarques (
          numero_voucher, fecha_embarque, semana_corte, estado,
          total_racimos_buenos, total_racimos_rechazo, total_racimos,
          total_cajas, ratio_comercial_global, ratio_operativo_global,
          observaciones, usuario_creacion_id
        ) VALUES (
          $1, $2, $3, 'BORRADOR',
          $4, $5, $6,
          $7, $8, $9,
          $10, $11
        ) RETURNING id`,
				[
					numeroVoucher,
					fechaEmbarqueISO,
					semanaCorte,
					totales.total_racimos_buenos,
					totales.total_racimos_rechazo,
					totales.total_racimos,
					totales.total_cajas,
					totales.ratio_comercial_global,
					totales.ratio_operativo_global,
					observaciones || null,
					usuarioId,
				],
			);

			const voucherId = Number(ins.rows[0].id);
			await insertarDetalles(client, voucherId, detallesNormalizados);
			await registrarAuditoria(client, voucherId, 'CREAR_BORRADOR', usuarioId, {
				lineas: detallesNormalizados.length,
			});
			await client.query('COMMIT');
			return await obtenerVoucherPorId(client, voucherId);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	async actualizarVoucher(voucherId, payload, contexto = {}) {
		await asegurarSchema();
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});
		if (!usuarioId) throw crearError('Sesion invalida: usuario no autenticado', 401);
		const id = Number(voucherId);
		if (!id) throw crearError('voucherId invalido', 400);

		const client = await pool.connect();
			try {
				await client.query('BEGIN');
				await asegurarAccesoVoucher(client, id, scope);
				const header = await client.query(
				'SELECT id, estado FROM embarques WHERE id = $1 LIMIT 1 FOR UPDATE',
				[id],
			);
			if (!header.rows.length) throw crearError('Voucher no encontrado', 404);
			const estadoActual = String(header.rows[0].estado || '').toUpperCase();
			if (estadoActual === 'ANULADO') {
				throw crearError('No se puede editar voucher ANULADO', 409);
			}

			let detallesNormalizados = null;
			let totales = null;
				if (payload.detalles) {
					detallesNormalizados = validarDetalles(payload.detalles);
					validarDetallesEnScope(detallesNormalizados, scope);
					totales = calcularTotales(detallesNormalizados);

				await client.query('DELETE FROM embarque_detalles WHERE embarque_id = $1', [id]);
				await insertarDetalles(client, id, detallesNormalizados);
			}

			await client.query(
				`UPDATE embarques
         SET observaciones = COALESCE($2, observaciones),
             total_racimos_buenos = COALESCE($3, total_racimos_buenos),
             total_racimos_rechazo = COALESCE($4, total_racimos_rechazo),
             total_racimos = COALESCE($5, total_racimos),
             total_cajas = COALESCE($6, total_cajas),
             ratio_comercial_global = COALESCE($7, ratio_comercial_global),
             ratio_operativo_global = COALESCE($8, ratio_operativo_global),
             updated_at = NOW()
       WHERE id = $1`,
				[
					id,
					payload.observaciones ?? null,
					totales?.total_racimos_buenos ?? null,
					totales?.total_racimos_rechazo ?? null,
					totales?.total_racimos ?? null,
					totales?.total_cajas ?? null,
					totales?.ratio_comercial_global ?? null,
					totales?.ratio_operativo_global ?? null,
				],
			);

			await registrarAuditoria(
				client,
				id,
				estadoActual === 'CONFIRMADO'
					? 'ACTUALIZAR_CONFIRMADO'
					: 'ACTUALIZAR_BORRADOR',
				usuarioId,
				{
				lineas: detallesNormalizados ? detallesNormalizados.length : undefined,
				},
			);

			await client.query('COMMIT');
			return await obtenerVoucherPorId(client, id);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	async confirmarVoucher(voucherId, payload, contexto = {}) {
		await asegurarSchema();
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});
		if (!usuarioId) throw crearError('Sesion invalida: usuario no autenticado', 401);

		const id = Number(voucherId);
		if (!id) throw crearError('voucherId invalido', 400);
		const idLocal = payload?.id_local;
		if (!esUuid(idLocal)) {
			throw crearError('id_local invalido, debe ser UUID', 400);
		}

		const payloadCanonico = { voucher_id: id, accion: 'CONFIRMAR' };
		const payloadHash = hashPayload(payloadCanonico);
		const idem = await reservarIdempotenciaConfirmacion(idLocal, id, payloadHash);
		if (idem.duplicated) {
			return { duplicated: true, ...(idem.response || {}) };
		}

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await asegurarAccesoVoucher(client, id, scope);
			const headerRes = await client.query(
				`SELECT id, estado, total_cajas
         FROM embarques
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
				[id],
			);
			if (!headerRes.rows.length) throw crearError('Voucher no encontrado', 404);

			const header = headerRes.rows[0];
			if (header.estado === 'CONFIRMADO') {
				const voucher = await obtenerVoucherPorId(client, id);
				await client.query('COMMIT');
				await marcarIdempotenciaCompletada(idLocal, { voucher });
				return { duplicated: true, voucher };
			}
			if (header.estado !== 'BORRADOR') {
				throw crearError('Solo se puede confirmar voucher en BORRADOR', 409);
			}

			const detallesRes = await client.query(
				'SELECT COUNT(*)::int AS count, COALESCE(SUM(cajas_embarcadas),0)::numeric AS total_cajas FROM embarque_detalles WHERE embarque_id = $1',
				[id],
			);
			const count = Number(detallesRes.rows[0].count || 0);
			const totalCajas = Number(detallesRes.rows[0].total_cajas || 0);
			if (!count) throw crearError('No se puede confirmar sin lineas', 409);
			if (totalCajas <= 0) {
				throw crearError('No se puede confirmar con cajas_embarcadas en cero', 409);
			}

			await client.query(
				`UPDATE embarques
         SET estado = 'CONFIRMADO',
             usuario_confirmacion_id = $2,
             confirmed_at = NOW(),
             updated_at = NOW()
       WHERE id = $1`,
				[id, usuarioId],
			);

			await registrarAuditoria(client, id, 'CONFIRMAR', usuarioId, {
				total_cajas: totalCajas,
			});
			const voucher = await obtenerVoucherPorId(client, id);
			await client.query('COMMIT');
			await marcarIdempotenciaCompletada(idLocal, { voucher });
			return { duplicated: false, voucher };
		} catch (error) {
			await client.query('ROLLBACK');
			await marcarIdempotenciaFallida(idLocal, error.message);
			throw error;
		} finally {
			client.release();
		}
	},

	async anularVoucher(voucherId, payload, contexto = {}) {
		await asegurarSchema();
		const usuarioId = Number(contexto.usuarioIdSesion);
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: usuarioId,
		});
		if (!usuarioId) throw crearError('Sesion invalida: usuario no autenticado', 401);
		const id = Number(voucherId);
		if (!id) throw crearError('voucherId invalido', 400);
		const motivo = String(payload?.motivo_anulacion || '').trim();
		if (!motivo) throw crearError('motivo_anulacion es requerido', 400);

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await asegurarAccesoVoucher(client, id, scope);
			const headerRes = await client.query(
				'SELECT id, estado FROM embarques WHERE id = $1 LIMIT 1 FOR UPDATE',
				[id],
			);
			if (!headerRes.rows.length) throw crearError('Voucher no encontrado', 404);
			if (headerRes.rows[0].estado !== 'BORRADOR') {
				throw crearError('Solo se puede anular voucher en BORRADOR', 409);
			}

			await client.query(
				`UPDATE embarques
         SET estado = 'ANULADO',
             motivo_anulacion = $2,
             usuario_anulacion_id = $3,
             cancelled_at = NOW(),
             updated_at = NOW()
       WHERE id = $1`,
				[id, motivo, usuarioId],
			);

			await registrarAuditoria(client, id, 'ANULAR', usuarioId, {
				motivo_anulacion: motivo,
			});

			await client.query('COMMIT');
			return await obtenerVoucherPorId(client, id);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	async getVoucher(voucherId, contexto = {}) {
		await asegurarSchema();
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: contexto.usuarioIdSesion,
		});
		const id = Number(voucherId);
		if (!id) throw crearError('voucherId invalido', 400);
		await asegurarAccesoVoucher(pool, id, scope);
		const voucher = await obtenerVoucherPorId(pool, id);
		if (!voucher) throw crearError('Voucher no encontrado', 404);
		return voucher;
	},

	async listVouchers(filtros = {}, contexto = {}) {
		await asegurarSchema();
		const scope = await resolveFincaScope({
			rol: contexto.rolUsuario,
			userId: contexto.usuarioIdSesion,
		});
		const params = [];
		const where = [];

		if (filtros.fecha_desde) {
			const fechaDesdeISO = normalizarFechaISO(filtros.fecha_desde);
			if (!fechaDesdeISO || !validarFechaISO(fechaDesdeISO)) {
				throw crearError('fecha_desde invalida (YYYY-MM-DD)', 400);
			}
			params.push(fechaDesdeISO);
			where.push(`e.fecha_embarque >= $${params.length}`);
		}
		if (filtros.fecha_hasta) {
			const fechaHastaISO = normalizarFechaISO(filtros.fecha_hasta);
			if (!fechaHastaISO || !validarFechaISO(fechaHastaISO)) {
				throw crearError('fecha_hasta invalida (YYYY-MM-DD)', 400);
			}
			params.push(fechaHastaISO);
			where.push(`e.fecha_embarque <= $${params.length}`);
		}
		if (filtros.estado) {
			params.push(String(filtros.estado).toUpperCase());
			where.push(`e.estado = $${params.length}`);
		}
		if (filtros.numero_voucher) {
			const numeroVoucher = String(filtros.numero_voucher || '').trim();
			if (numeroVoucher) {
				const exacto =
					String(filtros.numero_voucher_exacto || '').toLowerCase() === 'true' ||
					filtros.numero_voucher_exacto === true;
				params.push(exacto ? numeroVoucher : `%${numeroVoucher}%`);
				where.push(
					exacto
						? `UPPER(e.numero_voucher) = UPPER($${params.length})`
						: `UPPER(e.numero_voucher) LIKE UPPER($${params.length})`,
				);
			}
		}
		const requestedFincaIds = parsearFincaIds(filtros.finca_ids);
		if (filtros.finca_id && Number(filtros.finca_id) > 0 && !requestedFincaIds.length) {
			requestedFincaIds.push(Number(filtros.finca_id));
		}
		const fincaIds = applyFincaScopeToRequestedIds(requestedFincaIds, scope);
		if (!fincaIds.length && scope.enforce) {
			return { items: [], total: 0 };
		}
		if (fincaIds.length === 1) {
			params.push(fincaIds[0]);
			where.push(`EXISTS (
        SELECT 1 FROM embarque_detalles d
        WHERE d.embarque_id = e.id AND d.finca_id = $${params.length}
      )`);
		} else if (fincaIds.length > 1) {
			params.push(fincaIds);
			where.push(`EXISTS (
        SELECT 1 FROM embarque_detalles d
        WHERE d.embarque_id = e.id AND d.finca_id = ANY($${params.length}::int[])
      )`);
		}

		const sql = `
      SELECT
        e.id,
        e.numero_voucher,
        e.fecha_embarque,
        e.estado,
        e.total_racimos,
        e.total_cajas,
        e.ratio_comercial_global
      FROM embarques e
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.fecha_embarque DESC, e.id DESC
    `;

		const res = await pool.query(sql, params);
		return {
			items: res.rows.map((r) => ({
				id: Number(r.id),
				numero_voucher: r.numero_voucher,
				fecha_embarque: normalizarFechaISO(r.fecha_embarque),
				estado: r.estado,
				total_racimos: Number(r.total_racimos || 0),
				total_cajas: Number(r.total_cajas || 0),
				ratio_comercial_global: Number(r.ratio_comercial_global || 0),
			})),
			total: res.rows.length,
		};
	},
};
