import express from 'express';
import cors from 'cors';

import rolRoutes from './routes/rolRoutes.js';
import usuarioRoutes from './routes/usuarioRoutes.js';
import empresaRoutes from './routes/empresaRoutes.js';
import fincaRoutes from './routes/fincaRoutes.js';
import cintaRoutes from './routes/cintaRoutes.js';
import calendarioRoutes from './routes/calendarioRoutes.js';
import registroRoutes from './routes/registroRoutes.js';
import reporteRoutes from './routes/reporteRoutes.js';
import authRoutes from './routes/authRoutes.js';
import cosechaRoutes from './routes/cosecha/cosechaRoutes.js';
import embarqueRoutes from './routes/embarqueRoutes.js';
import balanzaRoutes from './routes/balanzaRoutes.js';
import { createRateLimit } from './middlewares/rateLimitSimple.js';
import { requestContext } from './middlewares/requestContext.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { logger } from './utils/logger.js';

function getAllowedOrigins() {
	const envList = String(process.env.CORS_ORIGINS || '')
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean);

	if (envList.length) return envList;

	return [
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'https://control-finca.vercel.app',
		'https://control-finca-frontend-pt41.vercel.app',
	];
}

function isAllowedVercelPreview(origin) {
	return /^https:\/\/control-finca-frontend-[a-z0-9-]+\.vercel\.app$/i.test(
		String(origin || ''),
	);
}

export function createApp() {
	const app = express();
	const allowedOrigins = getAllowedOrigins();
	const apiLimiter = createRateLimit({
		windowMs: 10 * 60 * 1000,
		max: Number(process.env.API_RATE_LIMIT_MAX || 600),
		keyFn: (req) => req.ip,
		message: 'Demasiadas solicitudes. Espere unos minutos e intente nuevamente.',
	});

	app.use(requestContext);
	app.use(
		cors({
			origin(origin, callback) {
				if (!origin) return callback(null, true);
				if (allowedOrigins.includes(origin)) return callback(null, true);
				if (isAllowedVercelPreview(origin)) return callback(null, true);
				return callback(new Error('Origen no permitido por CORS'));
			},
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
		}),
	);
	app.use(express.json({ limit: '1mb' }));
	app.use('/api', apiLimiter);
	app.use(requestLogger);

	app.get('/debug', (_req, res) => {
		res.json({ status: 'OK', message: 'Si ves esto, el servidor funciona' });
	});

	app.use('/api/reportes', reporteRoutes);
	app.use('/api/roles', rolRoutes);
	app.use('/api/usuarios', usuarioRoutes);
	app.use('/api/empresas', empresaRoutes);
	app.use('/api/fincas', fincaRoutes);
	app.use('/api/cintas', cintaRoutes);
	app.use('/api/calendarios-enfunde', calendarioRoutes);
	app.use('/api/registros', registroRoutes);
	app.use('/api/cosecha', cosechaRoutes);
	app.use('/api/embarque', embarqueRoutes);
	app.use('/api/auth', authRoutes);
	app.use('/api/balanza', balanzaRoutes);

	app.use((err, req, res, _next) => {
		if (String(err?.message || '').includes('CORS')) {
			logger.warn('cors_blocked', {
				request_id: req.requestId,
				origin: req.headers.origin || null,
			});
			return res.status(403).json({ message: 'Origen no autorizado' });
		}

		logger.error('unhandled_error', {
			request_id: req.requestId,
			path: req.originalUrl,
			method: req.method,
			error: err?.message || 'unknown',
		});
		return res.status(500).json({ message: 'Error interno del servidor' });
	});

	return app;
}
