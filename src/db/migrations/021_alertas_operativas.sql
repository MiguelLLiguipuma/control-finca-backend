CREATE TABLE IF NOT EXISTS alertas_operativas (
  id BIGSERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  finca_id INTEGER REFERENCES fincas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  severidad TEXT NOT NULL DEFAULT 'media',
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  entidad_tipo TEXT,
  entidad_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  detectada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviada_en TIMESTAMPTZ,
  leida_en TIMESTAMPTZ,
  resuelta_en TIMESTAMPTZ,
  silenciada_hasta TIMESTAMPTZ,
  dedupe_key TEXT NOT NULL,
  CONSTRAINT chk_alertas_operativas_severidad CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
  CONSTRAINT chk_alertas_operativas_estado CHECK (estado IN ('pendiente', 'enviada', 'leida', 'resuelta', 'silenciada'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alertas_operativas_dedupe_abierta
  ON alertas_operativas(dedupe_key)
  WHERE estado NOT IN ('resuelta');

CREATE INDEX IF NOT EXISTS idx_alertas_operativas_finca_estado
  ON alertas_operativas(finca_id, estado, detectada_en DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_operativas_empresa_estado
  ON alertas_operativas(empresa_id, estado, detectada_en DESC);

CREATE TABLE IF NOT EXISTS alertas_destinatarios (
  id BIGSERIAL PRIMARY KEY,
  alerta_id BIGINT NOT NULL REFERENCES alertas_operativas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal TEXT NOT NULL DEFAULT 'in_app',
  telefono_whatsapp TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  enviado_en TIMESTAMPTZ,
  error_envio TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alertas_destinatarios_canal CHECK (canal IN ('in_app', 'whatsapp')),
  CONSTRAINT chk_alertas_destinatarios_estado CHECK (estado IN ('pendiente', 'enviado', 'leido', 'fallido', 'omitido')),
  CONSTRAINT uq_alertas_destinatarios_alerta_usuario_canal UNIQUE (alerta_id, usuario_id, canal)
);

CREATE INDEX IF NOT EXISTS idx_alertas_destinatarios_usuario_estado
  ON alertas_destinatarios(usuario_id, estado, creado_en DESC);

CREATE TABLE IF NOT EXISTS alertas_reglas (
  id BIGSERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  finca_id INTEGER REFERENCES fincas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  severidad TEXT NOT NULL DEFAULT 'media',
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  canales TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alertas_reglas_severidad CHECK (severidad IN ('baja', 'media', 'alta', 'critica'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_reglas_tipo_activa
  ON alertas_reglas(tipo, activa);

CREATE OR REPLACE FUNCTION trg_set_actualizado_en_alertas_reglas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_actualizado_en_alertas_reglas ON alertas_reglas;
CREATE TRIGGER trg_set_actualizado_en_alertas_reglas
BEFORE UPDATE ON alertas_reglas
FOR EACH ROW
EXECUTE FUNCTION trg_set_actualizado_en_alertas_reglas();

ALTER TABLE alertas_operativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_reglas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_alertas_operativas_tenant_select ON alertas_operativas;
DROP POLICY IF EXISTS p_alertas_operativas_tenant_write ON alertas_operativas;
DROP POLICY IF EXISTS p_alertas_destinatarios_tenant_select ON alertas_destinatarios;
DROP POLICY IF EXISTS p_alertas_destinatarios_tenant_write ON alertas_destinatarios;
DROP POLICY IF EXISTS p_alertas_reglas_tenant_select ON alertas_reglas;
DROP POLICY IF EXISTS p_alertas_reglas_tenant_write ON alertas_reglas;

CREATE POLICY p_alertas_operativas_tenant_select
  ON alertas_operativas
  FOR SELECT
  USING (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
    OR public.app_can_access_finca(finca_id)
  );

CREATE POLICY p_alertas_operativas_tenant_write
  ON alertas_operativas
  FOR ALL
  USING (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  )
  WITH CHECK (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  );

CREATE POLICY p_alertas_destinatarios_tenant_select
  ON alertas_destinatarios
  FOR SELECT
  USING (
    NOT public.app_scope_enforced()
    OR usuario_id = NULLIF(current_setting('app.user_id', true), '')::int
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  );

CREATE POLICY p_alertas_destinatarios_tenant_write
  ON alertas_destinatarios
  FOR ALL
  USING (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  )
  WITH CHECK (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  );

CREATE POLICY p_alertas_reglas_tenant_select
  ON alertas_reglas
  FOR SELECT
  USING (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  );

CREATE POLICY p_alertas_reglas_tenant_write
  ON alertas_reglas
  FOR ALL
  USING (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  )
  WITH CHECK (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
  );
