import { query } from '../db/db.js';

export const FincaModel = {
  findAll: () =>
    query(
      `SELECT f.*, e.nombre AS empresa
       FROM fincas f
       LEFT JOIN empresas e ON e.id = f.empresa_id
       ORDER BY f.id`
    ),
  findById: (id) =>
    query(
      `SELECT f.*, e.nombre AS empresa
       FROM fincas f
       LEFT JOIN empresas e ON e.id = f.empresa_id
       WHERE f.id=$1`,
      [id]
    ),
  create: ({ nombre, ubicacion, empresa_id }) =>
    query(
      'INSERT INTO fincas (nombre, ubicacion, empresa_id) VALUES ($1,$2,$3) RETURNING *',
      [nombre, ubicacion ?? null, empresa_id ?? null]
    ),
  update: (id, { nombre, ubicacion, empresa_id }) =>
    query(
      `UPDATE fincas SET
         nombre=COALESCE($1,nombre),
         ubicacion=COALESCE($2,ubicacion),
         empresa_id=COALESCE($3,empresa_id)
       WHERE id=$4 RETURNING *`,
      [nombre ?? null, ubicacion ?? null, empresa_id ?? null, id]
    ),
  remove: (id) => query('DELETE FROM fincas WHERE id=$1', [id]),
};
