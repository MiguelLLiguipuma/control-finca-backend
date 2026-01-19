import { query } from '../db/db.js';

export const ReportesModel = {
	async obtenerTotalAnualPorAño(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_total_anual_finca
       WHERE finca_id = $1 AND anio = $2;`, // ✅ Filtro doble añadido
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerTotalMensual(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_total_mensual
       WHERE finca_id = $1 AND anio = $2
       ORDER BY mes_num;`, // ✅ Filtro doble añadido
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
       LIMIT 1;`, // ✅ Filtro por finca añadido
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerBajasProduccion(fincaId) {
		// Asumiendo que vw_bajas_produccion ya tiene la columna finca_id
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
		const { rows } = await query(
			`SELECT *
       FROM vw_total_anual_finca
       WHERE finca_id = $1 AND anio = $2;`, // Usamos la vista corregida anteriormente
			[fincaId, anio],
		);
		return rows;
	},

	async obtenerTotalSemanal(fincaId, anio) {
		const { rows } = await query(
			`SELECT *
       FROM vw_total_semanal
       WHERE finca_id = $1 AND anio = $2
       ORDER BY semana ASC `,
			[fincaId, anio],
		);
		return rows;
	},
};
