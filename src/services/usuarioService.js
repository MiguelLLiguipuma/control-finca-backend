import { UsuarioModel } from '../models/usuarioModel.js';

export const UsuarioService = {
	getAll: async () => (await UsuarioModel.findAll()).rows,
	getById: async (id) => (await UsuarioModel.findById(id)).rows[0],
	create: async (payload) => {
		const { nombre, email, password } = payload;
		if (!nombre || !email || !password)
			throw new Error('nombre, email y password son requeridos');
		const dup = await UsuarioModel.findByEmail(email);
		if (dup.rows.length) throw new Error('Email en uso');
		return (await UsuarioModel.create(payload)).rows[0];
	},
	update: async (id, payload) => {
		const cur = await UsuarioModel.findById(id);
		if (!cur.rows.length) throw new Error('Usuario no encontrado');
		if (payload.email) {
			const dup = await UsuarioModel.findByEmail(payload.email);
			if (dup.rows.length && dup.rows[0].id !== Number(id))
				throw new Error('Email en uso');
		}
		return (await UsuarioModel.update(id, payload)).rows[0];
	},
	remove: async (id) => {
		await UsuarioModel.remove(id);
		return { ok: true };
	},
};
