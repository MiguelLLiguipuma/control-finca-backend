import { query } from '../db/db.js';

export const RolModel = {
	findAll: () => query('SELECT * FROM roles ORDER BY id'),
	findById: (id) => query('SELECT * FROM roles WHERE id = $1', [id]),
	findByName: (nombre) =>
		query('SELECT * FROM roles WHERE nombre = $1', [nombre]),
	create: (nombre) =>
		query('INSERT INTO roles (nombre) VALUES ($1) RETURNING *', [nombre]),
	update: (id, nombre) =>
		query('UPDATE roles SET nombre=$1 WHERE id=$2 RETURNING *', [nombre, id]),
	remove: (id) => query('DELETE FROM roles WHERE id=$1', [id]),
};
