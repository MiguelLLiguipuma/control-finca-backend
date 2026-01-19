import { CosechaModel } from '../../models/cosecha/cosechaModel.js';

export const CosechaService = {
	procesarLiquidacion: async (payload) => {
		const { finca_id, fecha, usuario_id, detalles } = payload;
		const resultados = [];

		for (const item of detalles) {
			if (item.cantidad_racimos > 0 || item.cantidad_rechazo > 0) {
				const nuevoRegistro = await CosechaModel.insertarCosecha({
					finca_id,
					fecha,
					usuario_id,
					calendario_id: item.calendario_id,
					cantidad_racimos: item.cantidad_racimos,
					cantidad_rechazo: item.cantidad_rechazo,
				});
				resultados.push(nuevoRegistro);
			}
		}
		return resultados;
	},

	obtenerEstadoInventario: async (fincaId) => {
		return await CosechaModel.obtenerBalancePorFinca(fincaId);
	},
};
