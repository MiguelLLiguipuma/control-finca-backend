// ===============================================
// 🗄️ Conexión a la base de datos PostgreSQL
// ===============================================

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Carga las variables del archivo .env

const { Pool } = pg;

// 🧩 Configuración del pool de conexiones
export const pool = new Pool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'admin',
	database: process.env.DB_NAME || 'control_finca',
	port: process.env.DB_PORT || 5432,
	ssl:
		process.env.NODE_ENV === 'production'
			? { rejectUnauthorized: false }
			: false,
});

// 🧠 Función utilitaria para hacer consultas SQL
export const query = async (text, params) => {
	try {
		const result = await pool.query(text, params);
		return result;
	} catch (err) {
		console.error('❌ Error en la consulta SQL:', err.message);
		throw err;
	}
};

// 🚀 Mensaje de conexión
pool
	.connect()
	.then(() => console.log('✅ Conectado correctamente a PostgreSQL'))
	.catch((err) =>
		console.error('❌ Error al conectar con la base de datos:', err.message),
	);
