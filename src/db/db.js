import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'control_finca',
	port: Number(process.env.DB_PORT || 5432),
	ssl:
		process.env.NODE_ENV === 'production'
			? { rejectUnauthorized: false }
			: false,
};

if (process.env.NODE_ENV === 'production' && !dbConfig.password) {
	throw new Error('DB_PASSWORD es obligatorio en producción');
}

export const pool = new Pool(dbConfig);

export const query = async (text, params) => {
	try {
		const result = await pool.query(text, params);
		return result;
	} catch (err) {
		console.error('❌ Error en la consulta SQL:', err.message);
		throw err;
	}
};

pool
	.connect()
	.then((client) => {
		console.log('✅ Conectado correctamente a PostgreSQL');
		client.release();
	})
	.catch((err) =>
		console.error('❌ Error al conectar con la base de datos:', err.message),
	);
