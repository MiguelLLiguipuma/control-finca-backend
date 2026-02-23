ALTER TABLE registro_enfunde
ADD COLUMN IF NOT EXISTS operario_id INTEGER;

UPDATE registro_enfunde
SET operario_id = usuario_id
WHERE operario_id IS NULL;

ALTER TABLE registro_enfunde
ALTER COLUMN operario_id SET NOT NULL;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'fk_registro_enfunde_operario'
	) THEN
		ALTER TABLE registro_enfunde
		ADD CONSTRAINT fk_registro_enfunde_operario
		FOREIGN KEY (operario_id)
		REFERENCES usuarios(id);
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registro_enfunde_operario_id
ON registro_enfunde (operario_id);
