CREATE TABLE IF NOT EXISTS indicadores_produccion_semanal (
	id BIGSERIAL PRIMARY KEY,
	finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
	anio INTEGER NOT NULL,
	semana INTEGER NOT NULL,
	total_racimos INTEGER NOT NULL DEFAULT 0,
	corte_ideal_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
	rechazo_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
	edad_promedio NUMERIC(6,2) NOT NULL DEFAULT 0,
	variacion_semanal_pct NUMERIC(7,2) NOT NULL DEFAULT 0,
	score_corte NUMERIC(6,2) NOT NULL DEFAULT 0,
	score_rechazo NUMERIC(6,2) NOT NULL DEFAULT 0,
	score_edad NUMERIC(6,2) NOT NULL DEFAULT 0,
	score_variacion NUMERIC(6,2) NOT NULL DEFAULT 0,
	score_total NUMERIC(6,2) NOT NULL DEFAULT 0,
	clasificacion VARCHAR(20) NOT NULL DEFAULT 'RIESGO',
	calculado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	calculado_por_usuario_id INTEGER REFERENCES usuarios(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (finca_id, anio, semana)
);

CREATE INDEX IF NOT EXISTS idx_indicadores_produccion_finca_anio_semana
ON indicadores_produccion_semanal(finca_id, anio, semana DESC);

CREATE INDEX IF NOT EXISTS idx_indicadores_produccion_score
ON indicadores_produccion_semanal(score_total DESC, clasificacion);

ALTER TABLE public.indicadores_produccion_semanal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_indicadores_produccion_tenant ON public.indicadores_produccion_semanal;
CREATE POLICY p_indicadores_produccion_tenant ON public.indicadores_produccion_semanal
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
);
