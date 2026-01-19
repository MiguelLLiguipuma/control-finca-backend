import { query } from '../db/db.js';

export const CintaModel = {
	findAll: () => query('SELECT * FROM cintas ORDER BY id'),
	findById: (id) => query('SELECT * FROM cintas WHERE id=$1', [id]),
	findByColor: (color) => query('SELECT * FROM cintas WHERE color=$1', [color]),
	create: ({ color, descripcion }) =>
		query(
			'INSERT INTO cintas (color, descripcion) VALUES ($1,$2) RETURNING *',
			[color, descripcion ?? null],
		),
	update: (id, { color, descripcion }) =>
		query(
			`UPDATE cintas SET
         color=COALESCE($1,color),
         descripcion=COALESCE($2,descripcion)
       WHERE id=$3 RETURNING *`,
			[color ?? null, descripcion ?? null, id],
		),
	remove: (id) => query('DELETE FROM cintas WHERE id=$1', [id]),
};
