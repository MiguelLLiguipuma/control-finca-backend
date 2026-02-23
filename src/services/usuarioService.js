import { UsuarioModel } from '../models/usuarioModel.js';
import { query } from '../db/db.js';
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

async function resolverRolId(payload) {
	const rolIdPayload = Number(payload?.rol_id || 0);
	if (rolIdPayload > 0) return rolIdPayload;

	const rolNombre = String(payload?.rol || '').trim();
	if (rolNombre) {
		const rolByName = await UsuarioModel.findRolByNombre(rolNombre);
		if (!rolByName.rows.length) throw new Error('Rol no existe');
		return Number(rolByName.rows[0].id);
	}

	const rolDefault = await UsuarioModel.findRolDefault();
	if (!rolDefault.rows.length) {
		throw new Error('No existe rol por defecto para asignar al usuario');
	}
	return Number(rolDefault.rows[0].id);
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
		const creado = (await UsuarioModel.create(data)).rows[0];
		const rolId = await resolverRolId(payload);
		await UsuarioModel.replaceUsuarioRol(creado.id, rolId);
		return await UsuarioService.getById(creado.id);
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

		let passwordChanged = false;
		if (typeof payload?.password === 'string' && payload.password.trim()) {
			if (!isPasswordHash(payload.password)) {
				validarPassword(payload.password);
				data.password = hashPassword(payload.password);
				passwordChanged = true;
			}
		}

		await UsuarioModel.update(id, data);

		if (passwordChanged) {
			await query(
				'UPDATE usuarios SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1',
				[id],
			);
		}
		if (payload?.rol_id || payload?.rol) {
			const rolId = await resolverRolId(payload);
			await UsuarioModel.replaceUsuarioRol(Number(id), rolId);
		}

		return await UsuarioService.getById(id);
	},
	remove: async (id) => {
		await UsuarioModel.remove(id);
		return { ok: true };
	},
};
