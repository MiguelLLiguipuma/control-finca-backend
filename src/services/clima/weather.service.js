import axios from 'axios';
import { pool } from '../../db/db.js';

const API_KEY = process.env.OPENWEATHER_API_KEY;

export const syncWeatherForFinca = async (finca, fechaReferencia) => {
	const { id, latitud, longitud } = finca;

	try {
		const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitud}&lon=${longitud}&appid=${API_KEY}&units=metric`;
		const { data } = await axios.get(url);

		const tempMedia = data.main.temp;
		// Ciencia: El banano se detiene bajo los 14°C
		const unidadesCalor = Math.max(0, tempMedia - 14);
		const lluvia = data.rain ? data.rain['1h'] || 0 : 0;

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
	} catch (error) {
		console.error(`❌ Error en Finca ${id}:`, error.message);
	}
};
