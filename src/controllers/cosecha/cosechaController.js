import { CosechaService } from '../../services/cosecha/cosechaService.js';

export const registrarCosecha = async (req, res) => {
	try {
		const data = await CosechaService.procesarLiquidacion(req.body, {
			usuarioIdSesion: req.user?.id,
			rolUsuario: req.user?.rol,
		});
		if (data.duplicated) {
			return res.status(200).json({
				success: true,
				duplicated: true,
				message: 'Liquidación ya procesada previamente',
				data,
			});
		}

		res.status(201).json({ success: true, data });
	} catch (error) {
		const status = Number(error?.status) || 500;
		if (status >= 500) {
			console.error('Error registrarCosecha:', error);
		}
		res.status(status).json({
			success: false,
			error: error.message || 'Error interno del servidor',
		});
	}
};

export const getBalanceCampo = async (req, res) => {
	try {
		const { fincaId } = req.params;
		const data = await CosechaService.obtenerEstadoInventario(fincaId, {
			usuarioIdSesion: req.user?.id,
			rolUsuario: req.user?.rol,
		});
		res.json(data);
	} catch (error) {
		const status = Number(error?.status) || 500;
		if (status >= 500) {
			console.error('DETALLE DEL ERROR:', error.message);
		}
		res.status(status).json({
			error: error?.message || 'Error en el servidor',
		});
	}
};

export const getFechasOcupadas = async (req, res) => {
	try {
		const data = await CosechaService.obtenerFechasOcupadas(req.query || {}, {
			usuarioIdSesion: req.user?.id,
			rolUsuario: req.user?.rol,
		});
		res.json({ success: true, data });
	} catch (error) {
		const status = Number(error?.status) || 500;
		if (status >= 500) {
			console.error('Error getFechasOcupadas:', error);
		}
		res.status(status).json({
			success: false,
			error: error?.message || 'Error interno del servidor',
		});
	}
};

export const getInventarioHistorico = async (req, res) => {
	try {
		const data = await CosechaService.obtenerInventarioHistorico(req.query || {}, {
			usuarioIdSesion: req.user?.id,
			rolUsuario: req.user?.rol,
		});
		res.json({ success: true, data });
	} catch (error) {
		const status = Number(error?.status) || 500;
		if (status >= 500) {
			console.error('Error getInventarioHistorico:', error);
		}
		res.status(status).json({
			success: false,
			error: error?.message || 'Error interno del servidor',
		});
	}
};

export const cerrarInventarioHistorico = async (req, res) => {
	try {
		const data = await CosechaService.cerrarInventarioHistorico(req.body || {}, {
			usuarioIdSesion: req.user?.id,
			rolUsuario: req.user?.rol,
		});
		res.status(201).json({ success: true, data });
	} catch (error) {
		const status = Number(error?.status) || 500;
		if (status >= 500) {
			console.error('Error cerrarInventarioHistorico:', error);
		}
		res.status(status).json({
			success: false,
			error: error?.message || 'Error interno del servidor',
		});
	}
};
