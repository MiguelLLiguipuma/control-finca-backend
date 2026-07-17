import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { AlertaModel } from '../models/alertaModel.js';
import {
	applyFincaScopeToRequestedIds,
	resolveFincaScope,
} from '../utils/accessScope.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = 'America/Guayaquil';
const DEFAULT_EDAD_CRITICA_CINTA = Number(process.env.ALERTA_CINTA_EDAD_CRITICA || 15);
const DEFAULT_DIAS_FUMIGACION = Number(process.env.ALERTA_FUMIGACION_DIAS_MAX || 14);
const DEFAULT_DIAS_CLIMA = Number(process.env.ALERTA_CLIMA_DIAS_MAX || 1);

function crearError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function todayIso() {
	return dayjs().tz(DEFAULT_TZ).format('YYYY-MM-DD');
}

function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	return raw;
}

function parseFincaIds(input) {
	if (Array.isArray(input)) {
		return Array.from(
			new Set(input.map(Number).filter((id) => Number.isInteger(id) && id > 0)),
		);
	}
	if (typeof input === 'string') {
		return Array.from(
			new Set(
				input
					.split(',')
					.map((id) => Number(String(id).trim()))
					.filter((id) => Number.isInteger(id) && id > 0),
			),
		);
	}
	const single = Number(input || 0);
	return Number.isInteger(single) && single > 0 ? [single] : [];
}

function parsePositiveInt(value, fallback) {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) return fallback;
	return n;
}

async function resolveScopedFincaIds(user, requested) {
	const scope = await resolveFincaScope({
		rol: user?.rol,
		userId: Number(user?.id || 0),
	});
	return applyFincaScopeToRequestedIds(requested, scope);
}

async function destinatarios(row) {
	return AlertaModel.destinatariosParaFinca({
		fincaId: Number(row.finca_id),
		empresaId: Number(row.empresa_id || 0) || null,
	});
}

async function registrar(alerta, row) {
	const destinos = await destinatarios(row);
	if (!destinos.length) return { creada: false, alerta: null, omitida: 'sin_destinatarios' };
	return AlertaModel.insertarAlerta(alerta, destinos);
}

async function generarFaltaEnfunde({ fecha, fincaIds }) {
	const rows = await AlertaModel.detectarFaltaEnfunde({ fecha, fincaIds });
	const resultados = [];
	for (const row of rows) {
		resultados.push(
			await registrar(
				{
					empresa_id: row.empresa_id,
					finca_id: row.finca_id,
					tipo: 'enfunde_faltante',
					severidad: 'alta',
					titulo: 'Falta registro de enfunde',
					mensaje: `No hay registro de enfunde para ${row.finca_nombre} en la fecha ${fecha}.`,
					entidad_tipo: 'registro_enfunde',
					entidad_id: fecha,
					metadata: {
						fecha,
						finca_nombre: row.finca_nombre,
					},
					dedupe_key: `enfunde_faltante:${row.finca_id}:${fecha}`,
				},
				row,
			),
		);
	}
	return resultados;
}

async function generarCintasCriticas({ fincaIds, edadCritica }) {
	const rows = await AlertaModel.detectarCintasCriticas({ fincaIds, edadCritica });
	const resultados = [];
	for (const row of rows) {
		const edad = Number(row.edad_semanas || 0);
		const severidad = edad >= edadCritica + 2 ? 'critica' : 'alta';
		resultados.push(
			await registrar(
				{
					empresa_id: row.empresa_id,
					finca_id: row.finca_id,
					tipo: 'cinta_critica',
					severidad,
					titulo: 'Cinta en edad crítica',
					mensaje: `La cinta ${row.color_cinta || 'sin color'} de semana ${row.semana_enfunde}/${row.anio} tiene ${edad} semanas y ${row.saldo_en_campo} racimos en campo.`,
					entidad_tipo: 'calendario_enfunde',
					entidad_id: row.calendario_id,
					metadata: {
						color_cinta: row.color_cinta,
						semana_enfunde: row.semana_enfunde,
						anio: row.anio,
						saldo_en_campo: Number(row.saldo_en_campo || 0),
						edad_semanas: edad,
						edad_critica: edadCritica,
					},
					dedupe_key: `cinta_critica:${row.finca_id}:${row.calendario_id}:${edadCritica}`,
				},
				row,
			),
		);
	}
	return resultados;
}

async function generarFumigacionVencida({ fincaIds, diasMaximos }) {
	const rows = await AlertaModel.detectarFumigacionVencida({ fincaIds, diasMaximos });
	const resultados = [];
	for (const row of rows) {
		const dias = Number(row.dias_sin_fumigar || 0);
		resultados.push(
			await registrar(
				{
					empresa_id: row.empresa_id,
					finca_id: row.finca_id,
					tipo: 'fumigacion_vencida',
					severidad: dias >= diasMaximos + 7 ? 'critica' : 'alta',
					titulo: 'Fumigación pendiente o vencida',
					mensaje: row.ultima_fumigacion
						? `${row.finca_nombre} lleva ${dias} días sin registrar fumigación.`
						: `${row.finca_nombre} no tiene fumigaciones registradas.`,
					entidad_tipo: 'fumigacion',
					entidad_id: row.ultima_fumigacion || 'sin-registro',
					metadata: {
						ultima_fumigacion: row.ultima_fumigacion,
						dias_sin_fumigar: dias,
						dias_maximos: diasMaximos,
					},
					dedupe_key: `fumigacion_vencida:${row.finca_id}:${row.ultima_fumigacion || 'none'}:${diasMaximos}`,
				},
				row,
			),
		);
	}
	return resultados;
}

async function generarClimaDesactualizado({ fincaIds, diasMaximos }) {
	const rows = await AlertaModel.detectarClimaDesactualizado({ fincaIds, diasMaximos });
	const resultados = [];
	for (const row of rows) {
		const dias = Number(row.dias_sin_clima || 0);
		resultados.push(
			await registrar(
				{
					empresa_id: row.empresa_id,
					finca_id: row.finca_id,
					tipo: 'clima_desactualizado',
					severidad: dias >= diasMaximos + 3 ? 'critica' : 'alta',
					titulo: 'Clima sin actualizar',
					mensaje: row.ultima_fecha_clima
						? `${row.finca_nombre} no actualiza clima desde ${row.ultima_fecha_clima}.`
						: `${row.finca_nombre} no tiene historial de clima registrado.`,
					entidad_tipo: 'historial_clima',
					entidad_id: row.ultima_fecha_clima || 'sin-registro',
					metadata: {
						ultima_fecha_clima: row.ultima_fecha_clima,
						dias_sin_clima: dias,
						dias_maximos: diasMaximos,
					},
					dedupe_key: `clima_desactualizado:${row.finca_id}:${row.ultima_fecha_clima || 'none'}:${diasMaximos}`,
				},
				row,
			),
		);
	}
	return resultados;
}

function resumirGeneracion(resultadosPorTipo) {
	const detalle = {};
	let creadas = 0;
	let existentes = 0;
	let omitidas = 0;

	for (const [tipo, resultados] of Object.entries(resultadosPorTipo)) {
		const stats = {
			evaluadas: resultados.length,
			creadas: resultados.filter((r) => r.creada).length,
			existentes: resultados.filter((r) => !r.creada && !r.omitida).length,
			omitidas: resultados.filter((r) => r.omitida).length,
		};
		detalle[tipo] = stats;
		creadas += stats.creadas;
		existentes += stats.existentes;
		omitidas += stats.omitidas;
	}

	return { creadas, existentes, omitidas, detalle };
}

export const AlertaService = {
	async listar({ user, query }) {
		const requested = parseFincaIds(query?.finca_ids || query?.finca_id);
		const fincaIds = await resolveScopedFincaIds(user, requested);
		return AlertaModel.listar({
			usuarioId: Number(user?.id || 0),
			estado: query?.estado || 'pendiente,enviada,leida',
			fincaIds,
			limit: query?.limit,
		});
	},

	async resumen({ user, query }) {
		const requested = parseFincaIds(query?.finca_ids || query?.finca_id);
		const fincaIds = await resolveScopedFincaIds(user, requested);
		return AlertaModel.resumen({ fincaIds });
	},

	async generar({ user, body = {}, query = {} }) {
		const role = normalizeRole(user?.rol);
		if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
			throw crearError('No tiene permisos para generar alertas', 403);
		}

		const requested = parseFincaIds(body.finca_ids || body.finca_id || query.finca_ids || query.finca_id);
		const fincaIds = await resolveScopedFincaIds(user, requested);
		const fecha = String(body.fecha || query.fecha || todayIso()).slice(0, 10);
		const edadCritica = parsePositiveInt(
			body.edad_critica_cinta || query.edad_critica_cinta,
			DEFAULT_EDAD_CRITICA_CINTA,
		);
		const diasFumigacion = parsePositiveInt(
			body.dias_fumigacion || query.dias_fumigacion,
			DEFAULT_DIAS_FUMIGACION,
		);
		const diasClima = parsePositiveInt(
			body.dias_clima || query.dias_clima,
			DEFAULT_DIAS_CLIMA,
		);

		const resultadosPorTipo = {
			enfunde_faltante: await generarFaltaEnfunde({ fecha, fincaIds }),
			cinta_critica: await generarCintasCriticas({ fincaIds, edadCritica }),
			fumigacion_vencida: await generarFumigacionVencida({
				fincaIds,
				diasMaximos: diasFumigacion,
			}),
			clima_desactualizado: await generarClimaDesactualizado({
				fincaIds,
				diasMaximos: diasClima,
			}),
		};

		return {
			fecha,
			parametros: {
				edad_critica_cinta: edadCritica,
				dias_fumigacion: diasFumigacion,
				dias_clima: diasClima,
			},
			...resumirGeneracion(resultadosPorTipo),
		};
	},

	async marcarLeida({ user, alertaId }) {
		const id = Number(alertaId);
		if (!Number.isInteger(id) || id <= 0) throw crearError('alerta_id invalido', 400);
		return AlertaModel.marcarLeida({
			alertaId: id,
			usuarioId: Number(user?.id || 0),
		});
	},

	async resolver({ user, alertaId }) {
		const role = normalizeRole(user?.rol);
		if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
			throw crearError('No tiene permisos para resolver alertas', 403);
		}
		const id = Number(alertaId);
		if (!Number.isInteger(id) || id <= 0) throw crearError('alerta_id invalido', 400);
		return AlertaModel.resolver({ alertaId: id });
	},
};
