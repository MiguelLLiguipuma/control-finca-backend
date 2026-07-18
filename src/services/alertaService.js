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
const DEFAULT_EDAD_HISTORICA_CINTA = Number(
	process.env.ALERTA_CINTA_EDAD_HISTORICA || 17,
);
const DEFAULT_DIAS_FUMIGACION = Number(process.env.ALERTA_FUMIGACION_DIAS_MAX || 14);
const DEFAULT_DIAS_CLIMA = Number(process.env.ALERTA_CLIMA_DIAS_MAX || 1);
const TIPOS_ALERTA = [
	'enfunde_faltante',
	'cinta_critica',
	'inventario_historico_cintas',
	'fumigacion_vencida',
	'clima_desactualizado',
];
const SEVERIDADES = ['baja', 'media', 'alta', 'critica'];

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

function ensureCanManageConfig(user) {
	const role = normalizeRole(user?.rol);
	if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
		throw crearError('No tiene permisos para configurar alertas', 403);
	}
}

function normalizePhone(value) {
	const raw = String(value || '').replace(/[^\d+]/g, '').trim();
	if (!raw) return null;
	if (raw.startsWith('+')) return raw.slice(0, 20);

	const digits = raw.replace(/\D/g, '');
	if (digits.startsWith('593')) return `+${digits}`.slice(0, 20);
	if (digits.startsWith('09') && digits.length === 10) {
		return `+593${digits.slice(1)}`;
	}
	return digits.slice(0, 18);
}

function normalizeTipos(input) {
	const values = Array.isArray(input) ? input : TIPOS_ALERTA;
	const normalized = Array.from(
		new Set(values.map((x) => String(x || '').trim()).filter((x) => TIPOS_ALERTA.includes(x))),
	);
	return normalized.length ? normalized : TIPOS_ALERTA;
}

function normalizeSeveridad(value) {
	const normalized = String(value || 'baja').trim().toLowerCase();
	return SEVERIDADES.includes(normalized) ? normalized : 'baja';
}

function cleanWhatsappDigits(value) {
	return String(value || '').replace(/\D/g, '');
}

function formatAlertDate(value) {
	const date = dayjs(value).tz(DEFAULT_TZ);
	return date.isValid() ? date.format('DD/MM/YYYY HH:mm') : '';
}

function buildWhatsappMessage(row) {
	const finca = row.finca_nombre ? `\nFinca: ${row.finca_nombre}` : '';
	const fecha = formatAlertDate(row.detectada_en);
	const detectada = fecha ? `\nDetectada: ${fecha}` : '';
	return [
		'Control Finca - Alerta operativa',
		`Severidad: ${String(row.severidad || '').toUpperCase()}`,
		`Tipo: ${row.tipo}`,
		`Titulo: ${row.titulo}`,
		`${row.mensaje}${finca}${detectada}`,
	].join('\n');
}

function mapWhatsappItem(row) {
	const mensajeWhatsapp = buildWhatsappMessage(row);
	const phone = cleanWhatsappDigits(row.telefono_whatsapp);
	return {
		destinatario_id: Number(row.destinatario_id),
		alerta_id: Number(row.alerta_id),
		usuario_id: Number(row.usuario_id),
		usuario_nombre: row.usuario_nombre || null,
		telefono_whatsapp: row.telefono_whatsapp,
		estado: row.estado,
		finca_id: row.finca_id ? Number(row.finca_id) : null,
		finca_nombre: row.finca_nombre || null,
		tipo: row.tipo,
		severidad: row.severidad,
		titulo: row.titulo,
		mensaje: row.mensaje,
		detectada_en: row.detectada_en,
		creado_en: row.creado_en,
		enviado_en: row.enviado_en,
		error_envio: row.error_envio,
		mensaje_whatsapp: mensajeWhatsapp,
		whatsapp_url: phone
			? `https://wa.me/${phone}?text=${encodeURIComponent(mensajeWhatsapp)}`
			: null,
	};
}

async function resolveScopedFincaIds(user, requested) {
	const scope = await resolveFincaScope({
		rol: user?.rol,
		userId: Number(user?.id || 0),
	});
	return applyFincaScopeToRequestedIds(requested, scope);
}

async function destinatarios(row, alerta) {
	return AlertaModel.destinatariosParaFinca({
		fincaId: Number(row.finca_id),
		empresaId: Number(row.empresa_id || 0) || null,
		tipo: alerta?.tipo,
		severidad: alerta?.severidad,
	});
}

async function registrar(alerta, row) {
	const destinos = await destinatarios(row, alerta);
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

async function generarCintasCriticas({ fincaIds, edadCritica, edadHistorica }) {
	const rows = await AlertaModel.detectarCintasCriticas({
		fincaIds,
		edadCritica,
		edadHistorica,
	});
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
						edad_historica: edadHistorica,
					},
					dedupe_key: `cinta_critica:${row.finca_id}:${row.calendario_id}:${edadCritica}:${edadHistorica}`,
				},
				row,
			),
		);
	}
	return resultados;
}

async function generarInventarioHistorico({ fincaIds, edadHistorica }) {
	const rows = await AlertaModel.detectarInventarioHistorico({
		fincaIds,
		edadHistorica,
	});
	const resultados = [];
	for (const row of rows) {
		const totalCintas = Number(row.total_cintas || 0);
		const totalSaldo = Number(row.total_saldo || 0);
		resultados.push(
			await registrar(
				{
					empresa_id: row.empresa_id,
					finca_id: row.finca_id,
					tipo: 'inventario_historico_cintas',
					severidad: totalCintas >= 10 || totalSaldo >= 1000 ? 'critica' : 'alta',
					titulo: 'Inventario histórico por depurar',
					mensaje: `${row.finca_nombre} tiene ${totalCintas} cinta(s) de ${edadHistorica}+ semanas con ${totalSaldo} racimos en campo. Revise cierre o ajuste de saldo.`,
					entidad_tipo: 'inventario_campo',
					entidad_id: `finca-${row.finca_id}`,
					metadata: {
						total_cintas: totalCintas,
						total_saldo: totalSaldo,
						edad_minima: Number(row.edad_minima || 0),
						edad_maxima: Number(row.edad_maxima || 0),
						edad_historica: edadHistorica,
						muestras: Array.isArray(row.muestras) ? row.muestras.slice(0, 12) : [],
					},
					dedupe_key: `inventario_historico_cintas:${row.finca_id}:${edadHistorica}`,
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

	async listarContactos({ user }) {
		ensureCanManageConfig(user);
		const role = normalizeRole(user?.rol);
		const empresaId = role === 'ADMIN' ? Number(user?.empresa_id || 0) || null : null;
		return AlertaModel.listarContactos({ empresaId });
	},

	async guardarContacto({ user, usuarioId, body = {} }) {
		ensureCanManageConfig(user);
		const id = Number(usuarioId);
		if (!Number.isInteger(id) || id <= 0) throw crearError('usuario_id invalido', 400);

		const usuario = await AlertaModel.usuarioEmpresa(id);
		if (!usuario) throw crearError('Usuario no encontrado', 404);

		const role = normalizeRole(user?.rol);
		const empresaUsuario = Number(usuario.empresa_id || 0) || null;
		const empresaSesion = Number(user?.empresa_id || 0) || null;
		if (role === 'ADMIN' && empresaSesion && empresaUsuario && empresaSesion !== empresaUsuario) {
			throw crearError('No puede configurar usuarios de otra empresa', 403);
		}

		const telefonoWhatsapp = normalizePhone(body.telefono_whatsapp);
		const whatsappActivo = Boolean(body.whatsapp_activo) && Boolean(telefonoWhatsapp);
		const contacto = await AlertaModel.upsertContacto({
			usuarioId: id,
			empresaId: empresaUsuario,
			telefonoWhatsapp,
			whatsappActivo,
			inAppActivo: body.in_app_activo !== false,
			tipos: normalizeTipos(body.tipos),
			severidadMinima: normalizeSeveridad(body.severidad_minima),
		});
		return contacto;
	},

	async listarWhatsappPendientes({ user, query = {} }) {
		ensureCanManageConfig(user);
		const requested = parseFincaIds(query?.finca_ids || query?.finca_id);
		const fincaIds = await resolveScopedFincaIds(user, requested);
		const estado = query?.estado || 'pendiente,fallido';
		const rows = await AlertaModel.listarWhatsappPendientes({
			fincaIds,
			estado,
			limit: query?.limit,
		});
		return rows.map(mapWhatsappItem);
	},

	async marcarWhatsappEnviado({ user, destinatarioId }) {
		ensureCanManageConfig(user);
		const id = Number(destinatarioId);
		if (!Number.isInteger(id) || id <= 0) {
			throw crearError('destinatario_id invalido', 400);
		}
		const fincaIds = await resolveScopedFincaIds(user, []);
		const updated = await AlertaModel.marcarWhatsappEnviado({
			destinatarioId: id,
			fincaIds,
		});
		if (!updated) return null;
		return updated;
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
		const edadHistorica = Math.max(
			edadCritica + 1,
			parsePositiveInt(
				body.edad_historica_cinta || query.edad_historica_cinta,
				DEFAULT_EDAD_HISTORICA_CINTA,
			),
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
			cinta_critica: await generarCintasCriticas({
				fincaIds,
				edadCritica,
				edadHistorica,
			}),
			inventario_historico_cintas: await generarInventarioHistorico({
				fincaIds,
				edadHistorica,
			}),
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
				edad_historica_cinta: edadHistorica,
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
