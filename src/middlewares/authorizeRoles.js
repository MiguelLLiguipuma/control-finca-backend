import { logger } from '../utils/logger.js';

function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (!raw) return '';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	if (raw === 'SUPERVISOR') return 'SUPERVISOR';
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	return raw;
}

export function autorizarRoles(...allowedRoles) {
	const normalizedAllowed = new Set(allowedRoles.map(normalizeRole));

	return (req, res, next) => {
		const role = normalizeRole(req.user?.rol);
		if (!role || !normalizedAllowed.has(role)) {
			logger.warn('authorization_denied', {
				request_id: req.requestId || null,
				path: req.originalUrl,
				method: req.method,
				user_id: Number(req.user?.id || 0) || null,
				user_role: role || null,
				required_roles: Array.from(normalizedAllowed),
			});
			return res.status(403).json({ message: 'No tiene permisos para esta operación' });
		}
		return next();
	};
}
