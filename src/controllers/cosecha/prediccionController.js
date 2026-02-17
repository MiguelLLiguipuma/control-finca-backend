import { pool } from '../../db/db.js';

export const obtenerPrediccionCosecha = async (req, res) => {
	const { finca_id } = req.params;

	try {
		// 1. Obtener la meta de Unidades Calor (UC) para la finca
		const config = await pool.query(
			'SELECT unidades_calor_objetivo FROM configuracion_crecimiento WHERE finca_id = $1',
			[finca_id],
		);
		const metaUC = config.rows[0]?.unidades_calor_objetivo || 900;

		// 2. Consultar inventario real desde registro_enfunde
		const inventario = await pool.query(
			`
      SELECT 
        ce.id as calendario_id,
        ce.semana as semana_enfunde,
        ce.anio,
        c.color as color_cinta,
        c.codigo_hex as color_hex,
        MIN(re.fecha) as fecha_inicio_enfunde,
        (SUM(re.cantidad_racimos) - COALESCE(
          (SELECT SUM(cantidad_racimos + cantidad_rechazo) 
           FROM detalle_cosecha 
           WHERE calendario_id = ce.id), 0
        )) as saldo_racimos
      FROM registro_enfunde re
      JOIN calendarios_enfunde ce ON re.calendario_id = ce.id
      JOIN cintas c ON ce.color_id = c.id
      WHERE re.finca_id = $1
      GROUP BY ce.id, ce.semana, ce.anio, c.color, c.codigo_hex
      HAVING (SUM(re.cantidad_racimos) - COALESCE(
        (SELECT SUM(cantidad_racimos + cantidad_rechazo) 
         FROM detalle_cosecha 
         WHERE calendario_id = ce.id), 0
      )) > 0
      ORDER BY ce.anio ASC, ce.semana ASC
    `,
			[finca_id],
		);

		// 3. Procesar proyecciones climáticas por cada cinta
		const proyecciones = await Promise.all(
			inventario.rows.map(async (lote) => {
				const clima = await pool.query(
					`SELECT SUM(unidades_calor_dia) as acumulado, AVG(unidades_calor_dia) as promedio
           FROM historial_clima_fincas 
           WHERE finca_id = $1 AND fecha >= $2`,
					[finca_id, lote.fecha_inicio_enfunde],
				);

				const ucAcumuladas = parseFloat(clima.rows[0]?.acumulado || 0);
				const promedioDiario = parseFloat(clima.rows[0]?.promedio || 12.5);

				const porcentaje = Math.min(100, (ucAcumuladas / metaUC) * 100);
				const faltantes = Math.max(0, metaUC - ucAcumuladas);
				const diasParaCorte = Math.ceil(faltantes / promedioDiario);

				const fechaEstimada = new Date();
				fechaEstimada.setDate(fechaEstimada.getDate() + diasParaCorte);

				return {
					calendario_id: lote.calendario_id,
					semana_enfunde: lote.semana_enfunde,
					anio: lote.anio,
					color_cinta: lote.color_cinta,
					color_hex: lote.color_hex,
					saldo_racimos: lote.saldo_racimos,
					progreso_madurez: porcentaje.toFixed(1),
					dias_faltantes: diasParaCorte,
					fecha_estimada: fechaEstimada.toISOString().split('T')[0],
					cajas_esperadas: Math.floor(lote.saldo_racimos / 1.2), // Ratio ejemplo
					mensaje_clima:
						ucAcumuladas > metaUC * 0.8 ? 'Cerca de cosecha' : 'En desarrollo',
				};
			}),
		);

		res.json({ finca_id, proyecciones });
	} catch (error) {
		console.error('Error en Prediccion:', error);
		res.status(500).json({ error: 'Error al calcular madurez' });
	}
};
