CREATE INDEX IF NOT EXISTS idx_fincas_empresa_id
ON fincas(empresa_id);

CREATE INDEX IF NOT EXISTS idx_calendarios_empresa_anio_semana
ON calendarios_enfunde(empresa_id, anio, semana);

CREATE INDEX IF NOT EXISTS idx_registro_enfunde_finca_cal_fecha
ON registro_enfunde(finca_id, calendario_id, fecha);

CREATE INDEX IF NOT EXISTS idx_registro_cosecha_finca_cal_fecha
ON registro_cosecha(finca_id, calendario_id, fecha);

CREATE INDEX IF NOT EXISTS idx_usuarios_fincas_usuario_finca
ON usuarios_fincas(usuario_id, finca_id);
