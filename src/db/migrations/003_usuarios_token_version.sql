ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

UPDATE usuarios
SET token_version = 1
WHERE token_version IS NULL;
