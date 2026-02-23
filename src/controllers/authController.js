import { query } from '../db/db.js';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../utils/password.js';

function normalizarEmail(email) {
	return String(email || '').trim().toLowerCase();
}

async function resolverRolRegistro() {
	const rolRes = await query(
		`SELECT id, nombre
     FROM roles
     WHERE UPPER(nombre) IN ('OPERADOR', 'TRABAJADOR', 'OPERARIO')
     ORDER BY CASE
       WHEN UPPER(nombre) = 'OPERADOR' THEN 1
       WHEN UPPER(nombre) = 'TRABAJADOR' THEN 2
       ELSE 3
     END
     LIMIT 1`,
	);
	if (!rolRes.rows.length) {
		throw new Error('No existe rol base para registro');
	}
	return rolRes.rows[0];
}

export const login = async (req, res) => {
	const email = normalizarEmail(req.body?.email);
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

export const register = async (req, res) => {
	const nombre = String(req.body?.nombre || '').trim();
	const email = normalizarEmail(req.body?.email);
	const password = String(req.body?.password || '');

	if (!nombre || !email || !password) {
		return res.status(400).json({
			message: 'nombre, email y contraseña son requeridos',
		});
	}
	if (password.length < 8) {
		return res.status(400).json({
			message: 'La contraseña debe tener al menos 8 caracteres',
		});
	}

	try {
		const dup = await query('SELECT id FROM usuarios WHERE email = $1 LIMIT 1', [
			email,
		]);
		if (dup.rows.length) {
			return res.status(409).json({ message: 'El email ya está registrado' });
		}

		const nuevo = await query(
			`INSERT INTO usuarios (nombre, email, password, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, nombre, email, activo`,
			[nombre, email, hashPassword(password)],
		);

		const rol = await resolverRolRegistro();
		await query(
			'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)',
			[nuevo.rows[0].id, rol.id],
		);

		return res.status(201).json({
			message: 'Cuenta creada correctamente. Inicie sesión para continuar.',
			user: {
				...nuevo.rows[0],
				rol: rol.nombre,
			},
		});
	} catch (error) {
		console.error('Error en registro:', error);
		return res.status(500).json({ message: 'Error en el servidor' });
	}
};
