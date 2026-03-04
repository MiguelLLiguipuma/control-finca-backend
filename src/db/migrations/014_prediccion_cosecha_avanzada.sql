-- Cache persistente para prediccion semanal de cosecha por finca (tenant-safe)
CREATE TABLE IF NOT EXISTS predicciones_cosecha_semanal (
  id BIGSERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  anio_objetivo SMALLINT NOT NULL,
  semana_objetivo SMALLINT NOT NULL,
  ventana_historial SMALLINT NOT NULL DEFAULT 8 CHECK (ventana_historial BETWEEN 4 AND 12),
  algoritmo_version TEXT NOT NULL DEFAULT 'agri-ts-v1',
  fuente_hash TEXT NOT NULL,
  resultado_json JSONB NOT NULL,
  generado_por_usuario_id INTEGER NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_prediccion_cosecha_semana UNIQUE (
    empresa_id,
    finca_id,
    anio_objetivo,
    semana_objetivo,
    ventana_historial,
    algoritmo_version
  )
);

CREATE INDEX IF NOT EXISTS idx_prediccion_cosecha_lookup
  ON predicciones_cosecha_semanal (empresa_id, finca_id, anio_objetivo, semana_objetivo, ventana_historial);

CREATE INDEX IF NOT EXISTS idx_prediccion_cosecha_updated
  ON predicciones_cosecha_semanal (actualizado_en DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'registro_cosecha'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registro_cosecha_finca_fecha ON registro_cosecha (finca_id, fecha DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registro_cosecha_finca_cal_fecha ON registro_cosecha (finca_id, calendario_id, fecha DESC)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'calendarios_enfunde'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_calendarios_enfunde_id_anio_semana ON calendarios_enfunde (id, anio, semana)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION trg_set_actualizado_en_prediccion_cosecha()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_actualizado_en_prediccion_cosecha ON predicciones_cosecha_semanal;
CREATE TRIGGER trg_set_actualizado_en_prediccion_cosecha
BEFORE UPDATE ON predicciones_cosecha_semanal
FOR EACH ROW
EXECUTE FUNCTION trg_set_actualizado_en_prediccion_cosecha();

ALTER TABLE predicciones_cosecha_semanal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_prediccion_cosecha_tenant_select ON predicciones_cosecha_semanal;
DROP POLICY IF EXISTS p_prediccion_cosecha_tenant_write ON predicciones_cosecha_semanal;

CREATE POLICY p_prediccion_cosecha_tenant_select
  ON predicciones_cosecha_semanal
  FOR SELECT
  USING (
    empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::int
  );

CREATE POLICY p_prediccion_cosecha_tenant_write
  ON predicciones_cosecha_semanal
  FOR ALL
  USING (
    empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::int
  )
  WITH CHECK (
    empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::int
  );
