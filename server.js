import dotenv from 'dotenv';
import { pool, getPoolStats } from './src/db/db.js';
import { createApp } from './src/app.js';
import { logger } from './src/utils/logger.js';
import { initWeatherWorker } from './src/workers/weatherWorker.js';

dotenv.config();

const app = createApp();

export function startServer() {
	const PORT = process.env.PORT || 4000;
	return app.listen(PORT, async () => {
		logger.info('server_started', { port: PORT });

		try {
			const client = await pool.connect();
			logger.info('db_connected', getPoolStats());
			client.release();

			if (process.env.NODE_ENV !== 'test') {
				initWeatherWorker();
				logger.info('weather_worker_started');
			}
		} catch (err) {
			logger.error('db_connection_error', { error: err.message });
		}
	});
}

if (process.env.NODE_ENV !== 'test') {
	startServer();
}

export default app;
