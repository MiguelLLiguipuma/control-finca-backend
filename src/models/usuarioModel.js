import { query } from '../db/db.js';

export const UsuarioModel = {
	findAll: () =>
		query(
			`SELECT u.id,
              u.nombre,
              u.email,
              u.activo,
              u.creado_en,
              r.id AS rol_id,
              r.nombre AS rol
       FROM usuarios u
       LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       ORDER BY u.id`,
		),
	findById: (id) =>
		query(
			`SELECT u.id,
              u.nombre,
              u.email,
              u.activo,
              u.creado_en,
              r.id AS rol_id,
              r.nombre AS rol
       FROM usuarios u
       LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       WHERE u.id=$1`,
			[id],
		),
	findByEmail: (email) =>
		query('SELECT * FROM usuarios WHERE email=$1', [email]),
	findRolByNombre: (nombre) =>
		query('SELECT id, nombre FROM roles WHERE UPPER(nombre) = UPPER($1) LIMIT 1', [
			nombre,
		]),
	findRolDefault: () =>
		query(
			`SELECT id, nombre
       FROM roles
       WHERE UPPER(nombre) IN ('OPERADOR', 'TRABAJADOR', 'OPERARIO')
       ORDER BY id
       LIMIT 1`,
		),
	create: ({ nombre, email, password, activo = true }) =>
		query(
			'INSERT INTO usuarios (nombre, email, password, activo) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, activo, creado_en',
			[nombre, email, password, activo],
		),
	update: (id, { nombre, email, password, activo }) =>
		query(
			`UPDATE usuarios SET 
         nombre=COALESCE($1,nombre),
         email=COALESCE($2,email),
         password=COALESCE($3,password),
         activo=COALESCE($4,activo)
       WHERE id=$5
       RETURNING id, nombre, email, activo, creado_en`,
			[nombre ?? null, email ?? null, password ?? null, activo ?? null, id],
		),
	replaceUsuarioRol: async (usuarioId, rolId) => {
		await query('DELETE FROM usuarios_roles WHERE usuario_id = $1', [usuarioId]);
		await query(
			'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)',
			[usuarioId, rolId],
		);
	},
	remove: (id) => query('DELETE FROM usuarios WHERE id=$1', [id]),
};
