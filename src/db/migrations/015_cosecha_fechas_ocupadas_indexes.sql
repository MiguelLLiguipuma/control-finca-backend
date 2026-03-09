CREATE INDEX IF NOT EXISTS idx_registro_cosecha_finca_fecha
ON registro_cosecha(finca_id, fecha);

CREATE INDEX IF NOT EXISTS idx_embarque_detalles_finca_embarque
ON embarque_detalles(finca_id, embarque_id);
