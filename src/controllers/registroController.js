import { RegistroService } from '../services/registroService.js';

export const RegistroController = {
	async list(req, res) {
		try {
			res.json(
				await RegistroService.getAll({
					userId: req.user?.id,
					rol: req.user?.rol,
				}),
			);
		} catch (e) {
			res.status(Number(e?.status) || 500).json({ error: e.message });
		}
	},

	async get(req, res) {
		try {
			const item = await RegistroService.getById(req.params.id, {
				userId: req.user?.id,
				rol: req.user?.rol,
			});
			if (!item)
				return res.status(404).json({ error: 'Registro no encontrado' });
			res.json(item);
		} catch (e) {
			res.status(Number(e?.status) || 500).json({ error: e.message });
		}
	},

	async create(req, res) {
		try {
			const payload = {
				...req.body,
				usuario_id: Number(req.user?.id || 0),
			};
			res.status(201).json(
				await RegistroService.create(payload, {
					userId: req.user?.id,
					rol: req.user?.rol,
				}),
			);
		} catch (e) {
			res.status(Number(e?.status) || 400).json({ error: e.message });
		}
	},

	async update(req, res) {
		try {
			const payload = {
				...req.body,
				usuario_id: Number(req.user?.id || 0),
			};
			res.json(
				await RegistroService.update(req.params.id, payload, {
					userId: req.user?.id,
					rol: req.user?.rol,
				}),
			);
		} catch (e) {
			res.status(Number(e?.status) || 400).json({ error: e.message });
		}
	},

	async remove(req, res) {
		try {
			res.json(
				await RegistroService.remove(req.params.id, {
					userId: req.user?.id,
					rol: req.user?.rol,
				}),
			);
		} catch (e) {
			res.status(Number(e?.status) || 400).json({ error: e.message });
		}
	},

	async getByFinca(req, res) {
		try {
			const { fincaId, anio } = req.params;
			// Llamamos al servicio pasando ambos parámetros
			const data = await RegistroService.getByFinca(fincaId, anio, {
				userId: req.user?.id,
				rol: req.user?.rol,
			});
			res.json(data);
		} catch (e) {
			res.status(Number(e?.status) || 500).json({ error: e.message });
		}
	},
};
