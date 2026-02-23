import { query } from '../db/db.js';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../utils/password.js';

export const login = async (req, res) => {
	const email = String(req.body?.email || '').trim().toLowerCase();
	const password = String(req.body?.password || '');

	if (!email || !password) {
		return res.status(400).json({ message: 'Email y contraseña son requeridos' });
	}

	try {
		const sql = `
      SELECT u.id, u.nombre, u.email, u.password, COALESCE(u.token_version, 1) AS token_version, r.nombre as rol
      FROM usuarios u
      JOIN usuarios_roles ur ON u.id = ur.usuario_id
      JOIN roles r ON ur.rol_id = r.id
      WHERE u.email = $1 AND u.activo = true
    `;

		const result = await query(sql, [email]);

		if (result.rows.length === 0) {
			return res
				.status(401)
				.json({ message: 'Usuario no encontrado o inactivo' });
		}

		const user = result.rows[0];
		const check = verifyPassword(password, user.password);

		if (!check.matches) {
			return res.status(401).json({ message: 'Contraseña incorrecta' });
		}

		if (check.legacy) {
			const newHash = hashPassword(password);
			await query('UPDATE usuarios SET password = $1 WHERE id = $2', [
				newHash,
				user.id,
			]);
		}

		if (!process.env.JWT_SECRET) {
			console.error('JWT_SECRET no definido en entorno');
			return res.status(500).json({ message: 'Error interno de configuración' });
		}

		const tokenVersion = Number(user.token_version || 1);
		const token = jwt.sign(
			{ id: user.id, rol: user.rol, tv: tokenVersion },
			process.env.JWT_SECRET,
			{ expiresIn: '12h' },
		);

		return res.json({
			token,
			user: {
				id: user.id,
				nombre: user.nombre,
				rol: user.rol,
			},
		});
	} catch (error) {
		console.error('Error en login:', error);
		return res.status(500).json({ message: 'Error en el servidor' });
	}
};
