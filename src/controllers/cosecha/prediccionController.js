import { pool } from '../../db/db.js';

export const obtenerPrediccionCosecha = async (req, res) => {
	const { finca_id } = req.params;

	try {
		// 1. Obtener la meta de la finca (Unidades Calor necesarias y Ratio)
		// Si no existe, usamos valores estándar por defecto
		const configQuery = await pool.query(
			'SELECT unidades_calor_objetivo, ratio_estimado_cajas FROM configuracion_crecimiento WHERE finca_id = $1',
			[finca_id],
		);

		const metaUC = configQuery.rows[0]?.unidades_calor_objetivo || 1000;
		const ratioBase = parseFloat(
			configQuery.rows[0]?.ratio_estimado_cajas || 1.25,
		);

		// 2. Obtener cintas activas con su fecha de inicio (enfunde)
		// Nota: Asumimos que tienes una fecha_enfunde en calendarios_enfunde
		const inventarioQuery = await pool.query(
			`SELECT ce.id, ce.semana, ce.anio, ce.saldo, ce.fecha_enfunde, c.color
       FROM calendarios_enfunde ce
       JOIN cintas c ON ce.color_id = c.id
       WHERE ce.finca_id = $1 AND ce.saldo > 0 AND ce.estado = 'activo'`,
			[finca_id],
		);

		const predicciones = await Promise.all(
			inventarioQuery.rows.map(async (cinta) => {
				// 3. Calcular UC acumuladas desde el enfunde hasta hoy para esta cinta
				const ucAcumuladasQuery = await pool.query(
					`SELECT SUM(unidades_calor_dia) as total_acumulado 
         FROM historial_clima_fincas 
         WHERE finca_id = $1 AND fecha >= $2 AND fecha <= CURRENT_DATE`,
					[finca_id, cinta.fecha_enfunde],
				);

				const acumulado = parseFloat(
					ucAcumuladasQuery.rows[0]?.total_acumulado || 0,
				);
				const pendiente = Math.max(0, metaUC - acumulado);

				// 4. Estimar días restantes
				// Usamos un promedio simple de las últimas 2 semanas para proyectar el futuro cercano
				const promedioClimaQuery = await pool.query(
					`SELECT AVG(unidades_calor_dia) as promedio 
         FROM historial_clima_fincas 
         WHERE finca_id = $1 AND fecha > CURRENT_DATE - INTERVAL '14 days'`,
					[finca_id],
				);

				const promedioUC = parseFloat(
					promedioClimaQuery.rows[0]?.promedio || 12,
				); // 12 UC/día es un estándar
				const diasRestantes = Math.ceil(pendiente / promedioUC);

				// 5. Generar fecha estimada
				const fechaEstimada = new Date();
				fechaEstimada.setDate(fechaEstimada.getDate() + diasRestantes);

				return {
					calendario_id: cinta.id,
					color: cinta.color,
					semana_enfunde: cinta.semana,
					saldo_racimos: cinta.saldo,
					uc_acumuladas: acumulado.toFixed(2),
					fecha_estimada_cosecha: fechaEstimada.toISOString().split('T')[0],
					dias_faltantes: diasRestantes,
					cajas_proyectadas: Math.floor(cinta.saldo * ratioBase),
				};
			}),
		);

		res.json({
			finca_id,
			meta_unidades_calor: metaUC,
			proyecciones: predicciones,
		});
	} catch (error) {
		console.error('Error en predicción:', error);
		res
			.status(500)
			.json({ message: 'Error al calcular la predicción de cosecha' });
	}
};
