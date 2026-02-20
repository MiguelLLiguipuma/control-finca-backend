import { pool } from '../db/db.js';
import { CalendarioModel } from '../models/calendarioModel.js';
import { CintaModel } from '../models/cintaModel.js';
import { EmpresaModel } from '../models/empresaModel.js';

function calcularSemanasISO(year) {
	const p =
		(y) =>
			(y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)) % 7;
	return p(year) === 4 || p(year - 1) === 3 ? 53 : 52;
}

function normalizarEstado(estado) {
	if (!estado) return 'A';
	if (estado === 'A' || estado === 'activo') return 'A';
	if (estado === 'I' || estado === 'inactivo') return 'I';
	return estado;
}

export const CalendarioService = {
	getAll: async () => (await CalendarioModel.findAll()).rows,

	getById: async (id) => {
		const res = await CalendarioModel.findById(id);
		if (!res.rows.length) throw new Error('Calendario no encontrado');
		return res.rows[0];
	},

	create: async (payload) => {
		if (payload.detalles && Array.isArray(payload.detalles)) {
			const empresa_id = Number(payload.empresa_id);
			const anio = Number(payload.anio);
			const detalles = payload.detalles;

			if (!empresa_id || !anio) {
				throw new Error('Faltan datos (empresa_id o anio)');
			}

			if (!detalles.length) {
				throw new Error('El calendario debe contener al menos una semana');
			}

			const emp = await EmpresaModel.findById(empresa_id);
			if (!emp.rows.length) throw new Error('La empresa no existe');

			const semanasEsperadas = calcularSemanasISO(anio);
			const semanas = detalles.map((d) => Number(d.semana));
			const semanasUnicas = new Set(semanas);

			if (semanasUnicas.size !== semanas.length) {
				throw new Error('Hay semanas duplicadas en el calendario');
			}

			if (semanas.some((s) => !Number.isInteger(s) || s < 1 || s > semanasEsperadas)) {
				throw new Error(`Hay semanas fuera de rango para ${anio} (1-${semanasEsperadas})`);
			}

			if (semanasUnicas.size !== semanasEsperadas) {
				throw new Error(`El calendario debe incluir exactamente ${semanasEsperadas} semanas`);
			}

			const colorIds = [...new Set(detalles.map((d) => Number(d.color_id)))];
			for (const colorId of colorIds) {
				if (!colorId) throw new Error('Hay colores inválidos en el detalle');
				const cinta = await CintaModel.findById(colorId);
				if (!cinta.rows.length) throw new Error(`Color de cinta no existe: ${colorId}`);
			}

			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				await client.query(
					'DELETE FROM calendarios_enfunde WHERE anio = $1 AND empresa_id = $2',
					[anio, empresa_id],
				);

				const resultados = [];
				for (const item of detalles) {
					const estado = normalizarEstado(item.estado);
					const created = await client.query(
						`INSERT INTO calendarios_enfunde (semana, anio, color_id, empresa_id, estado)
						 VALUES ($1, $2, $3, $4, $5)
						 RETURNING *`,
						[
							Number(item.semana),
							anio,
							Number(item.color_id),
							empresa_id,
							estado,
						],
					);
					resultados.push(created.rows[0]);
				}

				await client.query('COMMIT');
				return {
					message: 'Calendario anual creado correctamente',
					total: resultados.length,
				};
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			} finally {
				client.release();
			}
		}

		const { semana, anio, color_id, empresa_id, estado = 'A' } = payload;

		if (!semana || !anio || !color_id || !empresa_id) {
			throw new Error('Datos incompletos para registro individual');
		}

		const cinta = await CintaModel.findById(color_id);
		if (!cinta.rows.length) throw new Error('Color (Cinta) no existe');

		const emp = await EmpresaModel.findById(empresa_id);
		if (!emp.rows.length) throw new Error('Empresa no existe');

		const dup = await CalendarioModel.findBySemanaAnioEmpresa(
			semana,
			anio,
			empresa_id,
		);
		if (dup.rows.length) throw new Error('Ya existe esa semana para esta empresa');

		return (
			await CalendarioModel.create({
				semana,
				anio,
				color_id,
				empresa_id,
				estado: normalizarEstado(estado),
			})
		).rows[0];
	},

	update: async (id, payload) => {
		const cur = await CalendarioModel.findById(id);
		if (!cur.rows.length) throw new Error('Calendario no encontrado');
		if (payload.estado) {
			payload.estado = normalizarEstado(payload.estado);
		}
		return (await CalendarioModel.update(id, payload)).rows[0];
	},

	remove: async (id) => {
		await CalendarioModel.remove(id);
		return { ok: true };
	},

	getResumenAnual: async () => {
		const res = await CalendarioModel.getResumen();
		return res.rows;
	},
};
