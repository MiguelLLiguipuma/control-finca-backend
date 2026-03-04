import crypto from 'crypto';
import { runWithRequestScope } from '../utils/requestScope.js';

export function requestContext(req, res, next) {
	const requestId = req.headers['x-request-id']
		? String(req.headers['x-request-id'])
		: crypto.randomUUID();

	req.requestId = requestId;
	res.setHeader('x-request-id', requestId);
	runWithRequestScope({ requestId }, () => next());
}
