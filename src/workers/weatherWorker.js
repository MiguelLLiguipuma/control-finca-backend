import cron from 'node-cron';
import { pool } from '../db/db.js';
import { syncWeatherForFinca } from '../services/weatherService.js';

export const initWeatherWorker = () => {
	// Se programa para las 23:55 (Casi medianoche)
	cron.schedule(
		'55 23 * * *',
		async () => {
			console.log('--- 🌏 INICIANDO ACTUALIZACIÓN CLIMÁTICA MULTI-FINCA ---');

			try {
				// 1. Obtenemos todas las fincas de TODOS los usuarios que tengan GPS
				const { rows: fincas } = await pool.query(
					'SELECT id, latitud, longitud FROM fincas WHERE latitud IS NOT NULL AND longitud IS NOT NULL',
				);

				if (fincas.length === 0) {
					return console.log('ℹ️ No hay fincas configuradas con GPS aún.');
				}

				// 2. Recorremos cada finca y ejecutamos tu servicio
				for (const finca of fincas) {
					await syncWeatherForFinca(finca);

					// 3. Rate Limiting: Esperamos 1.5 seg entre fincas
					// para que OpenWeather no nos bloquee la cuenta gratuita
					await new Promise((resolve) => setTimeout(resolve, 1500));
				}

				console.log(
					'--- ✅ PROCESO COMPLETADO: Todas las fincas actualizadas ---',
				);
			} catch (err) {
				console.error('❌ ERROR CRÍTICO en el Barrido de Fincas:', err.message);
			}
		},
		{
			timezone: 'America/Guayaquil',
		},
	);
};
