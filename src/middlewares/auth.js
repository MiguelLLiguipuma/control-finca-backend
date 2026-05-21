import jwt from 'jsonwebtoken';
import { query } from '../db/db.js';
import { setRequestAuthScope } from '../utils/requestScope.js';

function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	return raw;
}

const SESSION_CACHE_TTL_MS = Number(process.env.AUTH_SESSION_CACHE_TTL_MS || 30000);
const sessionCache = new Map();

function buildSessionCacheKey(userId, tokenVersion, role, empresaId) {
	return [userId, tokenVersion, normalizeRole(role), Number(empresaId || 0) || 0].join(':');
}

function getCachedSession(key) {
	const cached = sessionCache.get(key);
	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		sessionCache.delete(key);
		return null;
	}
	return cached.value;
}

function setCachedSession(key, value) {
	sessionCache.set(key, {
		expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
		value,
	});
}

function respondDbSaturated(res, error) {
	return res.status(503).json({
		message:
			error?.message || 'Base de datos saturada temporalmente. Intente nuevamente en unos segundos.',
	});
}

export const verificarSesion = async (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({
			message: 'Acceso denegado: formato de autenticación inválido',
		});
	}

	const token = authHeader.split(' ')[1];

	try {
		if (!process.env.JWT_SECRET) {
			console.error('JWT_SECRET no definido en variables de entorno');
			return res.status(500).json({ message: 'Error interno de configuración' });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const userId = Number(decoded?.id);
		const tokenVersion = Number(decoded?.tv || 1);
		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(403).json({ message: 'Token de seguridad no válido' });
		}

		const normalizedRole = normalizeRole(decoded?.rol);
		const cacheKey = buildSessionCacheKey(
			userId,
			tokenVersion,
			decoded?.rol,
			decoded?.eid,
		);
		const cached = getCachedSession(cacheKey);
		if (cached) {
			req.user = cached.user;
			setRequestAuthScope({
				userId,
				empresaId: cached.user.empresa_id,
				role: decoded?.rol,
				allowedFincaIds: cached.allowedFincaIds,
			});
			return next();
		}

		const userRes = await query(
			`SELECT id, activo, empresa_id, COALESCE(token_version, 1) AS token_version
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
			[userId],
		);

		if (!userRes.rows.length || userRes.rows[0].activo !== true) {
			return res.status(401).json({ message: 'Sesión inválida o usuario inactivo' });
		}

		const dbTokenVersion = Number(userRes.rows[0].token_version || 1);
		if (dbTokenVersion !== tokenVersion) {
			return res.status(403).json({ message: 'Sesión expirada, ingrese nuevamente' });
		}

		const empresaId = Number(decoded?.eid || userRes.rows[0].empresa_id || 0) || null;
		req.user = {
			id: userId,
			rol: decoded?.rol,
			empresa_id: empresaId,
			tv: tokenVersion,
		};
		let allowedFincaIds = [];
		if (normalizedRole === 'OPERADOR' || normalizedRole === 'SUPERVISOR') {
			const fincasRes = await query(
				`SELECT finca_id
       FROM usuarios_fincas
       WHERE usuario_id = $1`,
				[userId],
			);
			allowedFincaIds = fincasRes.rows
				.map((r) => Number(r.finca_id))
				.filter((n) => Number.isInteger(n) && n > 0);
		}

		setCachedSession(cacheKey, {
			user: req.user,
			allowedFincaIds,
		});

		setRequestAuthScope({
			userId,
			empresaId: req.user.empresa_id,
			role: decoded?.rol,
			allowedFincaIds,
		});

		return next();
	} catch (error) {
		if (error?.status === 503 || error?.code === '53300') {
			console.error(`🔐 Error Auth: ${error.message}`);
			return respondDbSaturated(res, error);
		}

		const mensaje =
			error?.name === 'TokenExpiredError'
				? 'Sesión expirada, ingrese nuevamente'
				: 'Token de seguridad no válido';

		console.error(`🔐 Error Auth: ${error.message}`);
		return res.status(403).json({ message: mensaje });
	}
};
