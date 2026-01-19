import { CintaModel } from '../models/cintaModel.js';

export const CintaService = {
	getAll: async () => (await CintaModel.findAll()).rows,
	getById: async (id) => (await CintaModel.findById(id)).rows[0],
	create: async (payload) => {
		const { color } = payload;
		if (!color) throw new Error('color es requerido');
		const dup = await CintaModel.findByColor(color);
		if (dup.rows.length) throw new Error('La cinta ya existe');
		return (await CintaModel.create(payload)).rows[0];
	},
	update: async (id, payload) => {
		const cur = await CintaModel.findById(id);
		if (!cur.rows.length) throw new Error('Cinta no encontrada');
		if (payload.color) {
			const dup = await CintaModel.findByColor(payload.color);
			if (dup.rows.length && dup.rows[0].id !== Number(id))
				throw new Error('Color en uso');
		}
		return (await CintaModel.update(id, payload)).rows[0];
	},
	remove: async (id) => {
		await CintaModel.remove(id);
		return { ok: true };
	},
};
