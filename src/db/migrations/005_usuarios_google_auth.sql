ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local';

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS provider_sub TEXT;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;

UPDATE usuarios
SET auth_provider = 'local'
WHERE auth_provider IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_provider_sub
ON usuarios(provider_sub)
WHERE provider_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_provider
ON usuarios(auth_provider);
