-- Alinea la edad de corte a conteo desde semana 0.
-- Si la configuracion historica estaba guardada como ventana 12-13 (conteo desde 1),
-- se desplaza a 11-12 para conservar el mismo significado biologico.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'configuracion_crecimiento'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'configuracion_crecimiento'
        AND column_name = 'semana_inicio'
    ) THEN
      EXECUTE '
        UPDATE configuracion_crecimiento
        SET semana_inicio = GREATEST(0, semana_inicio - 1)
        WHERE semana_inicio IS NOT NULL
          AND semana_inicio > 0
      ';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'configuracion_crecimiento'
        AND column_name = 'semana_fin'
    ) THEN
      EXECUTE '
        UPDATE configuracion_crecimiento
        SET semana_fin = GREATEST(0, semana_fin - 1)
        WHERE semana_fin IS NOT NULL
          AND semana_fin > 0
      ';
    END IF;
  END IF;
END $$;
