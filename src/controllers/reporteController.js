import { ReportesService } from '../services/reportesService.js';

export const ReportesController = {
	async totalAnual(req, res) {
		try {
			// ✅ CORREGIDO: Ahora extrae fincaId y anio
			const { fincaId, anio } = req.params;
			const data = await ReportesService.getTotalAnualPorAño(fincaId, anio);
			res.json(data);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	},

	async totalMensual(req, res) {
		try {
			// ✅ CORREGIDO: Ahora extrae fincaId y anio
			const { fincaId, anio } = req.params;
			res.json(await ReportesService.getTotalMensual(fincaId, anio));
		} catch (err) {
			res.status(400).json({ error: err.message });
		}
	},

	async rendimientoCintas(req, res) {
		try {
			// ✅ Mantenemos la corrección que ya tenías
			const { fincaId, anio } = req.params;
			const data = await ReportesService.getRendimientoCintas(fincaId, anio);
			res.json(data);
		} catch (err) {
			res.status(400).json({ error: err.message });
		}
	},

	async mejorSemana(req, res) {
		try {
			// ✅ CORREGIDO: Ahora extrae fincaId y anio
			const { fincaId, anio } = req.params;
			const data = await ReportesService.getMejorSemanaPorAño(fincaId, anio);
			res.json(data);
		} catch (err) {
			console.error('❌ Error mejorSemana:', err);
			res.status(500).json({ error: err.message });
		}
	},

	async bajasProduccion(req, res) {
		try {
			// ✅ CORREGIDO: Añadido parámetro de finca para filtrar bajas específicas
			const { fincaId } = req.params;
			res.json(await ReportesService.getBajasProduccion(fincaId));
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	},

	async comparativoAnual(req, res) {
		try {
			// ✅ CORREGIDO: Las gráficas comparativas ahora son por finca
			const { fincaId } = req.params;
			res.json(await ReportesService.getComparativoAnual(fincaId));
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	},

	/* ================================
     ✅ PROMEDIO SEMANAL POR FINCA
  ================================ */
	async promedioSemanalPorFinca(req, res) {
		try {
			const { fincaId, anio } = req.params;
			res.json(await ReportesService.getPromedioSemanalPorFinca(fincaId, anio));
		} catch (err) {
			res.status(400).json({ error: err.message });
		}
	},
	/* ================================
     ✅ TENDENCIA SEMANAL (GRÁFICO)
  ================================ */
	async totalSemanal(req, res) {
		try {
			const { fincaId, anio } = req.params;
			// Llamamos al service que a su vez llamará al model con la vista vw_total_semanal
			const data = await ReportesService.getTotalSemanal(fincaId, anio);
			res.json(data);
		} catch (err) {
			console.error('❌ Error totalSemanal:', err);
			res.status(400).json({ error: err.message });
		}
	},
};
