CREATE OR REPLACE FUNCTION public.app_allowed_empresas()
RETURNS int[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT f.empresa_id
      FROM public.fincas f
      WHERE f.id = ANY(public.app_allowed_fincas())
        AND f.empresa_id IS NOT NULL
    ),
    ARRAY[]::int[]
  )
$$;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fincas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendarios_enfunde ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_empresas_tenant ON public.empresas;
CREATE POLICY p_empresas_tenant ON public.empresas
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR id = ANY(public.app_allowed_empresas())
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR id = ANY(public.app_allowed_empresas())
);

DROP POLICY IF EXISTS p_fincas_tenant ON public.fincas;
CREATE POLICY p_fincas_tenant ON public.fincas
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(id)
);

DROP POLICY IF EXISTS p_calendarios_tenant ON public.calendarios_enfunde;
CREATE POLICY p_calendarios_tenant ON public.calendarios_enfunde
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR empresa_id = ANY(public.app_allowed_empresas())
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR empresa_id = ANY(public.app_allowed_empresas())
);
