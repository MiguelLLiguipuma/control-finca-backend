import { CalendarioService } from '../services/calendarioService.js';

export const CalendarioController = {
	async list(req, res) {
		try {
			res.json(await CalendarioService.getAll());
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},

	async get(req, res) {
		try {
			const item = await CalendarioService.getById(req.params.id);
			res.json(item);
		} catch (e) {
			res.status(404).json({ error: e.message });
		}
	},

	async create(req, res) {
		try {
			/* CORRECCIÓN: 
         Antes filtrábamos campos específicos y perdíamos 'detalles'.
         Ahora pasamos todo el body para que el Servicio reciba el array.
      */
			const payload = {
				...req.body,
				// Normalizamos por si el frontend manda 'año' o 'anio'
				anio: req.body.anio || req.body.año,
			};

			const result = await CalendarioService.create(payload);
			res.status(201).json(result);
		} catch (e) {
			console.error('Error en Controller Create:', e.message);
			res.status(400).json({ error: e.message });
		}
	},

	async update(req, res) {
		try {
			const result = await CalendarioService.update(req.params.id, req.body);
			res.json(result);
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},

	async remove(req, res) {
		try {
			res.json(await CalendarioService.remove(req.params.id));
		} catch (e) {
			res.status(400).json({ error: e.message });
		}
	},
	// ... dentro del objeto CalendarioController
	async getResumen(req, res) {
		try {
			const data = await CalendarioService.getResumenAnual();
			res.json(data);
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
};
