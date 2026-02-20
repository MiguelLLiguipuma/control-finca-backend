import { query } from '../db/db.js';

export const ReportesModel = {
	async obtenerTotalAnualPorAño(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_total_anual_finca
       WHERE finca_id = $1 AND anio = $2;`,
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerTotalMensual(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_total_mensual
       WHERE finca_id = $1 AND anio = $2
       ORDER BY mes_num;`,
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerRendimientoCintas(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_rendimiento_cintas
       WHERE finca_id = $1 AND anio = $2
       ORDER BY total_fundas DESC;`,
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerMejorSemanaPorAño(fincaId, anio) {
		const { rows } = await query(
			`SELECT semana, total_fundas
       FROM vw_mejor_semana_por_año
       WHERE finca_id = $1 AND anio = $2
       ORDER BY total_fundas DESC
       LIMIT 1;`,
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerBajasProduccion(fincaId) {
		const { rows } = await query(
			'SELECT * FROM vw_bajas_produccion WHERE finca_id = $1;',
			[fincaId],
		);
		return rows;
	},

	async obtenerComparativoAnual(fincaId) {
		const { rows } = await query(
			'SELECT * FROM vw_comparativo_anual WHERE finca_id = $1;',
			[fincaId],
		);
		return rows;
	},

	async obtenerPromedioSemanalPorFinca(fincaId, anio) {
		// Blindado: calcula promedio semanal directamente sobre el agregado semanal.
		// Así no depende de columnas opcionales de otras vistas.
		const { rows } = await query(
			`SELECT COALESCE(ROUND(AVG(total_semana)::numeric, 2), 0) AS promedio_semanal
       FROM vw_total_semanal
       WHERE finca_id = $1 AND anio = $2;`,
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerTotalSemanal(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_total_semanal
       WHERE finca_id = $1 AND anio = $2
       ORDER BY semana ASC`,
			[fincaId, anio],
		);
		return rows;
	},
};
