import { CosechaService } from '../../services/cosecha/cosechaService.js';

export const registrarCosecha = async (req, res) => {
	try {
		const data = await CosechaService.procesarLiquidacion(req.body);
		res.status(201).json({ success: true, data });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};

export const getBalanceCampo = async (req, res) => {
	try {
		const { fincaId } = req.params;
		console.log('Consultando balance para finca:', fincaId);

		const data = await CosechaService.obtenerEstadoInventario(fincaId);
		res.json(data);
	} catch (error) {
		// ESTO es lo que necesitamos ver:
		console.error('DETALLE DEL ERROR:', error.message);
		res.status(500).json({
			error: 'Error en el servidor',
			detalle: error.message, // Esto nos dirá si falta la tabla, la vista o si el pool falló
			hint: 'Verifica que la vista vw_balance_campo exista en la DB',
		});
	}
};
