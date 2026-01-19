import { query } from '../db/db.js';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
	const { email, password } = req.body;

	try {
		const sql = `
      SELECT u.id, u.nombre, u.email, u.password, r.nombre as rol
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

		if (user.password !== password) {
			return res.status(401).json({ message: 'Contraseña incorrecta' });
		}

		const token = jwt.sign(
			{ id: user.id, rol: user.rol },
			process.env.JWT_SECRET,
			{ expiresIn: '12h' },
		);

		res.json({
			token,
			user: {
				nombre: user.nombre,
				rol: user.rol,
			},
		});
	} catch (error) {
		console.error('Error en login:', error);
		res.status(500).json({ message: 'Error en el servidor' });
	}
};
