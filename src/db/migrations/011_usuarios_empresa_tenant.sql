ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id
ON usuarios(empresa_id);

-- Backfill conservador: solo cuando el usuario tiene fincas de una unica empresa.
WITH empresa_unica AS (
  SELECT
    uf.usuario_id,
    MIN(f.empresa_id) AS empresa_id,
    COUNT(DISTINCT f.empresa_id) AS empresas_count
  FROM usuarios_fincas uf
  JOIN fincas f ON f.id = uf.finca_id
  WHERE f.empresa_id IS NOT NULL
  GROUP BY uf.usuario_id
)
UPDATE usuarios u
SET empresa_id = eu.empresa_id
FROM empresa_unica eu
WHERE u.id = eu.usuario_id
  AND eu.empresas_count = 1
  AND u.empresa_id IS NULL;
