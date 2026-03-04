import { PrediccionAvanzadaModel } from '../../models/cosecha/prediccionAvanzadaModel.js';
import { construirPrediccionAvanzada } from '../../domain/cosecha/prediccionAvanzadaDomain.js';
import { resolveFincaScope, assertFincaInScope } from '../../utils/accessScope.js';

const ALGORITMO_VERSION = 'agri-ts-v3';

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
		};
	},
};
