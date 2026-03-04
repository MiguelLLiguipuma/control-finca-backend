import { EmpresaModel } from '../models/empresaModel.js';
import {
	resolveEmpresaScope,
	assertEmpresaInScope,
} from '../utils/accessScope.js';

export const EmpresaService = {
	getAll: async (ctx = {}) => {
		const scope = await resolveEmpresaScope({
			rol: ctx?.rol,
			userId: Number(ctx?.userId || 0),
		});
		if (!scope.enforce) return (await EmpresaModel.findAll()).rows;
		if (!scope.allowedEmpresaIds.length) return [];
		return (await EmpresaModel.findAllByIds(scope.allowedEmpresaIds)).rows;
	},
	getById: async (id, ctx = {}) => {
		const scope = await resolveEmpresaScope({
			rol: ctx?.rol,
			userId: Number(ctx?.userId || 0),
		});
		assertEmpresaInScope(id, scope);
		return (
			scope.enforce
				? await EmpresaModel.findByIdScoped(id, scope.allowedEmpresaIds)
				: await EmpresaModel.findById(id)
		).rows[0];
	},
	create: async (payload) => {
		const { nombre } = payload;
		if (!nombre) throw new Error('nombre es requerido');
		const dup = await EmpresaModel.findByNombre(nombre);
		if (dup.rows.length) throw new Error('Empresa ya existe');
		return (await EmpresaModel.create(payload)).rows[0];
	},
	update: async (id, payload) => {
		const cur = await EmpresaModel.findById(id);
		if (!cur.rows.length) throw new Error('Empresa no encontrada');
		if (payload.nombre) {
			const dup = await EmpresaModel.findByNombre(payload.nombre);
			if (dup.rows.length && dup.rows[0].id !== Number(id))
				throw new Error('Nombre en uso');
		}
		return (await EmpresaModel.update(id, payload)).rows[0];
	},
	remove: async (id) => {
		await EmpresaModel.remove(id);
		return { ok: true };
	},
};
