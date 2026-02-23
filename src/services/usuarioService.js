import { UsuarioModel } from '../models/usuarioModel.js';
import { hashPassword, isPasswordHash } from '../utils/password.js';

function normalizarEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function validarPassword(password) {
	const p = String(password || '');
	if (p.length < 8) {
		throw new Error('La contraseña debe tener al menos 8 caracteres');
	}
}

export const UsuarioService = {
	getAll: async () => (await UsuarioModel.findAll()).rows,
	getById: async (id) => (await UsuarioModel.findById(id)).rows[0],
	create: async (payload) => {
		const nombre = String(payload?.nombre || '').trim();
		const email = normalizarEmail(payload?.email);
		const rawPassword = payload?.password;
		if (!nombre || !email || !rawPassword)
			throw new Error('nombre, email y password son requeridos');
		validarPassword(rawPassword);

		const dup = await UsuarioModel.findByEmail(email);
		if (dup.rows.length) throw new Error('Email en uso');

		const data = {
			...payload,
			nombre,
			email,
			password: hashPassword(rawPassword),
		};
		return (await UsuarioModel.create(data)).rows[0];
	},
	update: async (id, payload) => {
		const cur = await UsuarioModel.findById(id);
		if (!cur.rows.length) throw new Error('Usuario no encontrado');

		const data = { ...payload };
		if (payload.email) {
			data.email = normalizarEmail(payload.email);
			const dup = await UsuarioModel.findByEmail(data.email);
			if (dup.rows.length && dup.rows[0].id !== Number(id))
				throw new Error('Email en uso');
		}
		if (typeof payload?.nombre === 'string') {
			data.nombre = payload.nombre.trim();
		}
		if (typeof payload?.password === 'string' && payload.password.trim()) {
			if (!isPasswordHash(payload.password)) {
				validarPassword(payload.password);
				data.password = hashPassword(payload.password);
			}
		}
		return (await UsuarioModel.update(id, data)).rows[0];
	},
	remove: async (id) => {
		await UsuarioModel.remove(id);
		return { ok: true };
	},
};
