import { RegistroModel } from '../models/registroModel.js';
import { FincaModel } from '../models/fincaModel.js';
import { UsuarioModel } from '../models/usuarioModel.js';
import { CalendarioModel } from '../models/calendarioModel.js';

export const RegistroService = {
	getAll: async () => (await RegistroModel.findAll()).rows,

	getById: async (id) => {
		const res = await RegistroModel.findById(id);
		return res.rows[0];
	},

	create: async (payload) => {
		const { finca_id, usuario_id, calendario_id, cantidad_fundas } = payload;

		// Validación de campos obligatorios
		if (!finca_id || !usuario_id || !calendario_id || cantidad_fundas == null) {
			throw new Error(
				'finca_id, usuario_id, calendario_id y cantidad_fundas son requeridos',
			);
		}

		// Validaciones de existencia en cascada
		const [finca, usuario, cal] = await Promise.all([
			FincaModel.findById(finca_id),
			UsuarioModel.findById(usuario_id),
			CalendarioModel.findById(calendario_id),
		]);

		if (!finca.rows.length) throw new Error('finca_id no existe');
		if (!usuario.rows.length) throw new Error('usuario_id no existe');
		if (!cal.rows.length) throw new Error('calendario_id no existe');

		// Importante: El registro se guarda vinculado al calendario_id.
		// El año (anio) se obtiene mediante JOIN en las consultas de lectura.
		return (await RegistroModel.create(payload)).rows[0];
	},

	update: async (id, payload) => {
		const cur = await RegistroModel.findById(id);
		if (!cur.rows.length) throw new Error('Registro no encontrado');

		// Validaciones opcionales si se están actualizando IDs
		if (payload.finca_id) {
			const f = await FincaModel.findById(payload.finca_id);
			if (!f.rows.length) throw new Error('finca_id no existe');
		}
		if (payload.usuario_id) {
			const u = await UsuarioModel.findById(payload.usuario_id);
			if (!u.rows.length) throw new Error('usuario_id no existe');
		}
		if (payload.calendario_id) {
			const c = await CalendarioModel.findById(payload.calendario_id);
			if (!c.rows.length) throw new Error('calendario_id no existe');
		}

		return (await RegistroModel.update(id, payload)).rows[0];
	},

	remove: async (id) => {
		await RegistroModel.remove(id);
		return { ok: true };
	},
	// Dentro de RegistroService.js
	async getByFinca(fincaId, anio) {
		// Asegúrate de que RegistroModel tenga obtenerPorFinca
		return await RegistroModel.obtenerPorFinca(fincaId, anio);
	},
};
