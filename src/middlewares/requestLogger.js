import { logger } from '../utils/logger.js';

const AUDIT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requestLogger(req, res, next) {
	const start = process.hrtime.bigint();

	res.on('finish', () => {
		const diffNs = process.hrtime.bigint() - start;
		const durationMs = Number(diffNs) / 1_000_000;
		logger.info('http_request', {
			request_id: req.requestId,
			method: req.method,
			path: req.originalUrl,
			status: res.statusCode,
			duration_ms: Number(durationMs.toFixed(2)),
			ip: req.ip,
		});

		if (AUDIT_METHODS.has(req.method)) {
			logger.info('security_audit_action', {
				request_id: req.requestId,
				method: req.method,
				path: req.originalUrl,
				status: res.statusCode,
				user_id: Number(req.user?.id || 0) || null,
				role: req.user?.rol || null,
				empresa_id: Number(req.user?.empresa_id || 0) || null,
				ip: req.ip,
			});
		}
	});

	next();
}
