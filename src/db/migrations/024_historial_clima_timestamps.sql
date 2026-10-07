-- Migration 019 did not add columns when the climate table already existed.
-- Keep unknown historical timestamps null; defaults apply only to new records.
ALTER TABLE historial_clima_fincas
  ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ;

ALTER TABLE historial_clima_fincas
  ALTER COLUMN creado_en SET DEFAULT NOW(),
  ALTER COLUMN actualizado_en SET DEFAULT NOW();

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
