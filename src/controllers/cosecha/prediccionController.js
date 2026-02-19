import { pool } from '../../db/db.js';

export const obtenerPrediccionCosecha = async (req, res) => {
	const { finca_id } = req.params;
	try {
		// 1. Obtener la meta de UC y el promedio de los últimos 7 días para mayor precisión
		const configData = await pool.query(
			`SELECT 
        (SELECT unidades_calor_objetivo FROM configuracion_crecimiento WHERE finca_id = $1 LIMIT 1) as meta,
        (SELECT AVG(unidades_calor_dia) FROM (
            SELECT unidades_calor_dia FROM historial_clima_fincas 
            WHERE finca_id = $1 ORDER BY fecha DESC LIMIT 7
         ) as tendencias) as promedio_reciente`,
			[finca_id],
		);

		const metaUC = parseFloat(configData.rows[0]?.meta || 900);
		// Si no hay historial reciente, usamos 12.8 como base estándar para banano
		const promedioUC = parseFloat(
			configData.rows[0]?.promedio_reciente || 12.8,
		);

		// 2. Consulta Maestra de Inventario
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

		// 3. Mapeo con algoritmo de tendencia climática
		const proyecciones = inventario.rows.map((lote) => {
			const acumuladas = parseFloat(lote.uc_acumuladas || 0);
			const progreso = ((acumuladas / metaUC) * 100).toFixed(1);
			const faltantes = Math.max(0, metaUC - acumuladas);

			// Aplicamos el promedio real obtenido de la base de datos
			const diasParaCorte = Math.ceil(faltantes / promedioUC);

			const fechaEst = new Date();
			fechaEst.setDate(fechaEst.getDate() + diasParaCorte);

			// Calculamos cajas esperadas (Ratio estimado de 1.1 cajas por racimo, ajustable)
			const ratioEstimado = 1.05;
			const saldo = parseInt(lote.saldo_racimos);

			return {
				calendario_id: lote.calendario_id,
				semana_enfunde: lote.semana_enfunde,
				anio: lote.anio,
				color_cinta: lote.color_cinta,
				color_hex: lote.color_hex,
				saldo_en_campo: saldo,
				progreso_madurez: parseFloat(progreso),
				dias_faltantes: diasParaCorte,
				fecha_estimada: fechaEst.toISOString().split('T')[0],
				cajas_esperadas: Math.round(saldo * ratioEstimado),
				mensaje_clima:
					acumuladas >= metaUC * 0.95
						? 'Corte Urgente'
						: acumuladas >= metaUC * 0.85
						? 'Próxima Cosecha'
						: 'En Desarrollo',
				tendencia_climatica: promedioUC > 13 ? 'Calor Alto' : 'Normal',
			};
		});

		res.json({
			finca_id,
			meta_aplicada: metaUC,
			promedio_climatico_semanal: promedioUC.toFixed(2),
			proyecciones,
		});
	} catch (error) {
		console.error('ERROR CRÍTICO MOTOR COSECHA:', error);
		res
			.status(500)
			.json({
				error: 'Error en proyecciones biológicas',
				detalle: error.message,
			});
	}
};
