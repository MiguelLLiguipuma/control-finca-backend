import { query, pool } from '../db/db.js';

function cleanLimit(value, fallback = 50) {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) return fallback;
	return Math.min(n, 200);
}

export const AlertaModel = {
	async listar({ usuarioId, estado, fincaIds = [], limit = 50 }) {
		const estados = Array.isArray(estado)
			? estado
			: String(estado || '')
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean);
		const { rows } = await query(
			`SELECT
         a.id,
         a.empresa_id,
         a.finca_id,
         f.nombre AS finca_nombre,
         a.tipo,
         a.severidad,
         a.titulo,
         a.mensaje,
         a.entidad_tipo,
         a.entidad_id,
         a.metadata,
         a.estado,
         a.detectada_en,
         a.enviada_en,
         a.leida_en,
         a.resuelta_en,
         d.estado AS estado_destinatario,
         d.canal
       FROM alertas_operativas a
       LEFT JOIN fincas f ON f.id = a.finca_id
       LEFT JOIN alertas_destinatarios d
         ON d.alerta_id = a.id
        AND d.usuario_id = $1
        AND d.canal = 'in_app'
       WHERE ($2::text[] IS NULL OR a.estado = ANY($2::text[]))
         AND ($3::int[] IS NULL OR a.finca_id = ANY($3::int[]))
       ORDER BY
         CASE a.severidad
           WHEN 'critica' THEN 1
           WHEN 'alta' THEN 2
           WHEN 'media' THEN 3
           ELSE 4
         END,
         a.detectada_en DESC
       LIMIT $4`,
			[
				Number(usuarioId || 0),
				estados.length ? estados : null,
				fincaIds.length ? fincaIds : null,
				cleanLimit(limit),
			],
		);
		return rows;
	},

	async resumen({ fincaIds = [] }) {
		const { rows } = await query(
			`SELECT
         COUNT(*) FILTER (WHERE estado IN ('pendiente', 'enviada', 'leida'))::int AS abiertas,
         COUNT(*) FILTER (WHERE estado IN ('pendiente', 'enviada'))::int AS pendientes,
         COUNT(*) FILTER (WHERE severidad = 'critica' AND estado <> 'resuelta')::int AS criticas,
         COUNT(*) FILTER (WHERE severidad = 'alta' AND estado <> 'resuelta')::int AS altas
       FROM alertas_operativas
       WHERE ($1::int[] IS NULL OR finca_id = ANY($1::int[]))`,
			[fincaIds.length ? fincaIds : null],
		);
		return rows[0] || { abiertas: 0, pendientes: 0, criticas: 0, altas: 0 };
	},

	async insertarAlerta(alerta, destinatarios = []) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const insert = await client.query(
				`INSERT INTO alertas_operativas (
           empresa_id,
           finca_id,
           tipo,
           severidad,
           titulo,
           mensaje,
           entidad_tipo,
           entidad_id,
           metadata,
           dedupe_key
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         ON CONFLICT (dedupe_key)
           WHERE estado NOT IN ('resuelta')
           DO NOTHING
         RETURNING *`,
				[
					alerta.empresa_id ?? null,
					alerta.finca_id ?? null,
					alerta.tipo,
					alerta.severidad || 'media',
					alerta.titulo,
					alerta.mensaje,
					alerta.entidad_tipo ?? null,
					alerta.entidad_id ? String(alerta.entidad_id) : null,
					JSON.stringify(alerta.metadata || {}),
					alerta.dedupe_key,
				],
			);

			const creada = insert.rows[0] || null;
			if (!creada) {
				await client.query('ROLLBACK');
				return { creada: false, alerta: null };
			}

			for (const destino of destinatarios) {
				await client.query(
					`INSERT INTO alertas_destinatarios (
             alerta_id,
             usuario_id,
             canal,
             telefono_whatsapp
           )
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (alerta_id, usuario_id, canal) DO NOTHING`,
					[
						creada.id,
						destino.usuario_id,
						destino.canal || 'in_app',
						destino.telefono_whatsapp || null,
					],
				);
			}

			await client.query('COMMIT');
			return { creada: true, alerta: creada };
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	async destinatariosParaFinca({ fincaId, empresaId }) {
		const { rows } = await query(
			`WITH roles_usuario AS (
         SELECT
           u.id AS usuario_id,
           u.empresa_id,
           u.activo,
           UPPER(COALESCE(r.nombre, '')) AS rol
         FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
         LEFT JOIN roles r ON r.id = ur.rol_id
         WHERE u.activo = TRUE
       )
       SELECT DISTINCT ru.usuario_id
       FROM roles_usuario ru
       LEFT JOIN usuarios_fincas uf ON uf.usuario_id = ru.usuario_id
       WHERE (
            ru.rol IN ('ADMIN', 'ADMINISTRADOR', 'GERENTE')
            AND ($2::int IS NULL OR ru.empresa_id = $2 OR ru.empresa_id IS NULL)
          )
          OR (
            ru.rol = 'SUPERVISOR'
            AND (
              $2::int IS NULL
              OR ru.empresa_id = $2
              OR ru.empresa_id IS NULL
              OR uf.finca_id = $1
            )
          )
          OR (
            ru.rol IN ('OPERADOR', 'OPERARIO', 'TRABAJADOR')
            AND uf.finca_id = $1
          )`,
			[fincaId, empresaId || null],
		);
		return rows.map((r) => ({ usuario_id: Number(r.usuario_id), canal: 'in_app' }));
	},

	async obtenerFincas({ fincaIds = [], empresaId = null }) {
		const { rows } = await query(
			`SELECT id, nombre, empresa_id
       FROM fincas
       WHERE ($1::int[] IS NULL OR id = ANY($1::int[]))
         AND ($2::int IS NULL OR empresa_id = $2)
       ORDER BY id`,
			[fincaIds.length ? fincaIds : null, empresaId || null],
		);
		return rows;
	},

	async detectarFaltaEnfunde({ fecha, fincaIds = [] }) {
		const { rows } = await query(
			`SELECT f.id AS finca_id, f.nombre AS finca_nombre, f.empresa_id
       FROM fincas f
       WHERE ($2::int[] IS NULL OR f.id = ANY($2::int[]))
         AND NOT EXISTS (
           SELECT 1
           FROM registro_enfunde r
           WHERE r.finca_id = f.id
             AND r.fecha = $1::date
         )
       ORDER BY f.id`,
			[fecha, fincaIds.length ? fincaIds : null],
		);
		return rows;
	},

	async detectarCintasCriticas({ fincaIds = [], edadCritica = 15 }) {
		const { rows } = await query(
			`SELECT
         vbc.finca_id,
         f.nombre AS finca_nombre,
         f.empresa_id,
         vbc.calendario_id,
         vbc.semana_enfunde,
         ce.anio,
         vbc.color_cinta,
         vbc.saldo_en_campo,
         GREATEST(
           0,
           (EXTRACT(ISOYEAR FROM CURRENT_DATE)::int * 53 + EXTRACT(WEEK FROM CURRENT_DATE)::int)
           - (ce.anio::int * 53 + vbc.semana_enfunde::int)
         )::int AS edad_semanas
       FROM vw_balance_campo vbc
       JOIN fincas f ON f.id = vbc.finca_id
       JOIN calendarios_enfunde ce ON ce.id = vbc.calendario_id
       WHERE vbc.saldo_en_campo > 0
         AND ($1::int[] IS NULL OR vbc.finca_id = ANY($1::int[]))
         AND GREATEST(
           0,
           (EXTRACT(ISOYEAR FROM CURRENT_DATE)::int * 53 + EXTRACT(WEEK FROM CURRENT_DATE)::int)
           - (ce.anio::int * 53 + vbc.semana_enfunde::int)
         ) >= $2
       ORDER BY edad_semanas DESC, vbc.saldo_en_campo DESC`,
			[fincaIds.length ? fincaIds : null, Number(edadCritica || 15)],
		);
		return rows;
	},

	async detectarFumigacionVencida({ fincaIds = [], diasMaximos = 14 }) {
		const { rows } = await query(
			`SELECT
         f.id AS finca_id,
         f.nombre AS finca_nombre,
         f.empresa_id,
         MAX(fs.fecha_fumigacion)::date AS ultima_fumigacion,
         COALESCE((CURRENT_DATE - MAX(fs.fecha_fumigacion)::date), 9999)::int AS dias_sin_fumigar
       FROM fincas f
       LEFT JOIN fumigaciones_sanidad fs ON fs.finca_id = f.id
       WHERE ($1::int[] IS NULL OR f.id = ANY($1::int[]))
       GROUP BY f.id, f.nombre, f.empresa_id
       HAVING MAX(fs.fecha_fumigacion) IS NULL
          OR (CURRENT_DATE - MAX(fs.fecha_fumigacion)::date) >= $2
       ORDER BY dias_sin_fumigar DESC`,
			[fincaIds.length ? fincaIds : null, Number(diasMaximos || 14)],
		);
		return rows;
	},

	async detectarClimaDesactualizado({ fincaIds = [], diasMaximos = 1 }) {
		const { rows } = await query(
			`SELECT
         f.id AS finca_id,
         f.nombre AS finca_nombre,
         f.empresa_id,
         MAX(h.fecha)::date AS ultima_fecha_clima,
         COALESCE((CURRENT_DATE - MAX(h.fecha)::date), 9999)::int AS dias_sin_clima
       FROM fincas f
       LEFT JOIN historial_clima_fincas h ON h.finca_id = f.id
       WHERE ($1::int[] IS NULL OR f.id = ANY($1::int[]))
       GROUP BY f.id, f.nombre, f.empresa_id
       HAVING MAX(h.fecha) IS NULL
          OR (CURRENT_DATE - MAX(h.fecha)::date) > $2
       ORDER BY dias_sin_clima DESC`,
			[fincaIds.length ? fincaIds : null, Number(diasMaximos || 1)],
		);
		return rows;
	},

	async marcarLeida({ alertaId, usuarioId }) {
		const { rows } = await query(
			`UPDATE alertas_destinatarios
       SET estado = 'leido'
       WHERE alerta_id = $1
         AND usuario_id = $2
         AND canal = 'in_app'
       RETURNING alerta_id`,
			[alertaId, usuarioId],
		);
		await query(
			`UPDATE alertas_operativas
       SET estado = CASE WHEN estado = 'pendiente' THEN 'leida' ELSE estado END,
           leida_en = COALESCE(leida_en, NOW())
       WHERE id = $1
       RETURNING id`,
			[alertaId],
		);
		return rows.length > 0;
	},

	async resolver({ alertaId }) {
		const { rows } = await query(
			`UPDATE alertas_operativas
       SET estado = 'resuelta',
           resuelta_en = NOW()
       WHERE id = $1
       RETURNING *`,
			[alertaId],
		);
		return rows[0] || null;
	},
};
