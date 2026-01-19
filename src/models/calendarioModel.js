import { query } from '../db/db.js';

export const CalendarioModel = {
	// 1. Obtener todos
	findAll: () =>
		query(
			`SELECT c.id, c.semana, c.anio, ci.color, e.nombre AS empresa, c.estado
       FROM calendarios_enfunde c
       LEFT JOIN cintas ci ON ci.id = c.color_id
       LEFT JOIN empresas e ON e.id = c.empresa_id
       ORDER BY c.anio DESC, c.semana`,
		),

	// 2. Buscar por ID
	findById: (id) =>
		query(`SELECT * FROM calendarios_enfunde WHERE id=$1`, [id]),

	// 3. Validar duplicados específicos
	findBySemanaAnioEmpresa: (semana, anio, empresa_id) =>
		query(
			`SELECT * FROM calendarios_enfunde 
       WHERE semana=$1 AND anio=$2 AND empresa_id=$3`,
			[semana, anio, empresa_id],
		),

	// 4. Crear UNO solo
	create: ({ semana, anio, color_id, empresa_id, estado }) =>
		query(
			`INSERT INTO calendarios_enfunde (semana, anio, color_id, empresa_id, estado)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
			[semana, anio, color_id, empresa_id, estado],
		),

	// 5. [NUEVO] Limpiar año completo para una empresa (Para re-generar sin error)
	deleteByAnioEmpresa: (anio, empresa_id) =>
		query(`DELETE FROM calendarios_enfunde WHERE anio=$1 AND empresa_id=$2`, [
			anio,
			empresa_id,
		]),

	// 6. Actualizar
	update: (id, { semana, anio, color_id, empresa_id, estado }) =>
		query(
			`UPDATE calendarios_enfunde SET
         semana = COALESCE($1, semana),
         anio  = COALESCE($2, anio),
         color_id = COALESCE($3, color_id),
         empresa_id = COALESCE($4, empresa_id),
         estado = COALESCE($5, estado)
       WHERE id=$6 RETURNING *`,
			[semana, anio, color_id, empresa_id, estado, id],
		),

	// 7. Eliminar
	remove: (id) => query('DELETE FROM calendarios_enfunde WHERE id=$1', [id]),

	// En src/models/calendarioModel.js
	obtenerResumenAnual: () => query(`SELECT * FROM vista_resumen_calendarios`),
};
