import { query } from '../db/db.js';

export const UsuarioModel = {
	findAll: () =>
		query(
			'SELECT id, nombre, email, activo, creado_en FROM usuarios ORDER BY id',
		),
	findById: (id) =>
		query(
			'SELECT id, nombre, email, activo, creado_en FROM usuarios WHERE id=$1',
			[id],
		),
	findByEmail: (email) =>
		query('SELECT * FROM usuarios WHERE email=$1', [email]),
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
	remove: (id) => query('DELETE FROM usuarios WHERE id=$1', [id]),
};
