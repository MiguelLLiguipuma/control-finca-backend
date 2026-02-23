import { query } from '../db/db.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { hashPassword, verifyPassword } from '../utils/password.js';

function normalizarEmail(email) {
	return String(email || '').trim().toLowerCase();
}

let googleClient = null;

function getGoogleClient() {
	if (!googleClient) {
		googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
	}
	return googleClient;
}

function buildTokenAndUser(user) {
	if (!process.env.JWT_SECRET) {
		throw new Error('JWT_SECRET no definido en entorno');
	}
	const tokenVersion = Number(user.token_version || 1);
	const token = jwt.sign(
		{ id: user.id, rol: user.rol, tv: tokenVersion },
		process.env.JWT_SECRET,
		{ expiresIn: '12h' },
	);

	return {
		token,
		user: {
			id: user.id,
			nombre: user.nombre,
			rol: user.rol,
		},
	};
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

		return res.json(buildTokenAndUser(user));
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

export const googleLogin = async (req, res) => {
	const idToken = String(req.body?.id_token || '').trim();
	if (!idToken) {
		return res.status(400).json({ message: 'id_token es requerido' });
	}

	if (!process.env.GOOGLE_CLIENT_ID) {
		return res.status(500).json({
			message: 'GOOGLE_CLIENT_ID no configurado en el servidor',
		});
	}

	try {
		const ticket = await getGoogleClient().verifyIdToken({
			idToken,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		const payload = ticket.getPayload();

		const email = normalizarEmail(payload?.email);
		const sub = String(payload?.sub || '').trim();
		const nombre = String(payload?.name || '').trim();
		const emailVerified = Boolean(payload?.email_verified);
		const avatarUrl = String(payload?.picture || '').trim() || null;
		const hostedDomain = String(payload?.hd || '').trim().toLowerCase();
		const allowedDomain = String(process.env.GOOGLE_ALLOWED_DOMAIN || '')
			.trim()
			.toLowerCase();

		if (!email || !sub || !nombre || !emailVerified) {
			return res.status(401).json({
				message: 'Cuenta de Google no valida o email no verificado',
			});
		}
		if (allowedDomain && hostedDomain !== allowedDomain) {
			return res.status(403).json({
				message: `Solo se permite acceso con dominio ${allowedDomain}`,
			});
		}

		let userRes = await query(
			`SELECT u.id, u.nombre, u.email, COALESCE(u.token_version, 1) AS token_version, r.nombre AS rol,
              u.provider_sub, u.auth_provider, u.activo
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE u.email = $1
       LIMIT 1`,
			[email],
		);

		if (userRes.rows.length) {
			const current = userRes.rows[0];
			if (current.activo !== true) {
				return res.status(403).json({ message: 'Usuario inactivo' });
			}
			if (current.provider_sub && String(current.provider_sub) !== sub) {
				return res.status(409).json({
					message:
						'El correo ya existe con otra cuenta de Google. Contacte al administrador.',
				});
			}

			await query(
				`UPDATE usuarios
         SET provider_sub = COALESCE(provider_sub, $1),
             auth_provider = 'google',
             avatar_url = $2,
             ultimo_login = NOW()
         WHERE id = $3`,
				[sub, avatarUrl, current.id],
			);
		} else {
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
				return res.status(500).json({
					message: 'No existe rol base para registro con Google',
				});
			}

			const created = await query(
				`INSERT INTO usuarios (nombre, email, password, activo, auth_provider, provider_sub, avatar_url, ultimo_login)
         VALUES ($1, $2, $3, true, 'google', $4, $5, NOW())
         RETURNING id`,
				[nombre, email, hashPassword(randomUUID()), sub, avatarUrl],
			);
			await query(
				'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)',
				[created.rows[0].id, rolRes.rows[0].id],
			);
		}

		userRes = await query(
			`SELECT u.id, u.nombre, u.email, COALESCE(u.token_version, 1) AS token_version, r.nombre AS rol
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE u.email = $1 AND u.activo = true
       LIMIT 1`,
			[email],
		);

		if (!userRes.rows.length) {
			return res.status(401).json({ message: 'No se pudo iniciar sesion' });
		}

		return res.json(buildTokenAndUser(userRes.rows[0]));
	} catch (error) {
		console.error('Error en login Google:', error);
		return res.status(401).json({ message: 'No se pudo autenticar con Google' });
	}
};
