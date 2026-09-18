import { detectarRacimos } from '../../services/cosecha/deteccionRacimosService.js';
import { resolveFincaScope, assertFincaInScope } from '../../utils/accessScope.js';
import { logger } from '../../utils/logger.js';

export async function detectarFotoRacimos(req, res) {
	const cancelacion = new AbortController();
	const cerrar = () => { if (!res.writableEnded) cancelacion.abort(); };
	res.on('close', cerrar);
	res.set('Cache-Control', 'no-store');
	try {
		const fincaId = req.body?.finca_id;
		if (!Number.isSafeInteger(fincaId) || fincaId <= 0) return res.status(400).json({ error: 'Seleccione una finca valida.' });
		const scope = await resolveFincaScope({ rol: req.user?.rol, userId: req.user?.id });
		assertFincaInScope(fincaId, scope);
		const data = await detectarRacimos(req.body?.imagen, { signal: cancelacion.signal });
		if (!cancelacion.signal.aborted) res.json({ success: true, data });
	} catch (error) {
		const status = Number(error.status) || 500;
		// Never log image payloads, provider responses or API keys.
		logger.warn('conteo_foto_error', { request_id: req.requestId, status, code: error.code || 'DETECCION_ERROR' });
		if (!cancelacion.signal.aborted) res.status(status).json({
			error: error.code?.startsWith?.('DETECCION_') || status < 500 ? error.message : 'No se pudo analizar la foto.',
			code: error.code || 'DETECCION_ERROR',
		});
	} finally {
		res.off('close', cerrar);
	}
}
