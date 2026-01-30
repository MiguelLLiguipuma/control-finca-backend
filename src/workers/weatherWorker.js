import cron from 'node-cron';
import { pool } from '../db/db.js';
import { syncWeatherForFinca } from '../services/clima/weather.service.js';

export const initWeatherWorker = () => {
	// 23:55 para cerrar el día con datos consolidados
	cron.schedule(
		'55 23 * * *',
		async () => {
			console.log('--- 🌏 INICIANDO BARRIDO CLIMÁTICO ---');
			const hoy = new Date().toISOString().split('T')[0];

			try {
				const { rows: fincas } = await pool.query(
					'SELECT id, latitud, longitud FROM fincas WHERE latitud IS NOT NULL AND longitud IS NOT NULL',
				);

				if (fincas.length === 0)
					return console.log('ℹ️ No hay fincas con GPS.');

				for (const finca of fincas) {
					// Pasamos 'hoy' para que el servicio use una fecha consistente
					await syncWeatherForFinca(finca, hoy);

					// Rate Limiting para OpenWeather (1.5s entre llamadas)
					await new Promise((resolve) => setTimeout(resolve, 1500));
				}
				console.log('--- ✅ PROCESO COMPLETADO ---');
			} catch (err) {
				console.error('❌ ERROR CRÍTICO EN WORKER:', err.message);
			}
		},
		{
			timezone: 'America/Guayaquil',
		},
	);
};
