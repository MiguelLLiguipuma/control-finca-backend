CREATE TABLE IF NOT EXISTS fumigaciones_sanidad (
	id BIGSERIAL PRIMARY KEY,
	finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
	fecha_fumigacion DATE NOT NULL,
	observacion TEXT,
	usuario_id INTEGER REFERENCES usuarios(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fumigaciones_sanidad_finca_fecha
ON fumigaciones_sanidad(finca_id, fecha_fumigacion DESC);

