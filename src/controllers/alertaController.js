import { AlertaService } from '../services/alertaService.js';
import { logger } from '../utils/logger.js';

function manejarError(res, req, error, fallback = 'Error en alertas operativas') {
	const status = Number(error?.status) || 500;
	if (status >= 500) {
		logger.error('alertas_controller_error', {
			request_id: req.requestId || null,
			error: error?.message || 'unknown',
		});
	}
	return res.status(status).json({
		success: false,
		message: error?.message || fallback,
	});
}

export const AlertaController = {
	async listar(req, res) {
		try {
			const data = await AlertaService.listar({
				user: req.user,
				query: req.query,
			});
			return res.json({ success: true, data });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible listar alertas');
		}
	},

	async resumen(req, res) {
		try {
			const data = await AlertaService.resumen({
				user: req.user,
				query: req.query,
			});
			return res.json({ success: true, data });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible resumir alertas');
		}
	},

	async listarContactos(req, res) {
		try {
			const data = await AlertaService.listarContactos({
				user: req.user,
			});
			return res.json({ success: true, data });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible listar contactos de alerta');
		}
	},

	async guardarContacto(req, res) {
		try {
			const data = await AlertaService.guardarContacto({
				user: req.user,
				usuarioId: req.params.usuarioId,
				body: req.body,
			});
			return res.json({ success: true, data });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible guardar el contacto de alerta');
		}
	},

	async generar(req, res) {
		try {
			const data = await AlertaService.generar({
				user: req.user,
				body: req.body,
				query: req.query,
			});
			return res.status(201).json({ success: true, data });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible generar alertas');
		}
	},

	async marcarLeida(req, res) {
		try {
			const ok = await AlertaService.marcarLeida({
				user: req.user,
				alertaId: req.params.id,
			});
			return res.json({ success: true, data: { updated: ok } });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible marcar la alerta');
		}
	},

	async resolver(req, res) {
		try {
			const alerta = await AlertaService.resolver({
				user: req.user,
				alertaId: req.params.id,
			});
			if (!alerta) {
				return res.status(404).json({
					success: false,
					message: 'Alerta no encontrada',
				});
			}
			return res.json({ success: true, data: alerta });
		} catch (error) {
			return manejarError(res, req, error, 'No fue posible resolver la alerta');
		}
	},
};
