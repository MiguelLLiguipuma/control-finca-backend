import { pool } from '../../db/db.js';

function ejecutar(client, text, values) {
	if (client) return client.query(text, values);
	return pool.query(text, values);
}

export const CosechaModel = {
	insertarCosecha: async (datos, client = null) => {
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
		const { rows } = await ejecutar(client, query, values);
		return rows[0];
	},

	insertarCosechaLoteAtomic: async (
		{ finca_id, usuario_id, fecha, detalles },
		client = null,
	) => {
		const query = `
      SELECT *
      FROM fn_registrar_cosecha_lote_atomic($1, $2, $3::date, $4::jsonb)`;
		const values = [finca_id, usuario_id, fecha, JSON.stringify(detalles || [])];
		const { rows } = await ejecutar(client, query, values);
		return rows;
	},

	obtenerBalancePorFinca: async (fincaId) => {
		const query = `SELECT * FROM vw_balance_campo WHERE finca_id = $1 AND saldo_en_campo > 0`;
		const { rows } = await pool.query(query, [fincaId]);
		return rows;
	},

	obtenerInventarioHistorico: async ({ fincaId, edadHistorica = 17 }) => {
		const { rows } = await pool.query(
			`SELECT
         vbc.finca_id,
         f.nombre AS finca_nombre,
         vbc.calendario_id,
         vbc.semana_enfunde,
         ce.anio,
         vbc.color_cinta,
         vbc.color_hex,
         vbc.total_enfunde,
         vbc.total_cosechado,
         COALESCE(vbc.total_ajustado, 0)::int AS total_ajustado,
         vbc.saldo_en_campo,
         GREATEST(
           0,
           (EXTRACT(ISOYEAR FROM CURRENT_DATE)::int * 53 + EXTRACT(WEEK FROM CURRENT_DATE)::int)
           - (ce.anio::int * 53 + vbc.semana_enfunde::int)
         )::int AS edad_semanas
       FROM vw_balance_campo vbc
       JOIN fincas f ON f.id = vbc.finca_id
       JOIN calendarios_enfunde ce ON ce.id = vbc.calendario_id
       WHERE vbc.finca_id = $1
         AND vbc.saldo_en_campo > 0
         AND GREATEST(
           0,
           (EXTRACT(ISOYEAR FROM CURRENT_DATE)::int * 53 + EXTRACT(WEEK FROM CURRENT_DATE)::int)
           - (ce.anio::int * 53 + vbc.semana_enfunde::int)
         ) >= $2
       ORDER BY edad_semanas DESC, vbc.saldo_en_campo DESC`,
			[fincaId, edadHistorica],
		);
		return rows;
	},

	obtenerSaldoInventario: async ({ fincaId, calendarioId }, client = null) => {
		const { rows } = await ejecutar(
			client,
			`SELECT finca_id, calendario_id, saldo_en_campo
       FROM vw_balance_campo
       WHERE finca_id = $1
         AND calendario_id = $2
       LIMIT 1`,
			[fincaId, calendarioId],
		);
		return rows[0] || null;
	},

	insertarAjusteInventario: async (datos, client = null) => {
		const { rows } = await ejecutar(
			client,
			`INSERT INTO ajustes_inventario_campo (
         finca_id,
         calendario_id,
         cantidad_ajustada,
         tipo,
         motivo,
         metadata,
         usuario_id
       )
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING *`,
			[
				datos.finca_id,
				datos.calendario_id,
				datos.cantidad_ajustada,
				datos.tipo || 'cierre_historico',
				datos.motivo,
				JSON.stringify(datos.metadata || {}),
				datos.usuario_id || null,
			],
		);
		return rows[0];
	},
};
