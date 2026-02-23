CREATE TABLE IF NOT EXISTS cosecha_idempotencia (
	id_local UUID PRIMARY KEY,
	payload_hash TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
	response_json JSONB,
	error_message TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cosecha_idempotencia_status_updated
ON cosecha_idempotencia(status, updated_at DESC);
