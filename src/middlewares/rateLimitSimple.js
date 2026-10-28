import { createHash } from 'node:crypto';

function nowMs() {
	return Date.now();
}

export function createRateLimit({
	windowMs = 15 * 60 * 1000,
	max = 5,
	keyFn,
	message = 'Demasiados intentos. Intente nuevamente más tarde.',
    maxBuckets = 10000,
} = {}) {
    if (!Number.isSafeInteger(max) || max < 1 || !Number.isFinite(windowMs) || windowMs <= 0 ||
        !Number.isSafeInteger(maxBuckets) || maxBuckets < 1) {
        throw new Error('Configuracion de rate limit invalida');
    }
    // Each limiter owns its counters; auth and API limits must not share windows.
    const buckets = new Map();
    let nextCleanup = 0;
	return (req, res, next) => {
		const key = keyFn ? keyFn(req) : req.ip;
		const bucketKey = createHash('sha256').update(String(key || 'unknown')).digest('hex');
		const now = nowMs();
        if (now >= nextCleanup) {
            for (const [key, value] of buckets) {
                if (value.resetAt <= now) buckets.delete(key);
            }
            nextCleanup = now + Math.min(windowMs, 60000);
        }
		const bucket = buckets.get(bucketKey);

		if (!bucket || now >= bucket.resetAt) {
            if (!bucket && buckets.size >= maxBuckets) {
                res.set('Retry-After', String(Math.max(1, Math.ceil((nextCleanup - now) / 1000))));
                return res.status(429).json({ message });
            }
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
