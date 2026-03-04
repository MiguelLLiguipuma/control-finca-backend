CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT UPPER(COALESCE(current_setting('app.role', true), ''))
$$;

CREATE OR REPLACE FUNCTION public.app_scope_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.scope_enforced', true), '')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.app_allowed_fincas()
RETURNS int[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT CAST(x AS int)
      FROM unnest(
        string_to_array(COALESCE(current_setting('app.allowed_fincas', true), ''), ',')
      ) AS x
      WHERE x ~ '^[0-9]+$'
    ),
    ARRAY[]::int[]
  )
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.app_role() = 'ADMIN'
$$;

CREATE OR REPLACE FUNCTION public.app_can_access_finca(fid int)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT fid = ANY(public.app_allowed_fincas())
$$;

ALTER TABLE public.registro_enfunde ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_cosecha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fumigaciones_sanidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarque_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_registro_enfunde_tenant ON public.registro_enfunde;
CREATE POLICY p_registro_enfunde_tenant ON public.registro_enfunde
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
);

DROP POLICY IF EXISTS p_registro_cosecha_tenant ON public.registro_cosecha;
CREATE POLICY p_registro_cosecha_tenant ON public.registro_cosecha
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
);

DROP POLICY IF EXISTS p_fumigaciones_tenant ON public.fumigaciones_sanidad;
CREATE POLICY p_fumigaciones_tenant ON public.fumigaciones_sanidad
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
);

DROP POLICY IF EXISTS p_embarque_detalles_tenant ON public.embarque_detalles;
CREATE POLICY p_embarque_detalles_tenant ON public.embarque_detalles
FOR ALL
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
)
WITH CHECK (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR public.app_can_access_finca(finca_id)
);

DROP POLICY IF EXISTS p_embarques_tenant_select ON public.embarques;
CREATE POLICY p_embarques_tenant_select ON public.embarques
FOR SELECT
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.embarque_detalles d
    WHERE d.embarque_id = embarques.id
      AND public.app_can_access_finca(d.finca_id)
  )
);

DROP POLICY IF EXISTS p_embarques_tenant_update ON public.embarques;
CREATE POLICY p_embarques_tenant_update ON public.embarques
FOR UPDATE
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.embarque_detalles d
    WHERE d.embarque_id = embarques.id
      AND public.app_can_access_finca(d.finca_id)
  )
)
WITH CHECK (true);

DROP POLICY IF EXISTS p_embarques_tenant_delete ON public.embarques;
CREATE POLICY p_embarques_tenant_delete ON public.embarques
FOR DELETE
USING (
  NOT public.app_scope_enforced()
  OR public.app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.embarque_detalles d
    WHERE d.embarque_id = embarques.id
      AND public.app_can_access_finca(d.finca_id)
  )
);

DROP POLICY IF EXISTS p_embarques_tenant_insert ON public.embarques;
CREATE POLICY p_embarques_tenant_insert ON public.embarques
FOR INSERT
WITH CHECK (true);
