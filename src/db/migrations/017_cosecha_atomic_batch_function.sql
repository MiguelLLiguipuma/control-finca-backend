CREATE OR REPLACE FUNCTION public.fn_registrar_cosecha_lote_atomic(
	p_finca_id integer,
	p_usuario_id integer,
	p_fecha date,
	p_detalles jsonb
)
RETURNS SETOF registro_cosecha
LANGUAGE plpgsql
AS $$
DECLARE
	v_total_detalles integer;
	v_lock_row record;
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

	IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' THEN
		RAISE EXCEPTION 'detalles debe ser un arreglo JSON';
	END IF;

	WITH raw_rows AS (
		SELECT
			ord::int AS orden,
			(elem ->> 'calendario_id')::int AS calendario_id,
			GREATEST(COALESCE((elem ->> 'cantidad_racimos')::int, 0), 0) AS cantidad_racimos,
			GREATEST(COALESCE((elem ->> 'cantidad_rechazo')::int, 0), 0) AS cantidad_rechazo
		FROM jsonb_array_elements(p_detalles) WITH ORDINALITY AS t(elem, ord)
	),
	valid_rows AS (
		SELECT
			orden,
			calendario_id,
			cantidad_racimos,
			cantidad_rechazo
		FROM raw_rows
		WHERE calendario_id IS NOT NULL
		  AND calendario_id > 0
		  AND (cantidad_racimos + cantidad_rechazo) > 0
	)
	SELECT COUNT(*)::int
	INTO v_total_detalles
	FROM valid_rows;

	IF v_total_detalles <= 0 THEN
		RAISE EXCEPTION 'No hay cantidades validas para registrar';
	END IF;

	FOR v_lock_row IN
		WITH raw_rows AS (
			SELECT
				(elem ->> 'calendario_id')::int AS calendario_id,
				GREATEST(COALESCE((elem ->> 'cantidad_racimos')::int, 0), 0) AS cantidad_racimos,
				GREATEST(COALESCE((elem ->> 'cantidad_rechazo')::int, 0), 0) AS cantidad_rechazo
			FROM jsonb_array_elements(p_detalles) AS t(elem)
		),
		valid_rows AS (
			SELECT
				calendario_id,
				cantidad_racimos,
				cantidad_rechazo
			FROM raw_rows
			WHERE calendario_id IS NOT NULL
			  AND calendario_id > 0
			  AND (cantidad_racimos + cantidad_rechazo) > 0
		),
		group_totals AS (
			SELECT
				calendario_id,
				SUM(cantidad_racimos + cantidad_rechazo)::int AS total_solicitado
			FROM valid_rows
			GROUP BY calendario_id
		)
		SELECT
			gt.calendario_id,
			gt.total_solicitado,
			vbc.saldo_en_campo::int AS saldo_disponible
		FROM group_totals gt
		LEFT JOIN vw_balance_campo vbc
			ON vbc.finca_id = p_finca_id
			AND vbc.calendario_id = gt.calendario_id
		ORDER BY gt.calendario_id
	LOOP
		PERFORM pg_advisory_xact_lock(p_finca_id, v_lock_row.calendario_id);

		IF v_lock_row.saldo_disponible IS NULL THEN
			RAISE EXCEPTION
				'Calendario % no pertenece a la finca o no tiene saldo',
				v_lock_row.calendario_id;
		END IF;

		IF v_lock_row.total_solicitado > v_lock_row.saldo_disponible THEN
			RAISE EXCEPTION
				'Saldo excedido en calendario %. Disponible: %, solicitado: %',
				v_lock_row.calendario_id,
				v_lock_row.saldo_disponible,
				v_lock_row.total_solicitado;
		END IF;
	END LOOP;

	RETURN QUERY
	WITH raw_rows AS (
		SELECT
			ord::int AS orden,
			(elem ->> 'calendario_id')::int AS calendario_id,
			GREATEST(COALESCE((elem ->> 'cantidad_racimos')::int, 0), 0) AS cantidad_racimos,
			GREATEST(COALESCE((elem ->> 'cantidad_rechazo')::int, 0), 0) AS cantidad_rechazo
		FROM jsonb_array_elements(p_detalles) WITH ORDINALITY AS t(elem, ord)
	),
	valid_rows AS (
		SELECT
			orden,
			calendario_id,
			cantidad_racimos,
			cantidad_rechazo
		FROM raw_rows
		WHERE calendario_id IS NOT NULL
		  AND calendario_id > 0
		  AND (cantidad_racimos + cantidad_rechazo) > 0
	),
	ins AS (
		INSERT INTO registro_cosecha (
			finca_id,
			calendario_id,
			cantidad_racimos,
			cantidad_rechazo,
			fecha,
			usuario_id
		)
		SELECT
			p_finca_id,
			v.calendario_id,
			v.cantidad_racimos,
			v.cantidad_rechazo,
			p_fecha,
			p_usuario_id
		FROM valid_rows v
		ORDER BY v.orden
		RETURNING *
	)
	SELECT *
	FROM ins;
END;
$$;
