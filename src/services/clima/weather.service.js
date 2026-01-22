import axios from 'axios';
import pool from '../db.js'; // Tu conexión a PostgreSQL

const API_KEY = process.env.OPENWEATHER_API_KEY;

export const syncWeatherForFinca = async (finca) => {
	const { id, latitud, longitud } = finca;

	if (!latitud || !longitud) {
		console.log(`⚠️ Finca ${id} sin coordenadas. Saltando...`);
		return;
	}

	try {
		const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitud}&lon=${longitud}&appid=${API_KEY}&units=metric`;
		const { data } = await axios.get(url);

		const tempMedia = data.main.temp;
		// El banano no crece bajo los 14°C (Cero Biológico)
		const unidadesCalor = Math.max(0, tempMedia - 14);
		const lluvia = data.rain ? data.rain['1h'] || 0 : 0;

		// Guardar en historial_clima_fincas (según tu diagrama)
		await pool.query(
			`INSERT INTO historial_clima_fincas 
            (finca_id, fecha, temp_media, unidades_calor_dia, precipitacion_mm)
            VALUES ($1, CURRENT_DATE, $2, $3, $4)
            ON CONFLICT (finca_id, fecha) DO UPDATE 
            SET temp_media = EXCLUDED.temp_media, 
                unidades_calor_dia = EXCLUDED.unidades_calor_dia,
                precipitacion_mm = EXCLUDED.precipitacion_mm`,
			[id, tempMedia, unidadesCalor, lluvia],
		);

		console.log(`✅ Clima sincronizado para Finca ID: ${id} (${tempMedia}°C)`);
	} catch (error) {
		console.error(
			`❌ Error en Finca ${id}:`,
			error.response?.data?.message || error.message,
		);
	}
};
