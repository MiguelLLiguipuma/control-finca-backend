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
         ORDER BY fecha DESC
         LIMIT 7
       ) x`,
			[fincaId],
		);
		return Number(rows?.[0]?.promedio_uc || 0);
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
				Number(semanaInicioIdeal || 12),
				Number(semanaFinIdeal || 13),
				weeks,
			],
		);
		return rows || [];
	},

	async obtenerInventarioActual(fincaId) {
		const { rows } = await query(
			`SELECT
         calendario_id,
         semana_enfunde,
         anio,
         saldo_en_campo,
         color_cinta,
         color_hex
       FROM vw_balance_campo
       WHERE finca_id = $1
         AND saldo_en_campo > 0
       ORDER BY anio ASC, semana_enfunde ASC`,
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
};
