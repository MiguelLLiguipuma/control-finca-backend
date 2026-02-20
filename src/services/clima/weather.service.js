import axios from 'axios';
import { pool } from '../../db/db.js';

const API_KEY = process.env.OPENWEATHER_API_KEY;

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
