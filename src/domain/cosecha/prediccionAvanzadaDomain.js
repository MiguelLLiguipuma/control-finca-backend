const HISTORICO_MINIMO_SEMANAS = 4;

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 2) {
	const n = Number(value || 0);
	if (!Number.isFinite(n)) return 0;
	const factor = 10 ** decimals;
	return Math.round(n * factor) / factor;
}

function promedio(values) {
	if (!Array.isArray(values) || !values.length) return 0;
	const total = values.reduce((acc, v) => acc + Number(v || 0), 0);
	return total / values.length;
}

function promedioPonderado(values, weights) {
	if (!Array.isArray(values) || !values.length) return 0;
	if (!Array.isArray(weights) || weights.length !== values.length) {
		return promedio(values);
	}
	let sumValues = 0;
	let sumWeights = 0;
	for (let i = 0; i < values.length; i += 1) {
		const w = Number(weights[i] || 0);
		const v = Number(values[i] || 0);
		if (!Number.isFinite(w) || w <= 0) continue;
		sumValues += v * w;
		sumWeights += w;
	}
	if (sumWeights <= 0) return promedio(values);
	return sumValues / sumWeights;
}

function desviacionEstandar(values) {
	if (!Array.isArray(values) || values.length < 2) return 0;
	const mean = promedio(values);
	const variance =
		values.reduce((acc, value) => {
			const diff = Number(value || 0) - mean;
			return acc + diff * diff;
		}, 0) /
		(values.length - 1);
	return Math.sqrt(Math.max(0, variance));
}

function proyeccionLineal(values) {
	const y = Array.isArray(values) ? values.map((v) => Number(v || 0)) : [];
	if (y.length < 2) {
		return {
			slope: 0,
			next: y.length ? y[y.length - 1] : 0,
		};
	}

	const n = y.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;

	for (let i = 0; i < n; i += 1) {
		sumX += i;
		sumY += y[i];
		sumXY += i * y[i];
		sumXX += i * i;
	}

	const denominator = n * sumXX - sumX * sumX;
	if (denominator === 0) {
		return {
			slope: 0,
			next: y[n - 1],
		};
	}

	const slope = (n * sumXY - sumX * sumY) / denominator;
	const intercept = (sumY - slope * sumX) / n;
	const next = intercept + slope * n;

	return {
		slope,
		next,
	};
}

function etiquetaTendencia(slope, baseline) {
	const base = Math.max(1, Number(baseline || 0));
	const ratio = slope / base;
	if (ratio >= 0.03) return 'SUBIENDO';
	if (ratio <= -0.03) return 'BAJANDO';
	return 'ESTABLE';
}

function weekDistance(a, b) {
	const toIdx = (item) => Number(item.anio_iso || 0) * 53 + Number(item.semana_iso || 0);
	return Math.abs(toIdx(a) - toIdx(b));
}

function factorEstacional(series, semanaObjetivo) {
	if (!Array.isArray(series) || !series.length) return 1;
	const objetivo = Number(semanaObjetivo || 0);
	if (!Number.isInteger(objetivo) || objetivo < 1 || objetivo > 53) return 1;

	const globalAvg = promedio(series.map((x) => Number(x.total_racimos || 0)));
	if (globalAvg <= 0) return 1;

	const alrededor = series.filter((x) => {
		const w = Number(x.semana_iso || 0);
		if (!w) return false;
		const rawDiff = Math.abs(w - objetivo);
		const circularDiff = Math.min(rawDiff, 53 - rawDiff);
		return circularDiff <= 1;
	});

	if (!alrededor.length) return 1;
	const seasonalAvg = promedio(alrededor.map((x) => Number(x.total_racimos || 0)));
	if (seasonalAvg <= 0) return 1;

	return clamp(seasonalAvg / globalAvg, 0.85, 1.15);
}

function confidenceLabel(cantidadSemanas, coefVariacion) {
	if (cantidadSemanas >= 8 && coefVariacion <= 0.25) return 'ALTA';
	if (cantidadSemanas >= 6 && coefVariacion <= 0.4) return 'MEDIA';
	return 'BAJA';
}

function asegurarEnteroNoNegativo(value) {
	const n = Number(value || 0);
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.round(n));
}

function isoWeekStartDateUTC(anio, semana) {
	const january4 = new Date(Date.UTC(anio, 0, 4));
	const day = january4.getUTCDay() || 7;
	const mondayWeek1 = new Date(january4);
	mondayWeek1.setUTCDate(january4.getUTCDate() - day + 1);
	const target = new Date(mondayWeek1);
	target.setUTCDate(mondayWeek1.getUTCDate() + (semana - 1) * 7);
	target.setUTCHours(0, 0, 0, 0);
	return target;
}

function semanasEntreISO(anioInicio, semanaInicio, anioFin, semanaFin) {
	const a = isoWeekStartDateUTC(anioInicio, semanaInicio);
	const b = isoWeekStartDateUTC(anioFin, semanaFin);
	const diffDays = (b.getTime() - a.getTime()) / 86400000;
	return diffDays / 7;
}

function sumarDiasISO(fechaBase, dias) {
	const d = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth(), fechaBase.getUTCDate()));
	d.setUTCDate(d.getUTCDate() + Math.max(0, Number(dias || 0)));
	return d.toISOString().slice(0, 10);
}

function proyeccionPorLote(
	inventario,
	ratio,
	corteInicio,
	corteFin,
	anioActual,
	semanaActual,
	metaUc,
	promedioUcDiario,
) {
	if (!Array.isArray(inventario)) return [];
	const inicio = Number(corteInicio || 12);
	const fin = Math.max(inicio, Number(corteFin || 13));
	const ventana = Math.max(1, fin - inicio);
	const metaUcSafe = Math.max(1, Number(metaUc || 900));
	const ucDiarioSafe = Math.max(0.1, Number(promedioUcDiario || 12.8));
	const todayUtc = new Date();

	return inventario
		.map((row) => {
			const anio = Number(row.anio || anioActual);
			const semanaEnfunde = Number(row.semana_enfunde || 0);
			const saldo = asegurarEnteroNoNegativo(row.saldo_en_campo);
			const edadActual = Math.max(0, semanasEntreISO(anio, semanaEnfunde, anioActual, semanaActual));
			const semanasRestantesEdad = Math.max(0, inicio - edadActual);
			const ucAcumuladas = Math.max(0, Number(row.uc_acumuladas || 0));
			const faltanteUc = Math.max(0, metaUcSafe - ucAcumuladas);
			const diasPorUc = Math.ceil(faltanteUc / ucDiarioSafe);
			const diasPorEdad = Math.ceil(semanasRestantesEdad * 7);
			const madurezTermica = clamp((ucAcumuladas / metaUcSafe) * 100, 0, 100);
			const madurezEdad =
				edadActual < inicio
					? clamp((edadActual / Math.max(1, inicio)) * 80, 0, 79.9)
					: edadActual <= fin
					? clamp(80 + ((edadActual - inicio) / ventana) * 20, 80, 100)
					: 100;
			const usaClima = ucAcumuladas > 0;
			const diasFaltantes = usaClima ? Math.max(0, diasPorUc) : diasPorEdad;
			const madurez = usaClima ? madurezTermica : madurezEdad;
			const mensaje =
				edadActual > fin || madurez >= 98
					? 'Corte Urgente'
					: edadActual >= inicio || madurez >= 85
					? 'Proxima Cosecha'
					: 'En Desarrollo';
			const fechaEstimada = sumarDiasISO(todayUtc, diasFaltantes);

			return {
				calendario_id: Number(row.calendario_id),
				semana_enfunde: semanaEnfunde,
				anio,
				color_cinta: String(row.color_cinta || ''),
				color_hex: String(row.color_hex || '#9E9E9E'),
				saldo_en_campo: saldo,
				progreso_madurez: round(madurez, 1),
				dias_faltantes: diasFaltantes,
				fecha_estimada: fechaEstimada,
				cajas_esperadas: asegurarEnteroNoNegativo(saldo * Number(ratio || 1)),
				mensaje_clima: mensaje,
				tendencia_climatica: ucDiarioSafe >= 14 ? 'Calor Alto' : 'Normal',
			};
		})
		.sort((a, b) => a.dias_faltantes - b.dias_faltantes);
}

function calcularFechaISODesdeSemana(anio, semana) {
	const january4 = new Date(Date.UTC(anio, 0, 4));
	const day = january4.getUTCDay() || 7;
	const mondayWeek1 = new Date(january4);
	mondayWeek1.setUTCDate(january4.getUTCDate() - day + 1);
	const target = new Date(mondayWeek1);
	target.setUTCDate(mondayWeek1.getUTCDate() + (semana - 1) * 7);
	return target.toISOString().slice(0, 10);
}

function getIsoWeekNow(dateInput = new Date()) {
	const d = new Date(
		Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()),
	);
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
	return { anio: d.getUTCFullYear(), semana: weekNo };
}

function hashSimpleString(input) {
	const text = String(input || '');
	let hash = 0;
	for (let i = 0; i < text.length; i += 1) {
		hash = (hash << 5) - hash + text.charCodeAt(i);
		hash |= 0;
	}
	return String(hash >>> 0);
}

export function construirPrediccionAvanzada({
	series,
	inventario,
	config,
	fincaId,
	fechaBase = new Date(),
	semanaObjetivo = null,
	anioObjetivo = null,
}) {
	const configSafe = {
		semanaInicio: Number(config?.semanaInicio || 12),
		semanaFin: Number(config?.semanaFin || 13),
		ratioCajasRacimo: Number(config?.ratioCajasRacimo || 1.05),
		metaUc: Number(config?.metaUc || 900),
		promedioUcDiario: Number(config?.promedioUcDiario || 12.8),
	};

	const seriesOrdenadas = [...(series || [])].sort((a, b) => {
		const aIdx = Number(a.anio_iso || 0) * 53 + Number(a.semana_iso || 0);
		const bIdx = Number(b.anio_iso || 0) * 53 + Number(b.semana_iso || 0);
		return aIdx - bIdx;
	});
	const recientes = seriesOrdenadas.slice(-8);

	const now = getIsoWeekNow(fechaBase);
	const target = {
		anio: Number.isInteger(Number(anioObjetivo)) ? Number(anioObjetivo) : now.anio,
		semana: Number.isInteger(Number(semanaObjetivo))
			? Number(semanaObjetivo)
			: now.semana,
	};

	if (recientes.length < HISTORICO_MINIMO_SEMANAS) {
		const proyecciones = proyeccionPorLote(
			inventario,
			configSafe.ratioCajasRacimo,
			configSafe.semanaInicio,
			configSafe.semanaFin,
			now.anio,
			now.semana,
			configSafe.metaUc,
			configSafe.promedioUcDiario,
		);

		const totalSaldo = proyecciones.reduce((acc, p) => acc + Number(p.saldo_en_campo || 0), 0);
		const estimado = round(totalSaldo * 0.55, 0);
		const min = Math.max(0, round(estimado * 0.8, 0));
		const max = round(estimado * 1.2, 0);
		const ideal = round(estimado * 0.6, 0);

		const respuesta = {
			finca_id: fincaId,
			meta_aplicada: round(configSafe.metaUc, 2),
			promedio_climatico_semanal: round(configSafe.promedioUcDiario, 2).toFixed(2),
			promedio_uc_diario: round(configSafe.promedioUcDiario, 2).toFixed(2),
			ratio_aplicado: round(configSafe.ratioCajasRacimo, 4),
			semana_inicio: configSafe.semanaInicio,
			semana_fin: configSafe.semanaFin,
			proyecciones,
			prediccion_proximo_embarque: {
				anio_objetivo: target.anio,
				semana_objetivo: target.semana,
				racimos_estimados: asegurarEnteroNoNegativo(estimado),
				rango_minimo: asegurarEnteroNoNegativo(min),
				rango_maximo: asegurarEnteroNoNegativo(max),
				racimos_rango_ideal: asegurarEnteroNoNegativo(ideal),
				racimos_en_riesgo: asegurarEnteroNoNegativo(Math.max(0, estimado - ideal)),
				rechazo_estimado_pct: 12,
				edad_promedio_corte: round((configSafe.semanaInicio + configSafe.semanaFin) / 2, 2),
				tendencia: 'SIN_HISTORICO',
				confianza: 'BAJA',
				sigma: 0,
				factor_estacional: 1,
				metodo: 'fallback_operativo',
			},
			modelo: {
				version: 'agri-ts-v1',
				semanas_analizadas: recientes.length,
				mensaje:
					'Historico insuficiente (minimo 4 semanas). Se aplico estimacion conservadora con inventario actual.',
			},
		};

		return {
			resultado: respuesta,
			sourceHash: hashSimpleString(JSON.stringify({ recientes, totalSaldo, target })),
		};
	}

	const totales = recientes.map((x) => Number(x.total_racimos || 0));
	const rechazoPct = recientes.map((x) => Number(x.rechazo_pct || 0));
	const idealPct = recientes.map((x) => Number(x.ideal_pct || 0));
	const edades = recientes.map((x) => Number(x.edad_promedio || 0));
	const pesos = recientes.map((_, i) => i + 1);

	const mediaPonderada = promedioPonderado(totales, pesos);
	const { slope, next } = proyeccionLineal(totales);
	const trendBlend = 0.6 * mediaPonderada + 0.4 * Math.max(0, next);
	const estacional = factorEstacional(seriesOrdenadas, target.semana);
	const estimadoAjustado = Math.max(0, trendBlend * estacional);

	const rechazoEsperado = clamp(promedioPonderado(rechazoPct, pesos), 0, 45);
	const idealEsperadoPct = clamp(promedioPonderado(idealPct, pesos), 20, 95);
	const edadEsperada = Math.max(0, promedioPonderado(edades, pesos));

	const sigma = desviacionEstandar(totales);
	const minimo = Math.max(0, estimadoAjustado - sigma);
	const maximo = Math.max(minimo, estimadoAjustado + sigma);

	const racimosIdeal = estimadoAjustado * (idealEsperadoPct / 100);
	const racimosRiesgo = Math.max(0, estimadoAjustado - racimosIdeal);
	const tendencia = etiquetaTendencia(slope, promedio(totales));
	const coefVariacion = promedio(totales) > 0 ? sigma / promedio(totales) : 1;
	const confianza = confidenceLabel(recientes.length, coefVariacion);

	const proyecciones = proyeccionPorLote(
		inventario,
		configSafe.ratioCajasRacimo,
		configSafe.semanaInicio,
		configSafe.semanaFin,
		now.anio,
		now.semana,
		configSafe.metaUc,
		configSafe.promedioUcDiario,
	);

	const respuesta = {
		finca_id: fincaId,
		meta_aplicada: round(configSafe.metaUc, 2),
		promedio_climatico_semanal: round(configSafe.promedioUcDiario, 2).toFixed(2),
		promedio_uc_diario: round(configSafe.promedioUcDiario, 2).toFixed(2),
		ratio_aplicado: round(configSafe.ratioCajasRacimo, 4),
		semana_inicio: configSafe.semanaInicio,
		semana_fin: configSafe.semanaFin,
		proyecciones,
		prediccion_proximo_embarque: {
			anio_objetivo: target.anio,
			semana_objetivo: target.semana,
			racimos_estimados: asegurarEnteroNoNegativo(estimadoAjustado),
			rango_minimo: asegurarEnteroNoNegativo(minimo),
			rango_maximo: asegurarEnteroNoNegativo(maximo),
			racimos_rango_ideal: asegurarEnteroNoNegativo(racimosIdeal),
			racimos_en_riesgo: asegurarEnteroNoNegativo(racimosRiesgo),
			rechazo_estimado_pct: round(rechazoEsperado, 2),
			edad_promedio_corte: round(edadEsperada, 2),
			tendencia,
			confianza,
			sigma: round(sigma, 2),
			factor_estacional: round(estacional, 3),
			metodo: 'media_ponderada + tendencia + estacionalidad + ajuste_rechazo_edad',
		},
		modelo: {
			version: 'agri-ts-v1',
			semanas_analizadas: recientes.length,
			baseline_ponderado: round(mediaPonderada, 2),
			tendencia_slope: round(slope, 2),
			proyeccion_lineal: round(next, 2),
			coef_variacion: round(coefVariacion, 3),
			considera_estacionalidad: true,
			considera_rechazo: true,
			considera_edad_corte: true,
		},
	};

	return {
		resultado: respuesta,
		sourceHash: hashSimpleString(
			JSON.stringify({
				recientes,
				inventarioTotal: proyecciones.reduce((acc, p) => acc + p.saldo_en_campo, 0),
				target,
				configSafe,
			}),
		),
	};
}
