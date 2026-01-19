import { UsuarioService } from '../services/usuarioService.js';

export const UsuarioController = {
	async list(_req, res) {
		try {
			res.json(await UsuarioService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async get(req, res) {
		try {
			const item = await UsuarioService.getById(req.params.id);
			if (!item)
				return res.status(404).json({ error: 'Usuario no encontrado' });
			res.json(item);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async create(req, res) {
		try {
			res.status(201).json(await UsuarioService.create(req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async update(req, res) {
		try {
			res.json(await UsuarioService.update(req.params.id, req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async remove(req, res) {
		try {
			res.json(await UsuarioService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
};
