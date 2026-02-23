import { logger } from '../utils/logger.js';

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
	});

	next();
}
