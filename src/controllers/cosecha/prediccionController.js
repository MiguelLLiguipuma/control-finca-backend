import { pool } from '../../db/db.js';

export const obtenerPrediccionCosecha = async (req, res) => {
	const { finca_id } = req.params;
	try {
		const configData = await pool.query(
			`SELECT
        (SELECT unidades_calor_objetivo FROM configuracion_crecimiento WHERE finca_id = $1 LIMIT 1) as meta,
        (SELECT AVG(unidades_calor_dia) FROM (
            SELECT unidades_calor_dia FROM historial_clima_fincas
            WHERE finca_id = $1 ORDER BY fecha DESC LIMIT 7
         ) as tendencias) as promedio_reciente`,
			[finca_id],
		);

		const metaBase = Number(configData.rows[0]?.meta);
		const promedioBase = Number(configData.rows[0]?.promedio_reciente);
		const metaUC = Number.isFinite(metaBase) && metaBase > 0 ? metaBase : 900;
		const promedioUC =
			Number.isFinite(promedioBase) && promedioBase > 0 ? promedioBase : 12.8;

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

		const proyecciones = inventario.rows.map((lote) => {
			const acumuladas = Number(lote.uc_acumuladas || 0);
			const faltantes = Math.max(0, metaUC - acumuladas);
			const progreso = Math.min(100, (acumuladas / metaUC) * 100);

			const diasBrutos = faltantes === 0 ? 0 : Math.ceil(faltantes / promedioUC);
			const diasParaCorte = Number.isFinite(diasBrutos)
				? Math.max(0, Math.min(365, diasBrutos))
				: 365;

			const fechaEst = new Date();
			fechaEst.setDate(fechaEst.getDate() + diasParaCorte);

			const ratioEstimado = 1.05;
			const saldo = Number(lote.saldo_racimos || 0);

			return {
				calendario_id: lote.calendario_id,
				semana_enfunde: lote.semana_enfunde,
				anio: lote.anio,
				color_cinta: lote.color_cinta,
				color_hex: lote.color_hex,
				saldo_en_campo: saldo,
				progreso_madurez: Number(progreso.toFixed(1)),
				dias_faltantes: diasParaCorte,
				fecha_estimada: fechaEst.toISOString().split('T')[0],
				cajas_esperadas: Math.round(saldo * ratioEstimado),
				mensaje_clima:
					acumuladas >= metaUC * 0.95
						? 'Corte Urgente'
						: acumuladas >= metaUC * 0.85
						? 'Proxima Cosecha'
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
		console.error('ERROR CRITICO MOTOR COSECHA:', error);
		res.status(500).json({
			error: 'Error en proyecciones biologicas',
			detalle: error.message,
		});
	}
};
