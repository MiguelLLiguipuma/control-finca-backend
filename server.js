import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './src/db/db.js';

import rolRoutes from './src/routes/rolRoutes.js';
import usuarioRoutes from './src/routes/usuarioRoutes.js';
import empresaRoutes from './src/routes/empresaRoutes.js';
import fincaRoutes from './src/routes/fincaRoutes.js';
import cintaRoutes from './src/routes/cintaRoutes.js';
import calendarioRoutes from './src/routes/calendarioRoutes.js';
import registroRoutes from './src/routes/registroRoutes.js';
import reporteRoutes from './src/routes/reporteRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import cosechaRoutes from './src/routes/cosecha/cosechaRoutes.js';
import embarqueRoutes from './src/routes/embarqueRoutes.js';
import { createRateLimit } from './src/middlewares/rateLimitSimple.js';
import { initWeatherWorker } from './src/workers/weatherWorker.js';

dotenv.config();

const app = express();

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
	];
}

const allowedOrigins = getAllowedOrigins();
const apiLimiter = createRateLimit({
	windowMs: 10 * 60 * 1000,
	max: Number(process.env.API_RATE_LIMIT_MAX || 600),
	keyFn: (req) => req.ip,
	message: 'Demasiadas solicitudes. Espere unos minutos e intente nuevamente.',
});

app.use(
	cors({
		origin(origin, callback) {
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) return callback(null, true);
			return callback(new Error('Origen no permitido por CORS'));
		},
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	}),
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

app.get('/debug', (req, res) => {
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

app.use((err, _req, res, _next) => {
	if (String(err?.message || '').includes('CORS')) {
		return res.status(403).json({ message: 'Origen no autorizado' });
	}
	return res.status(500).json({ message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
	console.log(`✅ Servidor backend en ejecución: http://localhost:${PORT}`);

	try {
		const client = await pool.connect();
		console.log('✅ Conectado correctamente a PostgreSQL');
		client.release();

		initWeatherWorker();
		console.log('☀️ Motor de sincronización climática activado');
	} catch (err) {
		console.error('❌ Error al conectar con la base de datos:', err.message);
	}
});
