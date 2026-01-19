import { pool } from '../../db/db.js';

export const CosechaModel = {
	insertarCosecha: async (datos) => {
		const query = `
      INSERT INTO registro_cosecha 
      (finca_id, calendario_id, cantidad_racimos, cantidad_rechazo, fecha, usuario_id) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
		const values = [
			datos.finca_id,
			datos.calendario_id,
			datos.cantidad_racimos,
			datos.cantidad_rechazo,
			datos.fecha,
			datos.usuario_id,
		];
		const { rows } = await pool.query(query, values);
		return rows[0];
	},

	obtenerBalancePorFinca: async (fincaId) => {
		const query = `SELECT * FROM vw_balance_campo WHERE finca_id = $1 AND saldo_en_campo > 0`;
		const { rows } = await pool.query(query, [fincaId]);
		return rows;
	},
};
