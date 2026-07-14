import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { syncWeatherForAllFincas } from '../services/clima/weather.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEATHER_TZ = 'America/Guayaquil';

async function runWeatherSync() {
	console.log('--- 🌏 INICIANDO BARRIDO CLIMÁTICO ---');
	const hoy = dayjs().tz(WEATHER_TZ).format('YYYY-MM-DD');

	try {
		const resumen = await syncWeatherForAllFincas(hoy);
		if (resumen.total_fincas === 0) {
			console.log('ℹ️ No hay fincas con GPS.');
			return;
		}
		console.log(
			`--- ✅ PROCESO COMPLETADO --- Exitos: ${resumen.exitos} | Fallidos: ${resumen.fallidos}`,
		);
	} catch (err) {
		console.error('❌ ERROR CRÍTICO EN WORKER:', err.message);
	}
}

export const initWeatherWorker = () => {
	if (String(process.env.WEATHER_SYNC_ON_START || '').toLowerCase() === 'true') {
		runWeatherSync();
	}

	// 23:55 para cerrar el día con datos consolidados
	cron.schedule(
		'55 23 * * *',
		runWeatherSync,
		{
			timezone: WEATHER_TZ,
		},
	);
};
