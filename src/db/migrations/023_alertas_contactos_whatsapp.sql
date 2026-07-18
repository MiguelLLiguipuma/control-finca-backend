CREATE TABLE IF NOT EXISTS alertas_contactos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  telefono_whatsapp TEXT,
  whatsapp_activo BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_activo BOOLEAN NOT NULL DEFAULT TRUE,
  tipos TEXT[] NOT NULL DEFAULT ARRAY[
    'enfunde_faltante',
    'cinta_critica',
    'inventario_historico_cintas',
    'fumigacion_vencida',
    'clima_desactualizado'
  ],
  severidad_minima TEXT NOT NULL DEFAULT 'baja',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_alertas_contactos_usuario UNIQUE (usuario_id),
  CONSTRAINT chk_alertas_contactos_severidad CHECK (severidad_minima IN ('baja', 'media', 'alta', 'critica'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_contactos_empresa
  ON alertas_contactos(empresa_id);

CREATE OR REPLACE FUNCTION trg_set_actualizado_en_alertas_contactos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_actualizado_en_alertas_contactos ON alertas_contactos;
CREATE TRIGGER trg_set_actualizado_en_alertas_contactos
BEFORE UPDATE ON alertas_contactos
FOR EACH ROW
EXECUTE FUNCTION trg_set_actualizado_en_alertas_contactos();

ALTER TABLE alertas_contactos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_alertas_contactos_tenant_select ON alertas_contactos;
DROP POLICY IF EXISTS p_alertas_contactos_tenant_write ON alertas_contactos;

CREATE POLICY p_alertas_contactos_tenant_select
  ON alertas_contactos
  FOR SELECT
  USING (
    NOT public.app_scope_enforced()
    OR public.app_is_admin()
    OR public.app_role() = 'SUPERVISOR'
    OR usuario_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

CREATE POLICY p_alertas_contactos_tenant_write
  ON alertas_contactos
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
