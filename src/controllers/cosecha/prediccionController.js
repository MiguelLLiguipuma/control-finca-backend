import { pool } from '../../db/db.js';

export const obtenerPrediccionCosecha = async (req, res) => {
	const { finca_id } = req.params;

	try {
		// 1. Obtener la meta de UC para esta finca
		const config = await pool.query(
			'SELECT unidades_calor_objetivo FROM configuracion_crecimiento WHERE finca_id = $1',
			[finca_id],
		);
		// Si no hay configuración, usamos 900 como estándar
		const metaUC = parseFloat(config.rows[0]?.unidades_calor_objetivo || 900);

		// 2. Ejecutar la CONSULTA MAESTRA (La que acabas de probar en SQL)
		const inventario = await pool.query(
			`SELECT 
          ce.id as calendario_id,
          ce.semana as semana_enfunde,
          ce.anio,
          c.color as color_cinta,
          c.color_hex,
          (SUM(re.cantidad_fundas) - COALESCE(
              (SELECT SUM(cantidad_racimos + cantidad_rechazo) 
               FROM registro_cosecha 
               WHERE calendario_id = ce.id), 0
          )) as saldo_racimos,
          MIN(re.fecha) as fecha_inicio,
          (SELECT SUM(unidades_calor_dia) 
           FROM historial_clima_fincas 
           WHERE finca_id = re.finca_id AND fecha >= MIN(re.fecha)) as uc_acumuladas
      FROM registro_enfunde re
      JOIN calendarios_enfunde ce ON re.calendario_id = ce.id
      JOIN cintas c ON ce.color_id = c.id
      WHERE re.finca_id = $1
      GROUP BY ce.id, ce.semana, ce.anio, c.color, c.color_hex, re.finca_id
      HAVING (SUM(re.cantidad_fundas) - COALESCE(
          (SELECT SUM(cantidad_racimos + cantidad_rechazo) 
           FROM registro_cosecha 
           WHERE calendario_id = ce.id), 0
      )) > 0 
      ORDER BY ce.anio ASC, ce.semana ASC`,
			[finca_id],
		);

		// 3. Formatear la respuesta para el Frontend
		const proyecciones = inventario.rows.map((lote) => {
			const acumuladas = parseFloat(lote.uc_acumuladas || 0);

			// Cálculo de porcentaje de madurez térmica
			const progreso = ((acumuladas / metaUC) * 100).toFixed(1);

			// Estimación de días faltantes (basado en promedio histórico simple de 12 UC/día)
			const promedioUC = 12.5;
			const faltantes = Math.max(0, metaUC - acumuladas);
			const diasParaCorte = Math.ceil(faltantes / promedioUC);

			const fechaEstimada = new Date();
			fechaEstimada.setDate(fechaEstimada.getDate() + diasParaCorte);

			return {
				calendario_id: lote.calendario_id,
				semana_enfunde: lote.semana_enfunde,
				anio: lote.anio,
				color_cinta: lote.color_cinta,
				color_hex: lote.color_hex || '#757575',
				saldo_en_campo: parseInt(lote.saldo_racimos),
				progreso_madurez: parseFloat(progreso),
				dias_faltantes: diasParaCorte,
				fecha_estimada: fechaEstimada.toISOString().split('T')[0],
				mensaje_clima:
					acumuladas >= metaUC * 0.9 ? 'Corte Inminente' : 'En desarrollo',
			};
		});

		res.json({ finca_id, proyecciones });
	} catch (error) {
		console.error('DETALLE ERROR BACKEND:', error);
		res
			.status(500)
			.json({
				error: 'Error interno al procesar madurez',
				detalle: error.message,
			});
	}
};
