import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { pool } from '../db/db.js';
import { syncWeatherForFinca } from '../services/clima/weather.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEATHER_TZ = 'America/Guayaquil';

export const initWeatherWorker = () => {
	// 23:55 para cerrar el día con datos consolidados
	cron.schedule(
		'55 23 * * *',
		async () => {
			console.log('--- 🌏 INICIANDO BARRIDO CLIMÁTICO ---');
			const hoy = dayjs().tz(WEATHER_TZ).format('YYYY-MM-DD');

			try {
				const { rows: fincas } = await pool.query(
					'SELECT id, latitud, longitud FROM fincas WHERE latitud IS NOT NULL AND longitud IS NOT NULL',
				);

				if (fincas.length === 0)
					return console.log('ℹ️ No hay fincas con GPS.');

				let exitos = 0;
				let fallidos = 0;
				for (const finca of fincas) {
					// Pasamos 'hoy' para que el servicio use una fecha consistente
					const resultado = await syncWeatherForFinca(finca, hoy);
					if (resultado?.ok) exitos += 1;
					else fallidos += 1;

					// Rate Limiting para OpenWeather (1.5s entre llamadas)
					await new Promise((resolve) => setTimeout(resolve, 1500));
				}
				console.log(
					`--- ✅ PROCESO COMPLETADO --- Exitos: ${exitos} | Fallidos: ${fallidos}`,
				);
			} catch (err) {
				console.error('❌ ERROR CRÍTICO EN WORKER:', err.message);
			}
		},
		{
			timezone: WEATHER_TZ,
		},
	);
};
