import { RegistroService } from '../services/registroService.js';

export const RegistroController = {
	async list(_req, res) {
		try {
			res.json(await RegistroService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},

	async get(req, res) {
		try {
			const item = await RegistroService.getById(req.params.id);
			if (!item)
				return res.status(404).json({ error: 'Registro no encontrado' });
			res.json(item);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},

	async create(req, res) {
		try {
			// Pasamos el body al servicio.
			// Nota: El RegistroService debe usar el calendario_id para vincular al año correcto.
			res.status(201).json(await RegistroService.create(req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},

	async update(req, res) {
		try {
			res.json(await RegistroService.update(req.params.id, req.body));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},

	async remove(req, res) {
		try {
			res.json(await RegistroService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},

	async getByFinca(req, res) {
		try {
			const { fincaId, anio } = req.params;
			// Llamamos al servicio pasando ambos parámetros
			const data = await RegistroService.getByFinca(fincaId, anio);
			res.json(data);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
};
