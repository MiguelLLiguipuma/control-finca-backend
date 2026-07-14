import { query } from '../../db/db.js';

let configColumnsCache = null;

async function loadConfigColumns() {
	if (configColumnsCache) return configColumnsCache;
	try {
		const { rows } = await query(
			`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'configuracion_crecimiento'`,
		);
		const cols = new Set((rows || []).map((r) => String(r.column_name || '').toLowerCase()));
		configColumnsCache = {
			hasTable: cols.size > 0,
			hasMetaUc: cols.has('unidades_calor_objetivo'),
			hasSemanaInicio: cols.has('semana_inicio'),
			hasSemanaFin: cols.has('semana_fin'),
			hasRatioCajasRacimo: cols.has('ratio_cajas_racimo'),
			hasRatioEstimadoCajas: cols.has('ratio_estimado_cajas'),
		};
		return configColumnsCache;
	} catch {
		configColumnsCache = {
			hasTable: false,
			hasMetaUc: false,
			hasSemanaInicio: false,
			hasSemanaFin: false,
			hasRatioCajasRacimo: false,
			hasRatioEstimadoCajas: false,
		};
		return configColumnsCache;
	}
}

function cleanInt(value, fallback = null) {
	const n = Number(value);
	if (!Number.isInteger(n)) return fallback;
	return n;
}

export const PrediccionAvanzadaModel = {
	async obtenerEmpresaDeFinca(fincaId) {
		const { rows } = await query(
			`SELECT id, empresa_id
       FROM fincas
       WHERE id = $1
       LIMIT 1`,
			[fincaId],
		);
		return rows[0] || null;
	},

	async obtenerMetaFincas(fincaIds = []) {
		const ids = Array.from(
			new Set(
				(fincaIds || [])
					.map((v) => Number(v))
					.filter((n) => Number.isInteger(n) && n > 0),
			),
		);
		if (!ids.length) return [];

		const { rows } = await query(
			`SELECT
        f.id,
        f.nombre AS finca_nombre,
        COALESCE(e.nombre, 'No asignada') AS empresa_nombre
       FROM fincas f
       LEFT JOIN empresas e ON e.id = f.empresa_id
       WHERE f.id = ANY($1::int[])`,
			[ids],
		);
		return rows || [];
	},

	async obtenerConfiguracionFinca(fincaId) {
		const columns = await loadConfigColumns();
		if (!columns.hasTable) return null;

		const ratioColumn = columns.hasRatioCajasRacimo
			? 'cc.ratio_cajas_racimo'
			: columns.hasRatioEstimadoCajas
			? 'cc.ratio_estimado_cajas'
			: 'NULL::numeric';

		const sql = `SELECT
      ${columns.hasMetaUc ? 'cc.unidades_calor_objetivo' : 'NULL::numeric'} AS meta_uc,
      ${columns.hasSemanaInicio ? 'cc.semana_inicio' : 'NULL::int'} AS semana_inicio,
      ${columns.hasSemanaFin ? 'cc.semana_fin' : 'NULL::int'} AS semana_fin,
      ${ratioColumn} AS ratio
    FROM configuracion_crecimiento cc
    WHERE cc.finca_id = $1
    ORDER BY cc.finca_id ASC
    LIMIT 1`;

		const { rows } = await query(sql, [fincaId]);
		return rows[0] || null;
	},

	async obtenerPromedioClimaticoReciente(fincaId) {
		const { rows } = await query(
			`SELECT AVG(x.unidades_calor_dia)::numeric AS promedio_uc
       FROM (
         SELECT unidades_calor_dia
         FROM historial_clima_fincas
         WHERE finca_id = $1
           AND fecha <= CURRENT_DATE
           AND fecha >= CURRENT_DATE - INTERVAL '6 days'
         ORDER BY fecha DESC
         LIMIT 7
       ) x`,
			[fincaId],
		);
		return Number(rows?.[0]?.promedio_uc || 0);
	},

	async obtenerSaludClimatica(fincaId) {
		const { rows } = await query(
			`SELECT
         MAX(fecha)::date AS ultima_fecha_clima,
         CASE
           WHEN MAX(fecha) IS NULL THEN NULL
           ELSE (CURRENT_DATE - MAX(fecha)::date)::int
         END AS dias_atraso,
         COUNT(fecha)::int AS registros_total,
         COUNT(fecha) FILTER (
           WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
             AND fecha <= CURRENT_DATE
         )::int AS registros_ultimos_7_dias,
         AVG(unidades_calor_dia) FILTER (
           WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
             AND fecha <= CURRENT_DATE
         )::numeric AS promedio_uc_7_dias
       FROM historial_clima_fincas
       WHERE finca_id = $1`,
			[fincaId],
		);
		const row = rows?.[0] || {};
		const ultimaFecha = row.ultima_fecha_clima || null;
		const diasAtraso = ultimaFecha ? Number(row.dias_atraso || 0) : null;
		const registrosUltimos7 = Number(row.registros_ultimos_7_dias || 0);
		const staleDays = Number(process.env.WEATHER_STALE_DAYS || 2);
		const estado = !ultimaFecha
			? 'SIN_DATOS'
			: diasAtraso > staleDays || registrosUltimos7 === 0
				? 'ATRASADO'
				: 'ACTUALIZADO';

		return {
			ultima_fecha_clima: ultimaFecha,
			dias_atraso: diasAtraso,
			registros_total: Number(row.registros_total || 0),
			registros_ultimos_7_dias: registrosUltimos7,
			promedio_uc_7_dias:
				row.promedio_uc_7_dias === null ? null : Number(row.promedio_uc_7_dias || 0),
			estado,
			confiable: estado === 'ACTUALIZADO',
		};
	},

	async obtenerSerieHistoricaSemanal({
		fincaId,
		empresaId,
		semanaInicioIdeal,
		semanaFinIdeal,
		semanasHistoricas = 104,
	}) {
		const weeks = Math.min(Math.max(Number(semanasHistoricas || 0), 12), 208);
		const { rows } = await query(
			`WITH base AS (
         SELECT
           EXTRACT(ISOYEAR FROM rc.fecha)::int AS anio_iso,
           EXTRACT(WEEK FROM rc.fecha)::int AS semana_iso,
           rc.cantidad_racimos::numeric AS racimos_buenos,
           rc.cantidad_rechazo::numeric AS racimos_rechazo,
           (rc.cantidad_racimos + rc.cantidad_rechazo)::numeric AS total_racimos,
           GREATEST(
             0,
             (
               date_trunc('week', rc.fecha)::date -
               to_date(
                 ce.anio::text || '-' || LPAD(ce.semana::text, 2, '0') || '-1',
                 'IYYY-IW-ID'
               )
             ) / 7.0
           )::numeric AS edad_semanas
         FROM registro_cosecha rc
         JOIN calendarios_enfunde ce ON ce.id = rc.calendario_id
         JOIN fincas f ON f.id = rc.finca_id
         WHERE rc.finca_id = $1
           AND rc.fecha >= CURRENT_DATE - (($5::int || ' weeks')::interval)
           AND ($2::int IS NULL OR f.empresa_id = $2)
       )
       SELECT
         anio_iso,
         semana_iso,
         SUM(racimos_buenos)::numeric AS racimos_buenos,
         SUM(racimos_rechazo)::numeric AS racimos_rechazo,
         SUM(total_racimos)::numeric AS total_racimos,
         CASE
           WHEN SUM(total_racimos) > 0
             THEN ROUND((SUM(racimos_rechazo) / SUM(total_racimos)) * 100, 2)
           ELSE 0
         END AS rechazo_pct,
         CASE
           WHEN SUM(total_racimos) > 0
             THEN ROUND((
               SUM(
                 CASE
                   WHEN edad_semanas BETWEEN $3::numeric AND $4::numeric
                     THEN total_racimos
                   ELSE 0
                 END
               ) / SUM(total_racimos)
             ) * 100, 2)
           ELSE 0
         END AS ideal_pct,
         CASE
           WHEN SUM(total_racimos) > 0
             THEN ROUND(SUM(edad_semanas * total_racimos) / SUM(total_racimos), 2)
           ELSE 0
         END AS edad_promedio
       FROM base
       GROUP BY anio_iso, semana_iso
       ORDER BY anio_iso ASC, semana_iso ASC`,
			[
				fincaId,
				cleanInt(empresaId),
				Number(semanaInicioIdeal ?? 11),
				Number(semanaFinIdeal ?? 12),
				weeks,
			],
		);
		return rows || [];
	},

	async obtenerInventarioActual(fincaId) {
		const { rows } = await query(
			`WITH saldo AS (
         SELECT
           vbc.calendario_id,
           vbc.semana_enfunde,
           vbc.anio,
           vbc.saldo_en_campo,
           vbc.color_cinta,
           vbc.color_hex
         FROM vw_balance_campo vbc
         WHERE vbc.finca_id = $1
           AND vbc.saldo_en_campo > 0
       ),
       inicio AS (
         SELECT
           re.calendario_id,
           MIN(re.fecha)::date AS fecha_inicio
         FROM registro_enfunde re
         WHERE re.finca_id = $1
         GROUP BY re.calendario_id
       )
       SELECT
         s.calendario_id,
         s.semana_enfunde,
         s.anio,
         s.saldo_en_campo,
         s.color_cinta,
         s.color_hex,
         i.fecha_inicio,
         COALESCE((
           SELECT SUM(h.unidades_calor_dia)::numeric
           FROM historial_clima_fincas h
           WHERE h.finca_id = $1
             AND i.fecha_inicio IS NOT NULL
             AND h.fecha >= i.fecha_inicio
             AND h.fecha <= CURRENT_DATE
         ), 0)::numeric AS uc_acumuladas
       FROM saldo s
       LEFT JOIN inicio i ON i.calendario_id = s.calendario_id
       ORDER BY s.anio ASC, s.semana_enfunde ASC`,
			[fincaId],
		);
		return rows || [];
	},

	async obtenerCachePrediccion({
		empresaId,
		fincaId,
		anioObjetivo,
		semanaObjetivo,
		ventana,
		algoritmoVersion,
		sourceHash,
	}) {
		const { rows } = await query(
			`SELECT resultado_json
       FROM predicciones_cosecha_semanal
       WHERE empresa_id = $1
         AND finca_id = $2
         AND anio_objetivo = $3
         AND semana_objetivo = $4
         AND ventana_historial = $5
         AND algoritmo_version = $6
         AND fuente_hash = $7
       LIMIT 1`,
			[
				empresaId,
				fincaId,
				anioObjetivo,
				semanaObjetivo,
				ventana,
				algoritmoVersion,
				sourceHash,
			],
		);
		return rows[0]?.resultado_json || null;
	},

	async guardarCachePrediccion({
		empresaId,
		fincaId,
		anioObjetivo,
		semanaObjetivo,
		ventana,
		algoritmoVersion,
		sourceHash,
		resultado,
		usuarioId,
	}) {
		await query(
			`INSERT INTO predicciones_cosecha_semanal (
         empresa_id,
         finca_id,
         anio_objetivo,
         semana_objetivo,
         ventana_historial,
         algoritmo_version,
         fuente_hash,
         resultado_json,
         generado_por_usuario_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       ON CONFLICT (
         empresa_id,
         finca_id,
         anio_objetivo,
         semana_objetivo,
         ventana_historial,
         algoritmo_version
       )
       DO UPDATE SET
         fuente_hash = EXCLUDED.fuente_hash,
         resultado_json = EXCLUDED.resultado_json,
         generado_por_usuario_id = EXCLUDED.generado_por_usuario_id,
         actualizado_en = NOW()`,
			[
				empresaId,
				fincaId,
				anioObjetivo,
				semanaObjetivo,
				ventana,
				algoritmoVersion,
				sourceHash,
				JSON.stringify(resultado || {}),
				usuarioId || null,
			],
		);
	},

	async obtenerHistoricoEmbarquesPorFinca({
		fincaId,
		incluirBorrador = false,
		maxRows = 1000,
	}) {
		const { rows } = await query(
			`SELECT
         e.id AS embarque_id,
         e.fecha_embarque::date AS fecha_embarque,
         EXTRACT(ISOYEAR FROM e.fecha_embarque)::int AS anio_iso,
         EXTRACT(WEEK FROM e.fecha_embarque)::int AS semana_iso,
         COALESCE(SUM(ed.total_racimos), 0)::numeric AS total_racimos,
         COALESCE(SUM(ed.racimos_rechazo), 0)::numeric AS racimos_rechazo
       FROM embarques e
       JOIN embarque_detalles ed ON ed.embarque_id = e.id
       WHERE ed.finca_id = $1
         AND ($2::boolean OR e.estado = 'CONFIRMADO')
       GROUP BY e.id, e.fecha_embarque
       ORDER BY e.fecha_embarque ASC
       LIMIT $3`,
			[fincaId, incluirBorrador, Math.max(1, Math.min(Number(maxRows || 1000), 5000))],
		);
		return rows || [];
	},
};
