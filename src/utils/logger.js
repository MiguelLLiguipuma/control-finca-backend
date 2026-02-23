function asJson(level, message, meta = {}) {
	return JSON.stringify({
		ts: new Date().toISOString(),
		level,
		message,
		...meta,
	});
}

export const logger = {
	info(message, meta = {}) {
		console.log(asJson('info', message, meta));
	},
	warn(message, meta = {}) {
		console.warn(asJson('warn', message, meta));
	},
	error(message, meta = {}) {
		console.error(asJson('error', message, meta));
	},
};
