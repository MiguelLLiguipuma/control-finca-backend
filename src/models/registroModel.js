import { query } from '../db/db.js';

export const RegistroModel = {
	// 1. Obtener todos los registros con información de calendario
	findAll: () =>
		query(
			`SELECT r.id, r.fecha, r.cantidad_fundas, r.observaciones,
              f.nombre AS finca, u.nombre AS usuario,
              c.semana, c.anio, ci.color, e.nombre AS empresa
       FROM registro_enfunde r
       LEFT JOIN fincas f ON f.id = r.finca_id
       LEFT JOIN usuarios u ON u.id = r.usuario_id
       LEFT JOIN calendarios_enfunde c ON c.id = r.calendario_id
       LEFT JOIN cintas ci ON ci.id = c.color_id
       LEFT JOIN empresas e ON e.id = c.empresa_id
       ORDER BY r.fecha DESC, r.id DESC`,
		),

	// 2. Buscar un registro por ID
	findById: (id) =>
		query(
			`SELECT r.*, f.nombre AS finca, u.nombre AS usuario,
              c.semana, c.anio, ci.color, e.nombre AS empresa
       FROM registro_enfunde r
       LEFT JOIN fincas f ON f.id = r.finca_id
       LEFT JOIN usuarios u ON u.id = r.usuario_id
       LEFT JOIN calendarios_enfunde c ON c.id = r.calendario_id
       LEFT JOIN cintas ci ON ci.id = c.color_id
       LEFT JOIN empresas e ON e.id = c.empresa_id
       WHERE r.id=$1`,
			[id],
		),

	// 3. Crear registro
	create: ({
		fecha,
		finca_id,
		usuario_id,
		calendario_id,
		cantidad_fundas,
		observaciones,
	}) =>
		query(
			`INSERT INTO registro_enfunde
         (fecha, finca_id, usuario_id, calendario_id, cantidad_fundas, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
			[
				fecha,
				finca_id,
				usuario_id,
				calendario_id,
				cantidad_fundas,
				observaciones ?? null,
			],
		),

	// 4. Actualizar registro
	update: (
		id,
		{
			fecha,
			finca_id,
			usuario_id,
			calendario_id,
			cantidad_fundas,
			observaciones,
		},
	) =>
		query(
			`UPDATE registro_enfunde SET
         fecha = COALESCE($1, fecha),
         finca_id = COALESCE($2, finca_id),
         usuario_id = COALESCE($3, usuario_id),
         calendario_id = COALESCE($4, calendario_id),
         cantidad_fundas = COALESCE($5, cantidad_fundas),
         observaciones = COALESCE($6, observaciones)
       WHERE id=$7 RETURNING *`,
			[
				fecha ?? null,
				finca_id ?? null,
				usuario_id ?? null,
				calendario_id ?? null,
				cantidad_fundas ?? null,
				observaciones ?? null,
				id,
			],
		),

	// 5. Eliminar registro
	remove: (id) => query('DELETE FROM registro_enfunde WHERE id=$1', [id]),

	// Reemplaza tu función actual por esta:
	async obtenerPorFinca(fincaId, anio) {
		const { rows } = await query(
			`SELECT r.id, r.fecha, r.cantidad_fundas, r.observaciones, r.finca_id,
						f.nombre AS finca, u.nombre AS usuario,
						c.semana, c.anio, ci.color, e.nombre AS empresa
		 FROM registro_enfunde r
		 LEFT JOIN fincas f ON f.id = r.finca_id
		 LEFT JOIN usuarios u ON u.id = r.usuario_id
		 LEFT JOIN calendarios_enfunde c ON c.id = r.calendario_id
		 LEFT JOIN cintas ci ON ci.id = c.color_id
		 LEFT JOIN empresas e ON e.id = c.empresa_id
		 WHERE r.finca_id = $1 AND c.anio = $2
		 ORDER BY r.fecha DESC, r.id DESC`,
			[fincaId, anio],
		);
		return rows;
	},
};
