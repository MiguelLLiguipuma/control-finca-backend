CREATE TABLE labores_suelo (
  id BIGSERIAL PRIMARY KEY,
  finca_id INTEGER NOT NULL REFERENCES fincas(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  solicitud_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fertilizacion', 'herbicida', 'roza')),
  fecha DATE NOT NULL,
  intervalo_dias INTEGER CHECK (intervalo_dias BETWEEN 1 AND 730),
  proxima_fecha DATE,
  observaciones TEXT NOT NULL DEFAULT '' CHECK (length(observaciones) <= 1000),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, solicitud_id),
  CHECK ((intervalo_dias IS NULL AND proxima_fecha IS NULL)
    OR (intervalo_dias IS NOT NULL AND proxima_fecha IS NOT NULL AND proxima_fecha = fecha + intervalo_dias))
);
CREATE INDEX idx_labores_suelo_finca_fecha ON labores_suelo(finca_id, fecha DESC, id DESC);
ALTER TABLE labores_suelo ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_labores_suelo_scope ON labores_suelo
  USING (EXISTS (
    SELECT 1 FROM fincas f WHERE f.id = labores_suelo.finca_id
      AND f.empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::integer
      AND (public.app_role() = 'ADMIN' OR public.app_can_access_finca(f.id))
  ))
  WITH CHECK (usuario_id = NULLIF(current_setting('app.user_id', true), '')::integer
    AND EXISTS (
      SELECT 1 FROM fincas f WHERE f.id = labores_suelo.finca_id
        AND f.empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::integer
        AND public.app_role() IN ('ADMIN', 'SUPERVISOR')
        AND (public.app_role() = 'ADMIN' OR public.app_can_access_finca(f.id))
    ));
