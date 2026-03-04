import { PrediccionAvanzadaService } from '../../services/cosecha/prediccionAvanzadaService.js';

function manejarError(res, err) {
	const status = Number(err?.status) || 500;
	return res.status(status).json({
		error: err?.message || 'Error en prediccion de cosecha',
	});
}

export const obtenerPrediccionCosecha = async (req, res) => {
	try {
		const result = await PrediccionAvanzadaService.ejecutar({
			fincaId: req.params.finca_id,
			user: req.user,
			query: req.query,
		});
		return res.json(result);
	} catch (error) {
		console.error('ERROR PREDICCION AVANZADA COSECHA:', error?.message || error);
		return manejarError(res, error);
	}
};
