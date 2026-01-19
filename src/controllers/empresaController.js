import { EmpresaService } from '../services/empresaService.js';

export const EmpresaController = {
	async list(_req, res) {
		try {
			res.json(await EmpresaService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async get(req, res) {
		try {
			const item = await EmpresaService.getById(req.params.id);
			if (!item)
				return res.status(404).json({ error: 'Empresa no encontrada' });
			res.json(item);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
	async create(req, res) {
		try {
			res.status(201).json(await EmpresaService.create(req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async update(req, res) {
		try {
			res.json(await EmpresaService.update(req.params.id, req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	async remove(req, res) {
		try {
			res.json(await EmpresaService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
};
