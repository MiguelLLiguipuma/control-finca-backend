import jwt from 'jsonwebtoken';
import { query } from '../db/db.js';

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

		const userRes = await query(
			`SELECT id, activo, COALESCE(token_version, 1) AS token_version
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

		req.user = {
			id: userId,
			rol: decoded?.rol,
			tv: tokenVersion,
		};

		return next();
	} catch (error) {
		const mensaje =
			error?.name === 'TokenExpiredError'
				? 'Sesión expirada, ingrese nuevamente'
				: 'Token de seguridad no válido';

		console.error(`🔐 Error Auth: ${error.message}`);
		return res.status(403).json({ message: mensaje });
	}
};
