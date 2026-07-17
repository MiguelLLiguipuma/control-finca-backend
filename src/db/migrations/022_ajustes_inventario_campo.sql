CREATE TABLE IF NOT EXISTS ajustes_inventario_campo (
  id BIGSERIAL PRIMARY KEY,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  calendario_id INTEGER NOT NULL REFERENCES calendarios_enfunde(id) ON DELETE CASCADE,
  cantidad_ajustada INTEGER NOT NULL CHECK (cantidad_ajustada > 0),
  tipo TEXT NOT NULL DEFAULT 'cierre_historico',
  motivo TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ajustes_inventario_tipo CHECK (tipo IN ('cierre_historico', 'ajuste_manual'))
);

CREATE INDEX IF NOT EXISTS idx_ajustes_inventario_finca_cal
  ON ajustes_inventario_campo(finca_id, calendario_id);

CREATE INDEX IF NOT EXISTS idx_ajustes_inventario_creado
  ON ajustes_inventario_campo(creado_en DESC);

CREATE OR REPLACE VIEW vw_balance_campo AS
WITH ajustes AS (
  SELECT
    finca_id,
    calendario_id,
    SUM(cantidad_ajustada)::bigint AS total_ajustado
  FROM ajustes_inventario_campo
  GROUP BY finca_id, calendario_id
)
SELECT
  f.id AS finca_id,
  ce.id AS calendario_id,
  ce.semana AS semana_enfunde,
  c.color AS color_cinta,
  c.color_hex,
  COALESCE(SUM(re.cantidad_fundas), 0::bigint) AS total_enfunde,
  COALESCE((
    SELECT SUM(rc.cantidad_racimos + rc.cantidad_rechazo)
    FROM registro_cosecha rc
    WHERE rc.calendario_id = ce.id
      AND rc.finca_id = f.id
  ), 0::bigint) AS total_cosechado,
  GREATEST(
    0::bigint,
    COALESCE(SUM(re.cantidad_fundas), 0::bigint)
    - COALESCE((
      SELECT SUM(rc.cantidad_racimos + rc.cantidad_rechazo)
      FROM registro_cosecha rc
      WHERE rc.calendario_id = ce.id
        AND rc.finca_id = f.id
    ), 0::bigint)
    - COALESCE(MAX(a.total_ajustado), 0::bigint)
  ) AS saldo_en_campo,
  CASE
    WHEN SUM(re.cantidad_fundas) > 0 THEN
      ROUND(
        COALESCE((
          SELECT SUM(rc.cantidad_racimos)
          FROM registro_cosecha rc
          WHERE rc.calendario_id = ce.id
            AND rc.finca_id = f.id
        ), 0::bigint)::numeric / SUM(re.cantidad_fundas)::numeric * 100::numeric,
        2
      )
    ELSE 0::numeric
  END AS ratio_aprovechamiento,
  COALESCE(MAX(a.total_ajustado), 0::bigint) AS total_ajustado
FROM fincas f
JOIN registro_enfunde re ON f.id = re.finca_id
JOIN calendarios_enfunde ce ON re.calendario_id = ce.id
JOIN cintas c ON ce.color_id = c.id
LEFT JOIN ajustes a
  ON a.finca_id = f.id
 AND a.calendario_id = ce.id
GROUP BY f.id, ce.id, ce.semana, c.color, c.color_hex;

ALTER TABLE public.ajustes_inventario_campo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_ajustes_inventario_tenant ON public.ajustes_inventario_campo;
CREATE POLICY p_ajustes_inventario_tenant ON public.ajustes_inventario_campo
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_role() = 'SUPERVISOR'
  OR public.app_can_access_finca(finca_id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_role() = 'SUPERVISOR'
  OR public.app_can_access_finca(finca_id)
);
