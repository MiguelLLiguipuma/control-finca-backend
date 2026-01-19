import { CintaService } from '../services/cintaService.js';

export const CintaController = {
	async list(_req, res) {
		try {
			res.json(await CintaService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async get(req, res) {
		try {
			const item = await CintaService.getById(req.params.id);
			if (!item) return res.status(404).json({ error: 'Cinta no encontrada' });
			res.json(item);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async create(req, res) {
		try {
			res.status(201).json(await CintaService.create(req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async update(req, res) {
		try {
			res.json(await CintaService.update(req.params.id, req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async remove(req, res) {
		try {
			res.json(await CintaService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
};
