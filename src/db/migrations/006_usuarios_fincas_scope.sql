CREATE TABLE IF NOT EXISTS usuarios_fincas (
	id SERIAL PRIMARY KEY,
	usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
	finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (usuario_id, finca_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_fincas_usuario
ON usuarios_fincas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_fincas_finca
ON usuarios_fincas(finca_id);
