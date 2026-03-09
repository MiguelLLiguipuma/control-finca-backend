import { PrediccionAvanzadaModel } from '../../models/cosecha/prediccionAvanzadaModel.js';
import { construirPrediccionAvanzada } from '../../domain/cosecha/prediccionAvanzadaDomain.js';
import { resolveFincaScope, assertFincaInScope } from '../../utils/accessScope.js';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);

const ALGORITMO_VERSION = 'agri-ts-v3';
const DEFAULT_TZ = 'America/Guayaquil';

function crearError(message, status = 400) {
	const err = new Error(message);
	err.status = status;
	return err;
}

function cleanPositiveInt(value, fallback = null) {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) return fallback;
	return n;
}

function normalizarVentana(raw) {
	const n = Number(raw);
	if (!Number.isInteger(n)) return 8;
	return Math.max(4, Math.min(n, 8));
}

function normalizarConfig(configRow, promedioUcDiario) {
	const semanaInicio = Math.max(1, Math.min(52, Number(configRow?.semana_inicio || 12)));
	const semanaFinRaw = Math.max(1, Math.min(52, Number(configRow?.semana_fin || 13)));
	const semanaFin = Math.max(semanaInicio, semanaFinRaw);
	return {
		metaUc: Number(configRow?.meta_uc || 900),
		promedioUcDiario: Number(promedioUcDiario || 12.8),
		ratioCajasRacimo: Number(configRow?.ratio || 1.05),
		semanaInicio,
		semanaFin,
	};
}

function getIsoWeekNow(baseDate = null, tz = DEFAULT_TZ) {
	const d = baseDate ? dayjs(baseDate).tz(tz) : dayjs().tz(tz);
	return { anio: d.isoWeekYear(), semana: d.isoWeek() };
}

function getNextIsoWeek() {
	const now = getIsoWeekNow();
	let anio = now.anio;
	let semana = now.semana + 1;
	if (semana > 53) {
		semana = 1;
		anio += 1;
	}
	return { anio, semana };
}

function resolveSemanaObjetivo(query) {
	const objetivo = String(query?.objetivo || '').trim().toLowerCase();
	if (objetivo === 'proxima' || objetivo === 'siguiente') {
		return getNextIsoWeek();
	}
	return getIsoWeekNow();
}

function round(value, decimals = 2) {
	const n = Number(value || 0);
	if (!Number.isFinite(n)) return 0;
	const p = 10 ** decimals;
	return Math.round(n * p) / p;
}

function promedio(values) {
	if (!Array.isArray(values) || !values.length) return 0;
	return values.reduce((acc, n) => acc + Number(n || 0), 0) / values.length;
}

function desviacion(values) {
	if (!Array.isArray(values) || values.length < 2) return 0;
	const avg = promedio(values);
	const variance =
		values.reduce((acc, n) => {
			const d = Number(n || 0) - avg;
			return acc + d * d;
		}, 0) /
		(values.length - 1);
	return Math.sqrt(Math.max(0, variance));
}

function cv(values) {
	const avg = promedio(values);
	if (avg <= 0) return 1;
	return desviacion(values) / avg;
}

function trimmedMean(values) {
	if (!Array.isArray(values) || !values.length) return 0;
	if (values.length < 5) return promedio(values);
	const sorted = [...values].sort((a, b) => a - b);
	const k = Math.floor(sorted.length * 0.1);
	return promedio(sorted.slice(k, sorted.length - k));
}

function circularWeekDiff(a, b) {
	const diff = Math.abs(Number(a || 0) - Number(b || 0));
	return Math.min(diff, 53 - diff);
}

function calcEstacional(hist, semanaObjetivo) {
	const seasonalRows = hist.filter((x) => circularWeekDiff(x.semana_iso, semanaObjetivo) <= 1);
	const values = seasonalRows.map((x) => Number(x.total_racimos || 0));
	const n = values.length;
	const variability = cv(values);
	let nivel = 'bajo';
	if (n >= 8 && variability <= 0.2) nivel = 'alto';
	else if (n >= 5 && variability <= 0.35) nivel = 'medio';
	return {
		nivel,
		n,
		cv: variability,
		valor: seasonalRows.length ? promedio(values) : promedio(hist.map((x) => Number(x.total_racimos || 0))),
	};
}

function calcReciente(hist) {
	const recent = [...hist].slice(-8);
	const values = recent.map((x) => Number(x.total_racimos || 0));
	const n = values.length;
	const variability = cv(values);
	let nivel = 'bajo';
	if (n >= 6 && variability <= 0.25) nivel = 'alto';
	else if (n >= 4) nivel = 'medio';

	let num = 0;
	let den = 0;
	for (let i = 0; i < values.length; i += 1) {
		const w = i + 1;
		num += values[i] * w;
		den += w;
	}
	return {
		nivel,
		n,
		cv: variability,
		valor: den > 0 ? num / den : promedio(values),
	};
}

function calcPesos(estNivel, recNivel) {
	const wEst = estNivel === 'alto' ? 0.5 : estNivel === 'medio' ? 0.4 : 0.25;
	const wRec = recNivel === 'alto' ? 0.3 : recNivel === 'medio' ? 0.25 : 0.15;
	const wBase = Math.max(0.1, 1 - wEst - wRec);
	const total = wBase + wEst + wRec;
	return {
		base: wBase / total,
		estacional: wEst / total,
		tendencia: wRec / total,
	};
}

export const PrediccionAvanzadaService = {
	async ejecutar({ fincaId, user, query }) {
		const finca = cleanPositiveInt(fincaId);
		if (!finca) throw crearError('finca_id invalido', 400);

		const scope = await resolveFincaScope({
			rol: user?.rol,
			userId: Number(user?.id || 0),
		});
		assertFincaInScope(finca, scope);

		const fincaRow = await PrediccionAvanzadaModel.obtenerEmpresaDeFinca(finca);
		if (!fincaRow) throw crearError('Finca no encontrada', 404);

		const empresaUsuario = cleanPositiveInt(user?.empresa_id);
		if (empresaUsuario && Number(fincaRow.empresa_id || 0) !== empresaUsuario) {
			throw crearError('No tiene permisos para consultar esta finca', 403);
		}

		const ventana = normalizarVentana(query?.ventana);
		const objetivo = resolveSemanaObjetivo(query);

		const [configRaw, promedioUcDiario, inventario] = await Promise.all([
			PrediccionAvanzadaModel.obtenerConfiguracionFinca(finca),
			PrediccionAvanzadaModel.obtenerPromedioClimaticoReciente(finca),
			PrediccionAvanzadaModel.obtenerInventarioActual(finca),
		]);
		const config = normalizarConfig(configRaw, promedioUcDiario);

		const series = await PrediccionAvanzadaModel.obtenerSerieHistoricaSemanal({
			fincaId: finca,
			empresaId: empresaUsuario || Number(fincaRow.empresa_id || 0),
			semanaInicioIdeal: config.semanaInicio,
			semanaFinIdeal: config.semanaFin,
			semanasHistoricas: Math.max(52, ventana * 14),
		});

		const { resultado } = construirPrediccionAvanzada({
			series,
			inventario,
			config,
			fincaId: finca,
			semanaObjetivo: objetivo.semana,
			anioObjetivo: objetivo.anio,
		});

		return {
			...resultado,
			cache: {
				hit: false,
				disabled: true,
				reason: 'recalculo_forzado',
				algoritmo_version: ALGORITMO_VERSION,
				ventana_historial: ventana,
			},
			temporal_debug: {
				tz: DEFAULT_TZ,
				objetivo: 'actual',
				semana_objetivo: objetivo.semana,
				anio_objetivo: objetivo.anio,
			},
		};
	},

	async proyeccionEmbarqueComparativa({ fincaId, user, query }) {
		const finca = cleanPositiveInt(fincaId);
		if (!finca) throw crearError('finca_id invalido', 400);

		const scope = await resolveFincaScope({
			rol: user?.rol,
			userId: Number(user?.id || 0),
		});
		assertFincaInScope(finca, scope);

		const fincaRow = await PrediccionAvanzadaModel.obtenerEmpresaDeFinca(finca);
		if (!fincaRow) throw crearError('Finca no encontrada', 404);
		const empresaUsuario = cleanPositiveInt(user?.empresa_id);
		if (empresaUsuario && Number(fincaRow.empresa_id || 0) !== empresaUsuario) {
			throw crearError('No tiene permisos para consultar esta finca', 403);
		}

		const incluirBorrador =
			String(query?.incluir_borrador || '').trim().toLowerCase() === 'true';
		const historico = await PrediccionAvanzadaModel.obtenerHistoricoEmbarquesPorFinca({
			fincaId: finca,
			incluirBorrador,
			maxRows: 4000,
		});
		if (!historico.length) {
			return {
				finca_id: finca,
				message: 'Sin historial de embarques para calcular proyeccion',
				comparacion: null,
			};
		}

		const ordered = [...historico].sort((a, b) => {
			const ak = Number(a.anio_iso || 0) * 100 + Number(a.semana_iso || 0);
			const bk = Number(b.anio_iso || 0) * 100 + Number(b.semana_iso || 0);
			return ak - bk;
		});
		const objetivo = resolveSemanaObjetivo(query);
		const baseValues = ordered.map((x) => Number(x.total_racimos || 0));
		const baseHistorica = trimmedMean(baseValues);
		const est = calcEstacional(ordered, objetivo.semana);
		const rec = calcReciente(ordered);
		const pesos = calcPesos(est.nivel, rec.nivel);

		const rechazoReciente = (() => {
			const recRows = ordered.slice(-8);
			const total = recRows.reduce((acc, x) => acc + Number(x.total_racimos || 0), 0);
			const rej = recRows.reduce((acc, x) => acc + Number(x.racimos_rechazo || 0), 0);
			if (total <= 0) return 0;
			return (rej / total) * 100;
		})();

		const estimadoBruto =
			baseHistorica * pesos.base +
			est.valor * pesos.estacional +
			rec.valor * pesos.tendencia;
		const estimadoNeto = estimadoBruto * (1 - rechazoReciente / 100);
		const maeRef = desviacion(baseValues) * 0.45;

		const [configRaw, promedioUcDiario, inventario] = await Promise.all([
			PrediccionAvanzadaModel.obtenerConfiguracionFinca(finca),
			PrediccionAvanzadaModel.obtenerPromedioClimaticoReciente(finca),
			PrediccionAvanzadaModel.obtenerInventarioActual(finca),
		]);
		const semanaInicioCfg = Number(configRaw?.semana_inicio || 12);
		const semanaFinCfg = Number(configRaw?.semana_fin || 13);
		const series = await PrediccionAvanzadaModel.obtenerSerieHistoricaSemanal({
			fincaId: finca,
			empresaId: empresaUsuario || Number(fincaRow.empresa_id || 0),
			semanaInicioIdeal: semanaInicioCfg,
			semanaFinIdeal: semanaFinCfg,
			semanasHistoricas: 104,
		});
		const config = normalizarConfig(configRaw, promedioUcDiario);
		const { resultado: aproxSistema } = construirPrediccionAvanzada({
			series,
			inventario,
			config,
			fincaId: finca,
			semanaObjetivo: objetivo.semana,
			anioObjetivo: objetivo.anio,
		});
		const sistema = Number(aproxSistema?.prediccion_proximo_embarque?.racimos_estimados || 0);
		const deltaAbs = estimadoNeto - sistema;
		const deltaPct = sistema > 0 ? (deltaAbs / sistema) * 100 : 0;

		return {
			finca_id: finca,
			semana_objetivo: objetivo.semana,
			anio_objetivo: objetivo.anio,
			temporal_debug: {
				tz: DEFAULT_TZ,
				objetivo: String(query?.objetivo || 'actual'),
			},
			serie: {
				total_embarques_considerados: ordered.length,
				desde: String(ordered[0]?.fecha_embarque || ''),
				hasta: String(ordered[ordered.length - 1]?.fecha_embarque || ''),
			},
			modelo: {
				base_historica: round(baseHistorica, 2),
				estacional_semana: round(est.valor, 2),
				tendencia_reciente: round(rec.valor, 2),
				rechazo_reciente_pct: round(rechazoReciente, 2),
				pesos: {
					base: round(pesos.base, 3),
					estacional: round(pesos.estacional, 3),
					tendencia: round(pesos.tendencia, 3),
				},
				mae_ref: round(maeRef, 2),
			},
			prediccion_nueva: {
				racimos_bruto: round(estimadoBruto, 2),
				racimos_neto: round(estimadoNeto, 2),
				rango_min: round(Math.max(0, estimadoNeto - maeRef), 2),
				rango_max: round(estimadoNeto + maeRef, 2),
			},
			aproximado_sistema_actual: {
				racimos: round(sistema, 2),
			},
			comparacion: {
				delta_abs: round(deltaAbs, 2),
				delta_pct: round(deltaPct, 2),
			},
		};
	},
};
