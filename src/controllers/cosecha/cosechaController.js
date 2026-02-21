import { CosechaService } from '../../services/cosecha/cosechaService.js';

export const registrarCosecha = async (req, res) => {
	try {
		const data = await CosechaService.procesarLiquidacion(req.body, {
			usuarioIdSesion: req.user?.id,
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
		const data = await CosechaService.obtenerEstadoInventario(fincaId);
		res.json(data);
	} catch (error) {
		console.error('DETALLE DEL ERROR:', error.message);
		res.status(500).json({
			error: 'Error en el servidor',
			detalle: error.message,
			hint: 'Verifica que la vista vw_balance_campo exista en la DB',
		});
	}
};

export const getFechasOcupadas = async (req, res) => {
	try {
		const data = await CosechaService.obtenerFechasOcupadas(req.query || {});
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
