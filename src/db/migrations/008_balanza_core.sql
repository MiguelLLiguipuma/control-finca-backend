CREATE TABLE IF NOT EXISTS balanza_dispositivos (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balanza_dispositivos_finca
ON balanza_dispositivos(finca_id);

CREATE TABLE IF NOT EXISTS balanza_eventos (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('live', 'session_end')),
  session_id BIGINT NOT NULL,
  cajas INTEGER NOT NULL CHECK (cajas >= 0),
  peso_kg NUMERIC(12, 3),
  peso_pico_kg NUMERIC(12, 3),
  event_ts TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balanza_eventos_finca_ts
ON balanza_eventos(finca_id, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_balanza_eventos_device_session
ON balanza_eventos(device_id, session_id);

CREATE TABLE IF NOT EXISTS balanza_estado_actual (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE RESTRICT,
  session_id BIGINT,
  estado TEXT NOT NULL CHECK (estado IN ('IDLE', 'RUN')),
  cajas INTEGER NOT NULL DEFAULT 0 CHECK (cajas >= 0),
  peso_neto_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  peso_pico_kg NUMERIC(12, 3),
  event_ts TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balanza_estado_actual_finca_ts
ON balanza_estado_actual(finca_id, event_ts DESC);

CREATE TABLE IF NOT EXISTS balanza_sesiones (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE RESTRICT,
  session_id BIGINT NOT NULL,
  cajas INTEGER NOT NULL CHECK (cajas >= 0),
  peso_pico_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  iniciado_en TIMESTAMPTZ,
  finalizado_en TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_balanza_sesiones_finca_finalizado
ON balanza_sesiones(finca_id, finalizado_en DESC);
