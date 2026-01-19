import { CalendarioModel } from '../models/calendarioModel.js';
import { CintaModel } from '../models/cintaModel.js';
import { EmpresaModel } from '../models/empresaModel.js';

export const CalendarioService = {
	getAll: async () => (await CalendarioModel.findAll()).rows,

	getById: async (id) => {
		const res = await CalendarioModel.findById(id);
		if (!res.rows.length) throw new Error('Calendario no encontrado');
		return res.rows[0];
	},

	/* =================================================
     CREAR (SOPORTA MASIVO E INDIVIDUAL)
  ================================================= */
	create: async (payload) => {
		// --- MODO MASIVO (Desde Vue: GestionCalendario) ---
		if (payload.detalles && Array.isArray(payload.detalles)) {
			const { empresa_id, anio, detalles } = payload;

			if (!empresa_id || !anio)
				throw new Error('Faltan datos (empresa_id o anio)');

			// 1. Verificar Empresa
			const emp = await EmpresaModel.findById(empresa_id);
			if (!emp.rows.length) throw new Error('La empresa no existe');

			// 2. Limpiar datos previos de ese año (Opcional, pero recomendado para evitar crash)
			await CalendarioModel.deleteByAnioEmpresa(anio, empresa_id);

			// 3. Insertar las 52 semanas
			const resultados = [];
			for (const item of detalles) {
				// item: { semana: 1, color_id: 5, estado: 'A' }
				const nuevo = await CalendarioModel.create({
					semana: item.semana,
					anio: anio,
					color_id: item.color_id,
					empresa_id: empresa_id,
					estado: item.estado || 'A',
				});
				resultados.push(nuevo.rows[0]);
			}

			return {
				message: 'Calendario anual creado correctamente',
				total: resultados.length,
			};
		}

		// --- MODO INDIVIDUAL (Legacy o API directa) ---
		const { semana, anio, color_id, empresa_id, estado = 'A' } = payload;

		if (!semana || !anio || !color_id || !empresa_id) {
			throw new Error('Datos incompletos para registro individual');
		}

		// Validaciones
		const cinta = await CintaModel.findById(color_id);
		if (!cinta.rows.length) throw new Error('Color (Cinta) no existe');

		const emp = await EmpresaModel.findById(empresa_id);
		if (!emp.rows.length) throw new Error('Empresa no existe');

		// Validar duplicado exacto
		const dup = await CalendarioModel.findBySemanaAnioEmpresa(
			semana,
			anio,
			empresa_id,
		);
		if (dup.rows.length)
			throw new Error('Ya existe esa semana para esta empresa');

		return (
			await CalendarioModel.create({
				semana,
				anio,
				color_id,
				empresa_id,
				estado,
			})
		).rows[0];
	},

	update: async (id, payload) => {
		// Validaciones básicas antes de update
		const cur = await CalendarioModel.findById(id);
		if (!cur.rows.length) throw new Error('Calendario no encontrado');
		return (await CalendarioModel.update(id, payload)).rows[0];
	},

	remove: async (id) => {
		await CalendarioModel.remove(id);
		return { ok: true };
	},
	// ... dentro del objeto CalendarioService
	getResumenAnual: async () => {
		const res = await CalendarioModel.getResumen();
		return res.rows;
	},
};
