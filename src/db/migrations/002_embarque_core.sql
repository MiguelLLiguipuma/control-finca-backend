CREATE TABLE IF NOT EXISTS embarques (
	id BIGSERIAL PRIMARY KEY,
	numero_voucher VARCHAR(30) NOT NULL UNIQUE,
	fecha_embarque DATE NOT NULL,
	semana_corte SMALLINT,
	estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR'
		CHECK (estado IN ('BORRADOR', 'CONFIRMADO', 'ANULADO')),
	total_racimos_buenos INTEGER NOT NULL DEFAULT 0,
	total_racimos_rechazo INTEGER NOT NULL DEFAULT 0,
	total_racimos INTEGER NOT NULL DEFAULT 0,
	total_cajas NUMERIC(12,2) NOT NULL DEFAULT 0,
	ratio_comercial_global NUMERIC(12,4) NOT NULL DEFAULT 0,
	ratio_operativo_global NUMERIC(12,4) NOT NULL DEFAULT 0,
	observaciones TEXT,
	motivo_anulacion TEXT,
	usuario_creacion_id INTEGER NOT NULL REFERENCES usuarios(id),
	usuario_confirmacion_id INTEGER REFERENCES usuarios(id),
	usuario_anulacion_id INTEGER REFERENCES usuarios(id),
	confirmed_at TIMESTAMPTZ,
	cancelled_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embarques_fecha_estado
ON embarques (fecha_embarque, estado);

CREATE TABLE IF NOT EXISTS embarque_detalles (
	id BIGSERIAL PRIMARY KEY,
	embarque_id BIGINT NOT NULL REFERENCES embarques(id) ON DELETE CASCADE,
	finca_id INTEGER NOT NULL REFERENCES fincas(id),
	calendario_id INTEGER REFERENCES calendarios_enfunde(id),
	cinta_color VARCHAR(30) NOT NULL,
	semana_enfunde SMALLINT,
	anio_enfunde INTEGER,
	racimos_buenos INTEGER NOT NULL DEFAULT 0 CHECK (racimos_buenos >= 0),
	racimos_rechazo INTEGER NOT NULL DEFAULT 0 CHECK (racimos_rechazo >= 0),
	total_racimos INTEGER NOT NULL DEFAULT 0 CHECK (total_racimos >= 0),
	cajas_embarcadas NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cajas_embarcadas >= 0),
	ratio_comercial_linea NUMERIC(12,4) NOT NULL DEFAULT 0,
	ratio_operativo_linea NUMERIC(12,4) NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embarque_detalles_embarque
ON embarque_detalles (embarque_id);

CREATE TABLE IF NOT EXISTS embarque_auditoria (
	id BIGSERIAL PRIMARY KEY,
	embarque_id BIGINT NOT NULL REFERENCES embarques(id) ON DELETE CASCADE,
	accion VARCHAR(20) NOT NULL,
	detalle JSONB,
	usuario_id INTEGER REFERENCES usuarios(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embarque_idempotencia (
	id_local UUID PRIMARY KEY,
	voucher_id BIGINT,
	payload_hash TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
	response_json JSONB,
	error_message TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
