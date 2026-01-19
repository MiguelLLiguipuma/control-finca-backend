import { RolModel } from '../models/rolModel.js';

export const RolService = {
	getAll: async () => (await RolModel.findAll()).rows,
	getById: async (id) => (await RolModel.findById(id)).rows[0],
	create: async ({ nombre }) => {
		if (!nombre) throw new Error('nombre es requerido');
		const exists = await RolModel.findByName(nombre);
		if (exists.rows.length) throw new Error('Rol ya existe');
		return (await RolModel.create(nombre)).rows[0];
	},
	update: async (id, { nombre }) => {
		const cur = await RolModel.findById(id);
		if (!cur.rows.length) throw new Error('Rol no encontrado');
		if (nombre) {
			const dup = await RolModel.findByName(nombre);
			if (dup.rows.length && dup.rows[0].id !== Number(id)) {
				throw new Error('Nombre de rol en uso');
			}
		}
		return (await RolModel.update(id, nombre)).rows[0];
	},
	remove: async (id) => {
		await RolModel.remove(id);
		return { ok: true };
	},
};
