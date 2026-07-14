CREATE TABLE IF NOT EXISTS historial_clima_fincas (
  id BIGSERIAL PRIMARY KEY,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  temp_media NUMERIC(8, 2) NOT NULL,
  unidades_calor_dia NUMERIC(8, 2) NOT NULL,
  precipitacion_mm NUMERIC(8, 2) NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_historial_clima_finca_fecha UNIQUE (finca_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_historial_clima_finca_fecha
  ON historial_clima_fincas (finca_id, fecha DESC);

CREATE OR REPLACE FUNCTION trg_set_actualizado_en_historial_clima()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_actualizado_en_historial_clima ON historial_clima_fincas;
CREATE TRIGGER trg_set_actualizado_en_historial_clima
BEFORE UPDATE ON historial_clima_fincas
FOR EACH ROW
EXECUTE FUNCTION trg_set_actualizado_en_historial_clima();
