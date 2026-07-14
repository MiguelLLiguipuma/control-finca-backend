import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
	getWeatherFincas,
	getWeatherStatus,
	syncWeatherForAllFincas,
	syncWeatherForFinca,
} from '../services/clima/weather.service.js';
import {
	applyFincaScopeToRequestedIds,
	assertFincaInScope,
	resolveFincaScope,
} from '../utils/accessScope.js';
import { logger } from '../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEATHER_TZ = 'America/Guayaquil';

function parseFincaIds(input) {
	if (Array.isArray(input)) {
		return input.map(Number).filter((id) => Number.isInteger(id) && id > 0);
	}
	if (typeof input === 'string') {
		return input
			.split(',')
			.map((id) => Number(String(id).trim()))
			.filter((id) => Number.isInteger(id) && id > 0);
	}
	return [];
}

function manejarError(res, error, fallback = 'Error en módulo de clima') {
	const status = Number(error?.status) || 500;
	return res.status(status).json({
		success: false,
		message: error?.message || fallback,
	});
}

export const ClimaController = {
	async status(req, res) {
		try {
			const scope = await resolveFincaScope({
				rol: req.user?.rol,
				userId: Number(req.user?.id || 0),
			});
			const requested = parseFincaIds(req.query?.finca_ids || req.query?.finca_id);
			const fincaIds = applyFincaScopeToRequestedIds(requested, scope);
			if (scope?.enforce && !fincaIds.length) {
				return res.json({
					success: true,
					data: [],
				});
			}
			const data = await getWeatherStatus({ fincaIds });
			return res.json({
				success: true,
				data,
			});
		} catch (error) {
			logger.error('clima_status_error', {
				request_id: req.requestId || null,
				error: error?.message || 'unknown',
			});
			return manejarError(res, error, 'No fue posible consultar estado climático');
		}
	},

	async sync(req, res) {
		try {
			const fecha = dayjs().tz(WEATHER_TZ).format('YYYY-MM-DD');
			const fincaId = Number(req.body?.finca_id || req.query?.finca_id || 0);

			if (fincaId) {
				const scope = await resolveFincaScope({
					rol: req.user?.rol,
					userId: Number(req.user?.id || 0),
				});
				assertFincaInScope(fincaId, scope);
				const [finca] = await getWeatherFincas({ fincaIds: [fincaId] });
				if (!finca) {
					return res.status(404).json({
						success: false,
						message: 'Finca no encontrada o sin coordenadas climáticas',
					});
				}
				const resultado = await syncWeatherForFinca(finca, fecha);
				return res.json({
					success: true,
					data: {
						fecha,
						total_fincas: 1,
						exitos: resultado?.ok ? 1 : 0,
						fallidos: resultado?.ok ? 0 : 1,
						resultados: [resultado],
					},
				});
			}

			const scope = await resolveFincaScope({
				rol: req.user?.rol,
				userId: Number(req.user?.id || 0),
			});
			const fincaIds = applyFincaScopeToRequestedIds([], scope);
			if (scope?.enforce && !fincaIds.length) {
				return res.json({
					success: true,
					data: {
						fecha,
						total_fincas: 0,
						exitos: 0,
						fallidos: 0,
						resultados: [],
					},
				});
			}
			const data = await syncWeatherForAllFincas(fecha, { fincaIds });
			return res.json({
				success: true,
				data,
			});
		} catch (error) {
			logger.error('clima_sync_error', {
				request_id: req.requestId || null,
				error: error?.message || 'unknown',
			});
			return manejarError(res, error, 'No fue posible sincronizar clima');
		}
	},
};
