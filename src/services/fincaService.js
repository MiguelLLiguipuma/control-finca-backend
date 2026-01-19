import { FincaModel } from '../models/fincaModel.js';
import { EmpresaModel } from '../models/empresaModel.js';

export const FincaService = {
	getAll: async () => (await FincaModel.findAll()).rows,
	getById: async (id) => (await FincaModel.findById(id)).rows[0],
	create: async (payload) => {
		const { nombre, empresa_id } = payload;
		if (!nombre) throw new Error('nombre es requerido');
		if (empresa_id) {
			const emp = await EmpresaModel.findById(empresa_id);
			if (!emp.rows.length) throw new Error('empresa_id no existe');
		}
		return (await FincaModel.create(payload)).rows[0];
	},
	update: async (id, payload) => {
		const cur = await FincaModel.findById(id);
		if (!cur.rows.length) throw new Error('Finca no encontrada');
		if (payload.empresa_id) {
			const emp = await EmpresaModel.findById(payload.empresa_id);
			if (!emp.rows.length) throw new Error('empresa_id no existe');
		}
		return (await FincaModel.update(id, payload)).rows[0];
	},
	remove: async (id) => {
		await FincaModel.remove(id);
		return { ok: true };
	},
};
