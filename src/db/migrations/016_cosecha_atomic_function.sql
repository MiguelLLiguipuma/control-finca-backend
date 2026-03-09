CREATE OR REPLACE FUNCTION public.fn_registrar_cosecha_atomic(
	p_finca_id integer,
	p_usuario_id integer,
	p_fecha date,
	p_calendario_id integer,
	p_cantidad_racimos integer,
	p_cantidad_rechazo integer
)
RETURNS registro_cosecha
LANGUAGE plpgsql
AS $$
DECLARE
	v_total_solicitado integer;
	v_saldo_disponible integer;
	v_row registro_cosecha;
BEGIN
	IF p_finca_id IS NULL OR p_finca_id <= 0 THEN
		RAISE EXCEPTION 'finca_id invalido';
	END IF;

	IF p_usuario_id IS NULL OR p_usuario_id <= 0 THEN
		RAISE EXCEPTION 'usuario_id invalido';
	END IF;

	IF p_fecha IS NULL THEN
		RAISE EXCEPTION 'fecha invalida';
	END IF;

	IF p_calendario_id IS NULL OR p_calendario_id <= 0 THEN
		RAISE EXCEPTION 'calendario_id invalido';
	END IF;

	p_cantidad_racimos := GREATEST(COALESCE(p_cantidad_racimos, 0), 0);
	p_cantidad_rechazo := GREATEST(COALESCE(p_cantidad_rechazo, 0), 0);
	v_total_solicitado := p_cantidad_racimos + p_cantidad_rechazo;

	IF v_total_solicitado <= 0 THEN
		RAISE EXCEPTION 'No hay cantidades validas para registrar';
	END IF;

	PERFORM pg_advisory_xact_lock(p_finca_id, p_calendario_id);

	SELECT vbc.saldo_en_campo::int
	INTO v_saldo_disponible
	FROM vw_balance_campo vbc
	WHERE vbc.finca_id = p_finca_id
	  AND vbc.calendario_id = p_calendario_id
	LIMIT 1;

	IF v_saldo_disponible IS NULL THEN
		RAISE EXCEPTION
			'Calendario % no pertenece a la finca o no tiene saldo',
			p_calendario_id;
	END IF;

	IF v_total_solicitado > v_saldo_disponible THEN
		RAISE EXCEPTION
			'Saldo excedido en calendario %. Disponible: %, solicitado: %',
			p_calendario_id,
			v_saldo_disponible,
			v_total_solicitado;
	END IF;

	INSERT INTO registro_cosecha (
		finca_id,
		calendario_id,
		cantidad_racimos,
		cantidad_rechazo,
		fecha,
		usuario_id
	) VALUES (
		p_finca_id,
		p_calendario_id,
		p_cantidad_racimos,
		p_cantidad_rechazo,
		p_fecha,
		p_usuario_id
	)
	RETURNING *
	INTO v_row;

	RETURN v_row;
END;
$$;
