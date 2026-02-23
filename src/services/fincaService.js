import { FincaModel } from '../models/fincaModel.js';
import { EmpresaModel } from '../models/empresaModel.js';

function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	return raw;
}

export const FincaService = {
	getAll: async (ctx = {}) => {
		const role = normalizeRole(ctx?.rol);
		const userId = Number(ctx?.userId || 0);
		if (role === 'OPERADOR' && userId > 0) {
			return (await FincaModel.findByUsuarioId(userId)).rows;
		}
		return (await FincaModel.findAll()).rows;
	},
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
