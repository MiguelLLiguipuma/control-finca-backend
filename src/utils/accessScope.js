import { query } from '../db/db.js';

function crearError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

export function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	return raw;
}

export async function getFincasPermitidasByUser(usuarioId) {
	const userId = Number(usuarioId || 0);
	if (!Number.isInteger(userId) || userId <= 0) return [];

	const { rows } = await query(
		`SELECT finca_id
     FROM usuarios_fincas
     WHERE usuario_id = $1`,
		[userId],
	);
	return rows.map((r) => Number(r.finca_id)).filter((n) => Number.isInteger(n) && n > 0);
}

export async function getEmpresasPermitidasByUser(usuarioId) {
	const userId = Number(usuarioId || 0);
	if (!Number.isInteger(userId) || userId <= 0) return [];

	const { rows } = await query(
		`SELECT DISTINCT f.empresa_id
     FROM usuarios_fincas uf
     JOIN fincas f ON f.id = uf.finca_id
     WHERE uf.usuario_id = $1
       AND f.empresa_id IS NOT NULL`,
		[userId],
	);

	return rows
		.map((r) => Number(r.empresa_id))
		.filter((n) => Number.isInteger(n) && n > 0);
}

export async function resolveFincaScope({ rol, userId }) {
	const role = normalizeRole(rol);
	const requiereScope = role === 'OPERADOR' || role === 'SUPERVISOR';
	if (!requiereScope) {
		return { enforce: false, role, allowedFincaIds: [] };
	}
	const allowedFincaIds = await getFincasPermitidasByUser(userId);
	return { enforce: true, role, allowedFincaIds };
}

export async function resolveEmpresaScope({ rol, userId }) {
	const role = normalizeRole(rol);
	const requiereScope = role === 'OPERADOR' || role === 'SUPERVISOR';
	if (!requiereScope) {
		return { enforce: false, role, allowedEmpresaIds: [] };
	}
	const allowedEmpresaIds = await getEmpresasPermitidasByUser(userId);
	return { enforce: true, role, allowedEmpresaIds };
}

export function assertFincaInScope(fincaId, scope) {
	if (!scope?.enforce) return;
	if (!scope.allowedFincaIds.includes(Number(fincaId))) {
		throw crearError('No tiene permisos para consultar datos de esta finca', 403);
	}
}

export function assertEmpresaInScope(empresaId, scope) {
	if (!scope?.enforce) return;
	if (!scope.allowedEmpresaIds.includes(Number(empresaId))) {
		throw crearError('No tiene permisos para consultar datos de esta empresa', 403);
	}
}

export function applyFincaScopeToRequestedIds(requestedIds, scope) {
	const requested = Array.from(
		new Set(
			(Array.isArray(requestedIds) ? requestedIds : [])
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0),
		),
	);

	if (!scope?.enforce) return requested;

	const allowed = Array.from(
		new Set(
			(scope.allowedFincaIds || [])
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0),
		),
	);

	if (!allowed.length) return [];

	if (!requested.length) return allowed;

	const allRequestedAllowed = requested.every((id) => allowed.includes(id));
	if (!allRequestedAllowed) {
		throw crearError('No tiene permisos para consultar datos de esta finca', 403);
	}

	return requested;
}

export function applyEmpresaScopeToRequestedIds(requestedIds, scope) {
	const requested = Array.from(
		new Set(
			(Array.isArray(requestedIds) ? requestedIds : [])
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0),
		),
	);

	if (!scope?.enforce) return requested;

	const allowed = Array.from(
		new Set(
			(scope.allowedEmpresaIds || [])
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0),
		),
	);

	if (!allowed.length) return [];

	if (!requested.length) return allowed;

	const allRequestedAllowed = requested.every((id) => allowed.includes(id));
	if (!allRequestedAllowed) {
		throw crearError('No tiene permisos para consultar datos de esta empresa', 403);
	}

	return requested;
}
