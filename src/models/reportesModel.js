import { query } from '../db/db.js';

const YTD_ISO_WEEK_SQL = 'EXTRACT(WEEK FROM CURRENT_DATE)::int';

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
	async obtenerTotalAnualPorAñoYtd(fincaId, anio) {
		const { rows } = await query(
			`SELECT
         $1::int AS finca_id,
         $2::int AS anio,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND c.semana <= ${YTD_ISO_WEEK_SQL}`,
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
	async obtenerTotalAnualPorAñoYtdUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         $1::int AS finca_id,
         $2::int AS anio,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3
         AND c.semana <= ${YTD_ISO_WEEK_SQL}`,
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
	async obtenerTotalMensualYtd(fincaId, anio) {
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
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
       GROUP BY EXTRACT(MONTH FROM r.fecha)::int
       ORDER BY mes_num`,
			[fincaId, anio],
		);
		return rows;
	},
	async obtenerTotalMensualYtdUsuario(fincaId, anio, usuarioId) {
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
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
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
	async obtenerRendimientoCintasYtd(fincaId, anio) {
		const { rows } = await query(
			`SELECT
         ci.color,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       JOIN cintas ci ON ci.id = c.color_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
       GROUP BY ci.color
       ORDER BY total_fundas DESC`,
			[fincaId, anio],
		);
		return rows;
	},
	async obtenerRendimientoCintasYtdUsuario(fincaId, anio, usuarioId) {
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
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
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
	async obtenerMejorSemanaPorAñoYtd(fincaId, anio) {
		const { rows } = await query(
			`SELECT
         c.semana,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
       GROUP BY c.semana
       ORDER BY total_fundas DESC
       LIMIT 1`,
			[fincaId, anio],
		);
		return rows;
	},
	async obtenerMejorSemanaPorAñoYtdUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT
         c.semana,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_fundas
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND r.usuario_id = $3
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
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
	async obtenerPromedioSemanalPorFincaYtd(fincaId, anio) {
		const { rows } = await query(
			`SELECT COALESCE(ROUND(AVG(total_semana)::numeric, 2), 0) AS promedio_semanal
       FROM (
         SELECT c.semana, SUM(r.cantidad_fundas)::numeric AS total_semana
         FROM registro_enfunde r
         JOIN calendarios_enfunde c ON c.id = r.calendario_id
         WHERE r.finca_id = $1
           AND c.anio = $2
           AND c.semana <= ${YTD_ISO_WEEK_SQL}
         GROUP BY c.semana
       ) s`,
			[fincaId, anio],
		);
		return rows;
	},
	async obtenerPromedioSemanalPorFincaYtdUsuario(fincaId, anio, usuarioId) {
		const { rows } = await query(
			`SELECT COALESCE(ROUND(AVG(total_semana)::numeric, 2), 0) AS promedio_semanal
       FROM (
         SELECT c.semana, SUM(r.cantidad_fundas)::numeric AS total_semana
         FROM registro_enfunde r
         JOIN calendarios_enfunde c ON c.id = r.calendario_id
         WHERE r.finca_id = $1
           AND c.anio = $2
           AND r.usuario_id = $3
           AND c.semana <= ${YTD_ISO_WEEK_SQL}
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
	async obtenerTotalSemanalYtd(fincaId, anio) {
		const { rows } = await query(
			`SELECT
         c.semana,
         $2::int AS anio,
         COALESCE(SUM(r.cantidad_fundas), 0)::numeric AS total_semana
       FROM registro_enfunde r
       JOIN calendarios_enfunde c ON c.id = r.calendario_id
       WHERE r.finca_id = $1
         AND c.anio = $2
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
       GROUP BY c.semana
       ORDER BY c.semana ASC`,
			[fincaId, anio],
		);
		return rows;
	},
	async obtenerTotalSemanalYtdUsuario(fincaId, anio, usuarioId) {
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
         AND c.semana <= ${YTD_ISO_WEEK_SQL}
       GROUP BY c.semana
       ORDER BY c.semana ASC`,
			[fincaId, anio, usuarioId],
		);
		return rows;
	},

	async obtenerAlertas({ fincaIds, dias, rechazoMinPct }) {
		const filtrosVoucher = [];
		const filtrosRechazo = ['rc.fecha >= CURRENT_DATE - ($1::int)'];
		const filtrosSinCosecha = [];
		const filtrosSanidad = [];
		const paramsRechazo = [dias];
		const paramsVoucher = [];
		const paramsSinCosecha = [];
		const paramsSanidad = [];

		if (Array.isArray(fincaIds) && fincaIds.length) {
			paramsVoucher.push(fincaIds);
			filtrosVoucher.push(
				`EXISTS (
					SELECT 1
					FROM embarque_detalles ed
					WHERE ed.embarque_id = e.id
					  AND ed.finca_id = ANY($${paramsVoucher.length}::int[])
				)`,
			);

			paramsRechazo.push(fincaIds);
			filtrosRechazo.push(`rc.finca_id = ANY($${paramsRechazo.length}::int[])`);

			paramsSinCosecha.push(fincaIds);
			filtrosSinCosecha.push(`f.id = ANY($${paramsSinCosecha.length}::int[])`);

			paramsSanidad.push(fincaIds);
			filtrosSanidad.push(`f.id = ANY($${paramsSanidad.length}::int[])`);
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

		const sanidadSql = `
			WITH ultima AS (
				SELECT
					fs.finca_id,
					MAX(fs.fecha_fumigacion)::date AS fecha_ultima_fumigacion
				FROM fumigaciones_sanidad fs
				GROUP BY fs.finca_id
			)
			SELECT
				CASE
					WHEN u.fecha_ultima_fumigacion IS NULL THEN 'SANIDAD_GRIS'
					WHEN (CURRENT_DATE - u.fecha_ultima_fumigacion) > 20 THEN 'SANIDAD_ROJO'
					WHEN (CURRENT_DATE - u.fecha_ultima_fumigacion) > 15 THEN 'SANIDAD_AMARILLO'
					ELSE 'SANIDAD_VERDE'
				END AS tipo,
				CASE
					WHEN u.fecha_ultima_fumigacion IS NULL THEN 'media'
					WHEN (CURRENT_DATE - u.fecha_ultima_fumigacion) > 20 THEN 'alta'
					WHEN (CURRENT_DATE - u.fecha_ultima_fumigacion) > 15 THEN 'media'
					ELSE 'baja'
				END AS severidad,
				f.id::text AS referencia_id,
				COALESCE(u.fecha_ultima_fumigacion::text, CURRENT_DATE::text) AS fecha_evento,
				(
					'Semáforo sanitario ' ||
					CASE
						WHEN u.fecha_ultima_fumigacion IS NULL THEN 'GRIS'
						WHEN (CURRENT_DATE - u.fecha_ultima_fumigacion) > 20 THEN 'ROJO'
						WHEN (CURRENT_DATE - u.fecha_ultima_fumigacion) > 15 THEN 'AMARILLO'
						ELSE 'VERDE'
					END ||
					' en ' || f.nombre || ': ' ||
					CASE
						WHEN u.fecha_ultima_fumigacion IS NULL THEN 'sin registro de fumigación.'
						ELSE ((CURRENT_DATE - u.fecha_ultima_fumigacion)::int)::text || ' días desde última fumigación.'
					END
				) AS mensaje
			FROM fincas f
			LEFT JOIN ultima u ON u.finca_id = f.id
			${filtrosSanidad.length ? `WHERE ${filtrosSanidad.join(' AND ')}` : ''}
			ORDER BY f.nombre ASC
			LIMIT 80
		`;

		const [vouchers, rechazo, sinCosecha, sanidad] = await Promise.all([
			query(vouchersSql, paramsVoucher),
			query(rechazoSql, paramsRechazo),
			query(sinCosechaSql, paramsSinCosecha),
			query(sanidadSql, paramsSanidad),
		]);

		return [...vouchers.rows, ...rechazo.rows, ...sinCosecha.rows, ...sanidad.rows];
	},

	async registrarFumigacion({ fincaId, fechaFumigacion, observacion, usuarioId }) {
		const { rows } = await query(
			`INSERT INTO fumigaciones_sanidad (
				finca_id,
				fecha_fumigacion,
				observacion,
				usuario_id
			)
			VALUES ($1, $2::date, $3, $4)
			RETURNING id, finca_id, fecha_fumigacion, observacion, usuario_id, created_at`,
			[fincaId, fechaFumigacion, observacion || null, usuarioId || null],
		);
		return rows[0];
	},

	async obtenerFumigaciones({ fincaIds, limit = 30 }) {
		const params = [];
		const where = [];

		if (Array.isArray(fincaIds) && fincaIds.length) {
			params.push(fincaIds);
			where.push(`fs.finca_id = ANY($${params.length}::int[])`);
		}

		const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);
		params.push(safeLimit);

		const { rows } = await query(
			`SELECT
				fs.id,
				fs.finca_id,
				f.nombre AS finca_nombre,
				fs.fecha_fumigacion,
				fs.observacion,
				fs.usuario_id,
				u.nombre AS usuario_nombre,
				fs.created_at
			FROM fumigaciones_sanidad fs
			JOIN fincas f ON f.id = fs.finca_id
			LEFT JOIN usuarios u ON u.id = fs.usuario_id
			${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			ORDER BY fs.fecha_fumigacion DESC, fs.id DESC
			LIMIT $${params.length}`,
			params,
		);

		return rows;
	},

	async obtenerAuditoria({ fechaDesde, fechaHasta, accion, usuarioId, fincaIds, limit }) {
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
		if (Array.isArray(fincaIds) && fincaIds.length) {
			params.push(fincaIds);
			where.push(`EXISTS (
				SELECT 1
				FROM embarque_detalles ed
				WHERE ed.embarque_id = a.embarque_id
				  AND ed.finca_id = ANY($${params.length}::int[])
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

	async obtenerScoreSaludSemanal({ fincaId, anio, semana }) {
		const { rows } = await query(
			`SELECT
         id,
         finca_id,
         anio,
         semana,
         total_racimos,
         corte_ideal_pct,
         rechazo_pct,
         edad_promedio,
         variacion_semanal_pct,
         score_corte,
         score_rechazo,
         score_edad,
         score_variacion,
         score_total,
         clasificacion,
         calculado_at,
         calculado_por_usuario_id
       FROM indicadores_produccion_semanal
       WHERE finca_id = $1
         AND anio = $2
         AND semana = $3
       LIMIT 1`,
			[fincaId, anio, semana],
		);
		return rows[0] || null;
	},

	async recalcularScoreSaludSemanal({ fincaId, anio, semana, usuarioId }) {
		const { rows } = await query(
			`WITH base AS (
         SELECT
           rc.finca_id,
           EXTRACT(ISOYEAR FROM rc.fecha)::int AS anio_iso,
           EXTRACT(WEEK FROM rc.fecha)::int AS semana_iso,
           (rc.cantidad_racimos + rc.cantidad_rechazo)::numeric AS total_lote,
           rc.cantidad_rechazo::numeric AS rechazo_lote,
           (
             (
               (EXTRACT(ISOYEAR FROM rc.fecha)::int - ce.anio) * 52
             ) + (
               EXTRACT(WEEK FROM rc.fecha)::int - ce.semana
             )
           )::numeric AS edad_semana
         FROM registro_cosecha rc
         JOIN calendarios_enfunde ce ON ce.id = rc.calendario_id
         WHERE rc.finca_id = $1
       ),
       week_data AS (
         SELECT
           COALESCE(SUM(total_lote), 0)::numeric AS total_racimos,
           COALESCE(SUM(rechazo_lote), 0)::numeric AS total_rechazo,
           COALESCE(
             SUM(
               CASE
                 WHEN edad_semana BETWEEN 12 AND 13 THEN total_lote
                 ELSE 0
               END
             ),
             0
           )::numeric AS total_corte_ideal,
           COALESCE(SUM(edad_semana * total_lote), 0)::numeric AS edad_ponderada
         FROM base
         WHERE anio_iso = $2
           AND semana_iso = $3
       ),
       current_week AS (
         SELECT COALESCE(SUM(total_lote), 0)::numeric AS total_racimos
         FROM base
         WHERE anio_iso = $2
           AND semana_iso = $3
       ),
       prev_label AS (
         SELECT anio_iso, semana_iso
         FROM base
         WHERE (anio_iso < $2) OR (anio_iso = $2 AND semana_iso < $3)
         GROUP BY anio_iso, semana_iso
         ORDER BY anio_iso DESC, semana_iso DESC
         LIMIT 1
       ),
       prev_week AS (
         SELECT COALESCE(SUM(b.total_lote), 0)::numeric AS total_racimos
         FROM base b
         JOIN prev_label p
           ON p.anio_iso = b.anio_iso
          AND p.semana_iso = b.semana_iso
       ),
       metrics AS (
         SELECT
           wd.total_racimos,
           CASE
             WHEN wd.total_racimos > 0
               THEN ROUND((wd.total_corte_ideal / wd.total_racimos) * 100, 2)
             ELSE 0
           END AS corte_ideal_pct,
           CASE
             WHEN wd.total_racimos > 0
               THEN ROUND((wd.total_rechazo / wd.total_racimos) * 100, 2)
             ELSE 0
           END AS rechazo_pct,
           CASE
             WHEN wd.total_racimos > 0
               THEN ROUND(wd.edad_ponderada / wd.total_racimos, 2)
             ELSE 0
           END AS edad_promedio,
           CASE
             WHEN COALESCE(pw.total_racimos, 0) > 0
               THEN ROUND(((cw.total_racimos - pw.total_racimos) / pw.total_racimos) * 100, 2)
             ELSE 0
           END AS variacion_semanal_pct
         FROM week_data wd
         CROSS JOIN current_week cw
         LEFT JOIN prev_week pw ON true
       ),
       scores AS (
         SELECT
           total_racimos,
           corte_ideal_pct,
           rechazo_pct,
           edad_promedio,
           variacion_semanal_pct,
           ROUND(LEAST(100, GREATEST(0, corte_ideal_pct)), 2) AS score_corte,
           ROUND(LEAST(100, GREATEST(0, 100 - (rechazo_pct * 2))), 2) AS score_rechazo,
           ROUND(LEAST(100, GREATEST(0, 100 - (ABS(edad_promedio - 12.5) * 20))), 2) AS score_edad,
           ROUND(LEAST(100, GREATEST(0, 100 - (ABS(variacion_semanal_pct) * 4))), 2) AS score_variacion
         FROM metrics
       ),
       final AS (
         SELECT
           total_racimos::int AS total_racimos,
           corte_ideal_pct,
           rechazo_pct,
           edad_promedio,
           variacion_semanal_pct,
           score_corte,
           score_rechazo,
           score_edad,
           score_variacion,
           ROUND(
             (score_corte * 0.35) +
             (score_rechazo * 0.30) +
             (score_edad * 0.20) +
             (score_variacion * 0.15),
             2
           ) AS score_total
         FROM scores
       )
       INSERT INTO indicadores_produccion_semanal (
         finca_id,
         anio,
         semana,
         total_racimos,
         corte_ideal_pct,
         rechazo_pct,
         edad_promedio,
         variacion_semanal_pct,
         score_corte,
         score_rechazo,
         score_edad,
         score_variacion,
         score_total,
         clasificacion,
         calculado_at,
         calculado_por_usuario_id,
         updated_at
       )
       SELECT
         $1 AS finca_id,
         $2 AS anio,
         $3 AS semana,
         f.total_racimos,
         f.corte_ideal_pct,
         f.rechazo_pct,
         f.edad_promedio,
         f.variacion_semanal_pct,
         f.score_corte,
         f.score_rechazo,
         f.score_edad,
         f.score_variacion,
         f.score_total,
         CASE
           WHEN f.score_total >= 80 THEN 'EXCELENTE'
           WHEN f.score_total >= 60 THEN 'ESTABLE'
           ELSE 'RIESGO'
         END AS clasificacion,
         NOW() AS calculado_at,
         $4::int AS calculado_por_usuario_id,
         NOW() AS updated_at
       FROM final f
       ON CONFLICT (finca_id, anio, semana)
       DO UPDATE
         SET total_racimos = EXCLUDED.total_racimos,
             corte_ideal_pct = EXCLUDED.corte_ideal_pct,
             rechazo_pct = EXCLUDED.rechazo_pct,
             edad_promedio = EXCLUDED.edad_promedio,
             variacion_semanal_pct = EXCLUDED.variacion_semanal_pct,
             score_corte = EXCLUDED.score_corte,
             score_rechazo = EXCLUDED.score_rechazo,
             score_edad = EXCLUDED.score_edad,
             score_variacion = EXCLUDED.score_variacion,
             score_total = EXCLUDED.score_total,
             clasificacion = EXCLUDED.clasificacion,
             calculado_at = EXCLUDED.calculado_at,
             calculado_por_usuario_id = EXCLUDED.calculado_por_usuario_id,
             updated_at = NOW()
       RETURNING
         id,
         finca_id,
         anio,
         semana,
         total_racimos,
         corte_ideal_pct,
         rechazo_pct,
         edad_promedio,
         variacion_semanal_pct,
         score_corte,
         score_rechazo,
         score_edad,
         score_variacion,
         score_total,
         clasificacion,
         calculado_at,
         calculado_por_usuario_id`,
			[fincaId, anio, semana, usuarioId || null],
		);
		return rows[0] || null;
	},
};
