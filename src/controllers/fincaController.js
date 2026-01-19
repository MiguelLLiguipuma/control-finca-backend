import { FincaService } from '../services/fincaService.js';

export const FincaController = {
	async list(_req, res) {
		try {
			res.json(await FincaService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async get(req, res) {
		try {
			const item = await FincaService.getById(req.params.id);
			if (!item) return res.status(404).json({ error: 'Finca no encontrada' });
			res.json(item);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async create(req, res) {
		try {
			res.status(201).json(await FincaService.create(req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async update(req, res) {
		try {
			res.json(await FincaService.update(req.params.id, req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async remove(req, res) {
		try {
			res.json(await FincaService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
};
