import { query } from '../db/db.js';

export const EmpresaModel = {
	findAll: () => query('SELECT * FROM empresas ORDER BY id'),
	findById: (id) => query('SELECT * FROM empresas WHERE id=$1', [id]),
	findByNombre: (nombre) =>
		query('SELECT * FROM empresas WHERE nombre=$1', [nombre]),
	create: ({ nombre, ruc, direccion, telefono }) =>
		query(
			'INSERT INTO empresas (nombre, ruc, direccion, telefono) VALUES ($1,$2,$3,$4) RETURNING *',
			[nombre, ruc ?? null, direccion ?? null, telefono ?? null],
		),
	update: (id, { nombre, ruc, direccion, telefono }) =>
		query(
			`UPDATE empresas SET 
         nombre=COALESCE($1,nombre),
         ruc=COALESCE($2,ruc),
         direccion=COALESCE($3,direccion),
         telefono=COALESCE($4,telefono)
       WHERE id=$5 RETURNING *`,
			[nombre ?? null, ruc ?? null, direccion ?? null, telefono ?? null, id],
		),
	remove: (id) => query('DELETE FROM empresas WHERE id=$1', [id]),
};
