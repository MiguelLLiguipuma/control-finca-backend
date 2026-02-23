const buckets = new Map();

function nowMs() {
	return Date.now();
}

export function createRateLimit({
	windowMs = 15 * 60 * 1000,
	max = 5,
	keyFn,
	message = 'Demasiados intentos. Intente nuevamente más tarde.',
} = {}) {
	return (req, res, next) => {
		const key = keyFn ? keyFn(req) : req.ip;
		const bucketKey = String(key || 'unknown');
		const now = nowMs();
		const bucket = buckets.get(bucketKey);

		if (!bucket || now > bucket.resetAt) {
			buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
			return next();
		}

		bucket.count += 1;
		if (bucket.count > max) {
			const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
			res.set('Retry-After', String(retryAfterSec));
			return res.status(429).json({ message });
		}

		return next();
	};
}
