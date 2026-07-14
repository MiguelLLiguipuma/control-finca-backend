CREATE TABLE IF NOT EXISTS webauthn_challenges (
	challenge TEXT PRIMARY KEY,
	tipo TEXT NOT NULL CHECK (tipo IN ('registration', 'authentication')),
	usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
	email TEXT,
	expires_at TIMESTAMPTZ NOT NULL,
	used_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires
ON webauthn_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_usuario
ON webauthn_challenges(usuario_id);

CREATE TABLE IF NOT EXISTS usuario_passkeys (
	id BIGSERIAL PRIMARY KEY,
	usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
	credential_id TEXT NOT NULL UNIQUE,
	public_key_pem TEXT NOT NULL,
	sign_count BIGINT NOT NULL DEFAULT 0,
	transports TEXT[] NOT NULL DEFAULT '{}',
	device_name TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_usuario_passkeys_usuario
ON usuario_passkeys(usuario_id);
