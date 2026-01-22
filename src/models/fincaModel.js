import { query } from '../db/db.js';

export const FincaModel = {
	findAll: () =>
		query(
			`SELECT f.*, e.nombre AS empresa_nombre
       FROM fincas f
       LEFT JOIN empresas e ON e.id = f.empresa_id
       ORDER BY f.id`,
		),

	findById: (id) =>
		query(
			`SELECT f.*, e.nombre AS empresa_nombre
       FROM fincas f
       LEFT JOIN empresas e ON e.id = f.empresa_id
       WHERE f.id=$1`,
			[id],
		),

	create: ({ nombre, ubicacion, empresa_id, latitud, longitud }) =>
		query(
			`INSERT INTO fincas (nombre, ubicacion, empresa_id, latitud, longitud) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
			[
				nombre,
				ubicacion ?? null,
				empresa_id ?? null,
				latitud ?? null,
				longitud ?? null,
			],
		),

	update: (id, { nombre, ubicacion, empresa_id, latitud, longitud }) =>
		query(
			`UPDATE fincas SET
         nombre = COALESCE($1, nombre),
         ubicacion = COALESCE($2, ubicacion),
         empresa_id = COALESCE($3, empresa_id),
         latitud = COALESCE($4, latitud),
         longitud = COALESCE($5, longitud)
       WHERE id = $6 
       RETURNING *`,
			[
				nombre ?? null,
				ubicacion ?? null,
				empresa_id ?? null,
				latitud ?? null,
				longitud ?? null,
				id,
			],
		),

	remove: (id) => query('DELETE FROM fincas WHERE id=$1', [id]),
};
