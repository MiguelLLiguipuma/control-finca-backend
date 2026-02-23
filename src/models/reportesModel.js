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
	async obtenerTotalAnualPorAñoUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         $1::int AS finca_id,
         $2::int AS anio,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3`,
			[fincaId, anio, usuarioId],
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
	async obtenerTotalMensualUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         EXTRACT(MONTH FROM r.fecha)::int AS mes_num,
         CASE EXTRACT(MONTH FROM r.fecha)::int
           WHEN 1 THEN 'January'
           WHEN 2 THEN 'February'
           WHEN 3 THEN 'March'
           WHEN 4 THEN 'April'
           WHEN 5 THEN 'May'
           WHEN 6 THEN 'June'
           WHEN 7 THEN 'July'
           WHEN 8 THEN 'August'
           WHEN 9 THEN 'September'
           WHEN 10 THEN 'October'
           WHEN 11 THEN 'November'
           ELSE 'December'
         END AS mes,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_mes
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3
       GROUP BY EXTRACT(MONTH FROM r.fecha)::int
       ORDER BY mes_num`,
			[fincaId, anio, usuarioId],
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
	async obtenerRendimientoCintasUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         ci.color,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       JOIN cintas ci ON ci.id = c.color_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3
       GROUP BY ci.color
       ORDER BY total_fundas DESC`,
			[fincaId, anio, usuarioId],
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
	async obtenerMejorSemanaPorAñoUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         c.semana,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3
       GROUP BY c.semana
       ORDER BY total_fundas DESC
       LIMIT 1`,
			[fincaId, anio, usuarioId],
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
	async obtenerPromedioSemanalPorFincaUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT COALESCE(ROUND(AVG(total_semana)::numeric, 2), 0) AS promedio_semanal
       FROM (
         SELECT c.semana, SUM(r.cantidad_fundas)::numeric AS total_semana
         FROM registro_enfunde r
         JOIN calendarios_enfunde c ON c.id = r.calendario_id
         WHERE r.finca_id = $1
           AND c.anio = $2
           AND r.usuario_id = $3
         GROUP BY c.semana
       ) s`,
			[fincaId, anio, usuarioId],
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
	async obtenerTotalSemanalUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         c.semana,
         $2::int AS anio,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_semana
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3
       GROUP BY c.semana
       ORDER BY c.semana ASC`,
			[fincaId, anio, usuarioId],
		);
		return rows;
	},

	async obtenerAlertas({ fincaId, dias, rechazoMinPct }) {
		const filtrosVoucher = [];
		const filtrosRechazo = ['rc.fecha >= CURRENT_DATE - ($1::int)'];
		const filtrosSinCosecha = [];
		const paramsRechazo = [dias];
		const paramsVoucher = [];
		const paramsSinCosecha = [];

		if (fincaId) {
			paramsVoucher.push(fincaId);
			filtrosVoucher.push(
				`EXISTS (
					SELECT 1
					FROM embarque_detalles ed
					WHERE ed.embarque_id = e.id
					  AND ed.finca_id = $${paramsVoucher.length}
				)`,
			);

			paramsRechazo.push(fincaId);
			filtrosRechazo.push(`rc.finca_id = $${paramsRechazo.length}`);

			paramsSinCosecha.push(fincaId);
			filtrosSinCosecha.push(`f.id = $${paramsSinCosecha.length}`);
		}

		const vouchersSql = `
			SELECT
				'VOUCHER_BORRADOR' AS tipo,
				'alta' AS severidad,
				e.id::text AS referencia_id,
				e.fecha_embarque::text AS fecha_evento,
				'Voucher en borrador pendiente de confirmación' AS mensaje
			FROM embarques e
			WHERE e.estado = 'BORRADOR'
			  AND e.fecha_embarque <= CURRENT_DATE
			  ${filtrosVoucher.length ? `AND ${filtrosVoucher.join(' AND ')}` : ''}
			ORDER BY e.fecha_embarque ASC
			LIMIT 50
		`;

		const rechazoSql = `
			SELECT
				'RECHAZO_ALTO' AS tipo,
				'media' AS severidad,
				(f.id::text || '-' || rc.fecha::text) AS referencia_id,
				rc.fecha::text AS fecha_evento,
				('Rechazo alto en ' || f.nombre || ': ' ||
				  ROUND(
				  	(SUM(rc.cantidad_rechazo)::numeric /
				  	NULLIF(SUM(rc.cantidad_racimos + rc.cantidad_rechazo), 0)) * 100
				  ,2) || '%') AS mensaje
			FROM registro_cosecha rc
			JOIN fincas f ON f.id = rc.finca_id
			WHERE ${filtrosRechazo.join(' AND ')}
			GROUP BY f.id, f.nombre, rc.fecha
			HAVING (
				(SUM(rc.cantidad_rechazo)::numeric /
				 NULLIF(SUM(rc.cantidad_racimos + rc.cantidad_rechazo), 0)) * 100
			) >= $${paramsRechazo.length + 1}
			ORDER BY rc.fecha DESC
			LIMIT 80
		`;
		paramsRechazo.push(rechazoMinPct);

		const sinCosechaSql = `
			SELECT
				'SIN_COSECHA_HOY' AS tipo,
				'baja' AS severidad,
				f.id::text AS referencia_id,
				CURRENT_DATE::text AS fecha_evento,
				('No hay registro de cosecha hoy para finca ' || f.nombre) AS mensaje
			FROM fincas f
			WHERE NOT EXISTS (
				SELECT 1
				FROM registro_cosecha rc
				WHERE rc.finca_id = f.id
				  AND rc.fecha = CURRENT_DATE
			)
			${filtrosSinCosecha.length ? `AND ${filtrosSinCosecha.join(' AND ')}` : ''}
			ORDER BY f.nombre ASC
			LIMIT 80
		`;

		const [vouchers, rechazo, sinCosecha] = await Promise.all([
			query(vouchersSql, paramsVoucher),
			query(rechazoSql, paramsRechazo),
			query(sinCosechaSql, paramsSinCosecha),
		]);

		return [...vouchers.rows, ...rechazo.rows, ...sinCosecha.rows];
	},

	async obtenerAuditoria({ fechaDesde, fechaHasta, accion, usuarioId, fincaId, limit }) {
		const params = [];
		const where = [];

		if (fechaDesde) {
			params.push(fechaDesde);
			where.push(`a.created_at::date >= $${params.length}::date`);
		}
		if (fechaHasta) {
			params.push(fechaHasta);
			where.push(`a.created_at::date <= $${params.length}::date`);
		}
		if (accion) {
			params.push(String(accion).toUpperCase());
			where.push(`a.accion = $${params.length}`);
		}
		if (usuarioId) {
			params.push(usuarioId);
			where.push(`a.usuario_id = $${params.length}`);
		}
		if (fincaId) {
			params.push(fincaId);
			where.push(`EXISTS (
				SELECT 1
				FROM embarque_detalles ed
				WHERE ed.embarque_id = a.embarque_id
				  AND ed.finca_id = $${params.length}
			)`);
		}

		const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
		params.push(safeLimit);

		const sql = `
			SELECT
				a.id,
				a.created_at,
				a.accion,
				a.detalle,
				a.usuario_id,
				u.nombre AS usuario_nombre,
				a.embarque_id,
				e.numero_voucher
			FROM embarque_auditoria a
			LEFT JOIN usuarios u ON u.id = a.usuario_id
			LEFT JOIN embarques e ON e.id = a.embarque_id
			${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			ORDER BY a.created_at DESC
			LIMIT $${params.length}
		`;

		const { rows } = await query(sql, params);
		return rows;
	},
};
