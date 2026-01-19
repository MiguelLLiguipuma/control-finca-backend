import { RolService } from '../services/rolService.js';

export const RolController = {
	async list(_req, res) {
		try {
			res.json(await RolService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async get(req, res) {
		try {
			const item = await RolService.getById(req.params.id);
			if (!item) return res.status(404).json({ error: 'No encontrado' });
			res.json(item);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async create(req, res) {
		try {
			res.status(201).json(await RolService.create(req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async update(req, res) {
		try {
			res.json(await RolService.update(req.params.id, req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async remove(req, res) {
		try {
			res.json(await RolService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
};
