import axios from 'axios';
import { pool } from '../../db/db.js';

const API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_STALE_DAYS = Number(process.env.WEATHER_STALE_DAYS || 2);

function toNumber(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function normalizarEstadoClima(row) {
	const ultimaFecha = row?.ultima_fecha_clima || null;
	const diasAtraso = ultimaFecha ? toNumber(row?.dias_atraso, 9999) : null;
	const registrosUltimos7 = toNumber(row?.registros_ultimos_7_dias, 0);
	const promedioUc7Dias = row?.promedio_uc_7_dias === null ? null : toNumber(row?.promedio_uc_7_dias, null);
	const estado = !ultimaFecha
		? 'SIN_DATOS'
		: diasAtraso > WEATHER_STALE_DAYS || registrosUltimos7 === 0
			? 'ATRASADO'
			: 'ACTUALIZADO';

	return {
		finca_id: Number(row.finca_id),
		finca_nombre: row.finca_nombre || null,
		ultima_fecha_clima: ultimaFecha,
		dias_atraso: diasAtraso,
		registros_total: toNumber(row?.registros_total, 0),
		registros_ultimos_7_dias: registrosUltimos7,
		promedio_uc_7_dias: promedioUc7Dias,
		estado,
		confiable: estado === 'ACTUALIZADO',
	};
}

export const getWeatherStatus = async ({ fincaIds = [] } = {}) => {
	const ids = Array.from(
		new Set(
			(fincaIds || [])
				.map((id) => Number(id))
				.filter((id) => Number.isInteger(id) && id > 0),
		),
	);
	const params = [];
	const filtro = ids.length ? `WHERE f.id = ANY($1::int[])` : '';
	if (ids.length) params.push(ids);

	const { rows } = await pool.query(
		`SELECT
       f.id AS finca_id,
       f.nombre AS finca_nombre,
       MAX(h.fecha)::date AS ultima_fecha_clima,
       CASE
         WHEN MAX(h.fecha) IS NULL THEN NULL
         ELSE (CURRENT_DATE - MAX(h.fecha)::date)::int
       END AS dias_atraso,
       COUNT(h.fecha)::int AS registros_total,
       COUNT(h.fecha) FILTER (
         WHERE h.fecha >= CURRENT_DATE - INTERVAL '6 days'
           AND h.fecha <= CURRENT_DATE
       )::int AS registros_ultimos_7_dias,
       AVG(h.unidades_calor_dia) FILTER (
         WHERE h.fecha >= CURRENT_DATE - INTERVAL '6 days'
           AND h.fecha <= CURRENT_DATE
       )::numeric AS promedio_uc_7_dias
     FROM fincas f
     LEFT JOIN historial_clima_fincas h ON h.finca_id = f.id
     ${filtro}
     GROUP BY f.id, f.nombre
     ORDER BY f.nombre ASC`,
		params,
	);

	return rows.map(normalizarEstadoClima);
};

export const getWeatherStatusForFinca = async (fincaId) => {
	const [status] = await getWeatherStatus({ fincaIds: [fincaId] });
	return status || null;
};

export const getWeatherFincas = async ({ fincaIds = [] } = {}) => {
	const ids = Array.from(
		new Set(
			(fincaIds || [])
				.map((id) => Number(id))
				.filter((id) => Number.isInteger(id) && id > 0),
		),
	);
	const params = [];
	const filtro = ids.length ? `AND id = ANY($1::int[])` : '';
	if (ids.length) params.push(ids);
	const { rows } = await pool.query(
		`SELECT id, nombre, latitud, longitud
     FROM fincas
     WHERE latitud IS NOT NULL
       AND longitud IS NOT NULL
       ${filtro}
     ORDER BY id ASC`,
		params,
	);
	return rows || [];
};

export const syncWeatherForAllFincas = async (fechaReferencia, { fincaIds = [] } = {}) => {
	const fincas = await getWeatherFincas({ fincaIds });

	let exitos = 0;
	let fallidos = 0;
	const resultados = [];

	for (const finca of fincas) {
		const resultado = await syncWeatherForFinca(finca, fechaReferencia);
		resultados.push(resultado);
		if (resultado?.ok) exitos += 1;
		else fallidos += 1;

		await new Promise((resolve) => setTimeout(resolve, 1500));
	}

	return {
		fecha: fechaReferencia,
		total_fincas: fincas.length,
		exitos,
		fallidos,
		resultados,
	};
};

export const syncWeatherForFinca = async (finca, fechaReferencia) => {
	const { id, latitud, longitud } = finca;

	try {
		if (!API_KEY) {
			return {
				ok: false,
				finca_id: id,
				error: 'OPENWEATHER_API_KEY no configurada',
			};
		}
		if (!Number.isFinite(Number(latitud)) || !Number.isFinite(Number(longitud))) {
			return {
				ok: false,
				finca_id: id,
				error: 'Coordenadas invalidas para sincronizacion',
			};
		}

		const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitud}&lon=${longitud}&appid=${API_KEY}&units=metric`;
		const { data } = await axios.get(url, {
			timeout: 10000,
		});

		const tempMedia = Number(data?.main?.temp);
		if (!Number.isFinite(tempMedia)) {
			return {
				ok: false,
				finca_id: id,
				error: 'Respuesta climatica sin temperatura valida',
			};
		}
		// Ciencia: El banano se detiene bajo los 14°C
		const unidadesCalor = Math.max(0, tempMedia - 14);
		const lluvia = Number(data?.rain?.['1h'] ?? data?.rain?.['3h'] ?? 0) || 0;

		await pool.query(
			`INSERT INTO historial_clima_fincas 
       (finca_id, fecha, temp_media, unidades_calor_dia, precipitacion_mm)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (finca_id, fecha) DO UPDATE 
       SET temp_media = EXCLUDED.temp_media, 
           unidades_calor_dia = EXCLUDED.unidades_calor_dia,
           precipitacion_mm = EXCLUDED.precipitacion_mm`,
			[id, fechaReferencia, tempMedia, unidadesCalor, lluvia],
		);

		console.log(
			`✅ Finca ${id}: ${tempMedia}°C | UC: ${unidadesCalor.toFixed(2)}`,
		);
		return {
			ok: true,
			finca_id: id,
			temp_media: tempMedia,
			unidades_calor_dia: Number(unidadesCalor.toFixed(2)),
			precipitacion_mm: lluvia,
		};
	} catch (error) {
		const detalle = error?.message || 'Error desconocido';
		console.error(`❌ Error en Finca ${id}:`, detalle);
		return {
			ok: false,
			finca_id: id,
			error: detalle,
		};
	}
};
