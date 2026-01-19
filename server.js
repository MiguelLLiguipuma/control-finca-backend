import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './src/db/db.js';

// Importar rutas
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

// Configuración de entorno
dotenv.config();

// Inicializar servidor Express
const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Debug rápido
app.get('/debug', (req, res) => {
	res.json({ status: 'OK', message: 'Si ves esto, el servidor funciona' });
});

// ✅ Rutas principales
app.use('/api/reportes', reporteRoutes);
app.use('/api/roles', rolRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/fincas', fincaRoutes);
app.use('/api/cintas', cintaRoutes);
app.use('/api/calendarios-enfunde', calendarioRoutes);
// -----------------------------

app.use('/api/registros', registroRoutes);
app.use('/api/cosecha', cosechaRoutes);
app.use('/api/auth', authRoutes);

// Puerto de servidor
const PORT = process.env.PORT || 4000;

// Iniciar servidor
app.listen(PORT, async () => {
	console.log(`✅ Servidor backend en ejecución: http://localhost:${PORT}`);

	try {
		await pool.connect();
		console.log('✅ Conectado correctamente a PostgreSQL');
	} catch (err) {
		console.error('❌ Error al conectar con la base de datos:', err.message);
	}
});
