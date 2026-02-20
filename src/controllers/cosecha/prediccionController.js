import { pool } from '../../db/db.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'America/Guayaquil';
const META_UC_DEFAULT = 900;
const PROMEDIO_UC_DEFAULT = 12.8;
const RATIO_CAJAS_DEFAULT = 1.05;

function toPositiveNumber(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const obtenerPrediccionCosecha = async (req, res) => {
	const fincaId = Number(req.params.finca_id);
	if (!Number.isInteger(fincaId) || fincaId <= 0) {
		return res.status(400).json({
			error: 'finca_id invalido',
		});
	}

	try {
		const configData = await pool.query(
			`SELECT
        cc.unidades_calor_objetivo AS meta,
        cc.semana_inicio,
        cc.semana_fin,
        cc.ratio_cajas_racimo,
        (
          SELECT AVG(unidades_calor_dia)
          FROM (
            SELECT unidades_calor_dia
            FROM historial_clima_fincas
            WHERE finca_id = $1
            ORDER BY fecha DESC
            LIMIT 7
          ) AS tendencias
        ) AS promedio_reciente
      FROM configuracion_crecimiento cc
      WHERE cc.finca_id = $1
      ORDER BY
        cc.semana_inicio ASC NULLS LAST,
        cc.semana_fin ASC NULLS LAST
      LIMIT 1`,
			[fincaId],
		);

		const row = configData.rows[0] || {};
		const metaUC = toPositiveNumber(row.meta, META_UC_DEFAULT);
		const promedioUC = toPositiveNumber(
			row.promedio_reciente,
			PROMEDIO_UC_DEFAULT,
		);
		const ratioEstimado = toPositiveNumber(
			row.ratio_cajas_racimo,
			RATIO_CAJAS_DEFAULT,
		);
		const semanaInicioBase = Number(row.semana_inicio);
		const semanaFinBase = Number(row.semana_fin);
		const semanaInicio =
			Number.isFinite(semanaInicioBase) && semanaInicioBase >= 1 && semanaInicioBase <= 52
				? Math.trunc(semanaInicioBase)
				: 11;
		const semanaFinPropuesta =
			Number.isFinite(semanaFinBase) && semanaFinBase >= 1 && semanaFinBase <= 52
				? Math.trunc(semanaFinBase)
				: 13;
		const semanaFin = Math.max(semanaInicio, semanaFinPropuesta);

		const inventario = await pool.query(
			`WITH base AS (
          SELECT
            ce.id AS calendario_id,
            ce.semana AS semana_enfunde,
            ce.anio,
            c.color AS color_cinta,
            c.color_hex,
            SUM(re.cantidad_fundas)::int AS total_fundas,
            MIN(re.fecha) AS fecha_inicio,
            COALESCE((
              SELECT SUM(rc.cantidad_racimos + rc.cantidad_rechazo)::int
              FROM registro_cosecha rc
              WHERE rc.calendario_id = ce.id
            ), 0) AS total_cosechado
          FROM registro_enfunde re
          JOIN calendarios_enfunde ce ON re.calendario_id = ce.id
          JOIN cintas c ON ce.color_id = c.id
          WHERE re.finca_id = $1
          GROUP BY ce.id, ce.semana, ce.anio, c.color, c.color_hex
        )
        SELECT
          b.calendario_id,
          b.semana_enfunde,
          b.anio,
          b.color_cinta,
          b.color_hex,
          (b.total_fundas - b.total_cosechado) AS saldo_racimos,
          b.fecha_inicio,
          COALESCE((
            SELECT SUM(h.unidades_calor_dia)
            FROM historial_clima_fincas h
            WHERE h.finca_id = $1
              AND h.fecha >= b.fecha_inicio
          ), 0) AS uc_acumuladas
        FROM base b
        WHERE (b.total_fundas - b.total_cosechado) > 0
        ORDER BY b.anio ASC, b.semana_enfunde ASC`,
			[fincaId],
		);

		const proyecciones = inventario.rows.map((lote) => {
			const acumuladas = Number(lote.uc_acumuladas || 0);
			const faltantes = Math.max(0, metaUC - acumuladas);
			const progreso = metaUC > 0 ? Math.min(100, (acumuladas / metaUC) * 100) : 0;

			const diasBrutos = faltantes === 0 ? 0 : Math.ceil(faltantes / promedioUC);
			const diasParaCorte = Number.isFinite(diasBrutos)
				? Math.max(0, Math.min(365, diasBrutos))
				: 365;

			const fechaEstimada = dayjs()
				.tz(TZ)
				.startOf('day')
				.add(diasParaCorte, 'day')
				.format('YYYY-MM-DD');
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
				fecha_estimada: fechaEstimada,
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
			finca_id: fincaId,
			meta_aplicada: metaUC,
			ratio_aplicado: Number(ratioEstimado.toFixed(4)),
			promedio_climatico_semanal: promedioUC.toFixed(2),
			promedio_uc_diario: promedioUC.toFixed(2),
			semana_inicio: semanaInicio,
			semana_fin: semanaFin,
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
