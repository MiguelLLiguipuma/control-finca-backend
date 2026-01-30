import { pool } from '../db/db.js';

export const obtenerPrediccionCosecha = async (req, res) => {
	const { finca_id } = req.params;

	try {
		// CONSULTA MAESTRA: Evita el problema N+1 (múltiples queries en bucle)
		const queryMaster = await pool.query(
			`SELECT 
        ce.id as calendario_id, 
        ce.semana, 
        ce.anio, 
        ce.saldo, 
        ce.fecha_enfunde, 
        c.color,
        conf.unidades_calor_objetivo, 
        conf.ratio_estimado_cajas,
        -- Subconsulta para sumar UC acumuladas
        COALESCE((
          SELECT SUM(unidades_calor_dia) 
          FROM historial_clima_fincas 
          WHERE finca_id = ce.finca_id AND fecha >= ce.fecha_enfunde
        ), 0) as uc_acumuladas,
        -- Promedio de las últimas 2 semanas para proyectar
        COALESCE((
          SELECT AVG(unidades_calor_dia) 
          FROM historial_clima_fincas 
          WHERE finca_id = ce.finca_id AND fecha > CURRENT_DATE - INTERVAL '14 days'
        ), 12) as promedio_uc_reciente
       FROM calendarios_enfunde ce
       JOIN cintas c ON ce.color_id = c.id
       LEFT JOIN configuracion_crecimiento conf ON ce.finca_id = conf.finca_id
       WHERE ce.finca_id = $1 AND ce.saldo > 0 AND ce.estado = 'activo'
       ORDER BY ce.anio ASC, ce.semana ASC`,
			[finca_id],
		);

		if (queryMaster.rows.length === 0) {
			return res
				.status(404)
				.json({ message: 'No hay cintas activas para esta finca.' });
		}

		const proyecciones = queryMaster.rows.map((cinta) => {
			const acumulado = parseFloat(cinta.uc_acumuladas);
			const meta = parseFloat(cinta.unidades_calor_objetivo || 1000);
			const promedioDiario = parseFloat(cinta.promedio_uc_reciente || 12);
			const ratio = parseFloat(cinta.ratio_estimado_cajas || 1.25);

			const faltante = Math.max(0, meta - acumulado);
			const diasRestantes = Math.ceil(faltante / promedioDiario);

			const fechaEstimada = new Date();
			fechaEstimada.setDate(fechaEstimada.getDate() + diasRestantes);

			// Lógica de "Estado Biológico"
			let alerta = 'Normal';
			if (
				diasRestantes < 7 &&
				new Date().getDay() - new Date(cinta.fecha_enfunde).getDay() < 70
			) {
				alerta = 'Fruta acelerada por calor';
			}

			return {
				calendario_id: cinta.calendario_id,
				color: cinta.color,
				semana_enfunde: cinta.semana,
				anio: cinta.anio,
				saldo_racimos: cinta.saldo,
				progreso_madurez: ((acumulado / meta) * 100).toFixed(1) + '%',
				fecha_estimada: fechaEstimada.toISOString().split('T')[0],
				dias_faltantes: diasRestantes,
				cajas_esperadas: Math.floor(cinta.saldo * ratio),
				mensaje_clima: alerta,
			};
		});

		res.json({
			finca_id,
			timestamp: new Date(),
			proyecciones,
		});
	} catch (error) {
		console.error('❌ ERROR EN PREDICCIÓN:', error);
		res
			.status(500)
			.json({ message: 'Error interno en el servidor de predicción.' });
	}
};
