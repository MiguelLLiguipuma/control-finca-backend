import pg from 'pg';
import dotenv from 'dotenv';
import { getRequestScope } from '../utils/requestScope.js';

dotenv.config();

const { Pool } = pg;

const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'control_finca',
	port: Number(process.env.DB_PORT || 5432),
	max: Number(process.env.DB_POOL_MAX || (process.env.NODE_ENV === 'production' ? 5 : 10)),
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
	connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
	allowExitOnIdle: process.env.NODE_ENV !== 'production',
	application_name: process.env.DB_APP_NAME || 'control-finca-backend',
	ssl:
		process.env.NODE_ENV === 'production'
			? { rejectUnauthorized: false }
			: false,
};

if (process.env.NODE_ENV === 'production' && !dbConfig.password) {
	throw new Error('DB_PASSWORD es obligatorio en producción');
}

export const pool = new Pool(dbConfig);

function normalizeRole(role) {
	const raw = String(role || '').trim().toUpperCase();
	if (raw === 'TRABAJADOR' || raw === 'OPERARIO') return 'OPERADOR';
	if (raw === 'ADMINISTRADOR' || raw === 'GERENTE') return 'ADMIN';
	return raw;
}

function computeDbScope() {
	const scope = getRequestScope();
	const role = normalizeRole(scope?.role);
	const allowedFincaIds = Array.isArray(scope?.allowedFincaIds)
		? scope.allowedFincaIds
		: [];
	const enforce =
		(role === 'OPERADOR' || role === 'SUPERVISOR') && allowedFincaIds.length >= 0;

	return {
		userId: scope?.userId ? String(scope.userId) : '',
		empresaId: scope?.empresaId ? String(scope.empresaId) : '',
		role: role || '',
		enforce: enforce ? 'true' : 'false',
		allowedFincas: allowedFincaIds.join(','),
		requestId: scope?.requestId ? String(scope.requestId) : '',
	};
}

async function applyDbScope(client) {
	const s = computeDbScope();
	const baseQuery =
		typeof client.__originalQuery === 'function'
			? client.__originalQuery
			: client.query.bind(client);
	await baseQuery(
		`SELECT
      set_config('app.user_id', $1, false),
      set_config('app.empresa_id', $2, false),
      set_config('app.role', $3, false),
      set_config('app.scope_enforced', $4, false),
      set_config('app.allowed_fincas', $5, false),
      set_config('app.request_id', $6, false)`,
		[s.userId, s.empresaId, s.role, s.enforce, s.allowedFincas, s.requestId],
	);
}

const originalConnect = pool.connect.bind(pool);
function patchClientScope(client) {
	if (!client) return client;
	if (client.__scopePatched) return client;

	const originalClientQuery = client.query.bind(client);
	const originalClientRelease = client.release.bind(client);

	client.__scopePatched = true;
	client.__scopeApplied = false;
	client.__originalQuery = originalClientQuery;

	client.query = async (...queryArgs) => {
		if (!client.__scopeApplied) {
			await applyDbScope(client);
			client.__scopeApplied = true;
		}
		return originalClientQuery(...queryArgs);
	};

	client.release = (...releaseArgs) => {
		client.__scopeApplied = false;
		return originalClientRelease(...releaseArgs);
	};

	return client;
}

pool.connect = (...args) => {
	if (typeof args[0] === 'function') {
		const callback = args[0];
		return originalConnect((err, client, done) => {
			if (err || !client) return callback(err, client, done);
			const patched = patchClientScope(client);
			const wrappedDone = (...doneArgs) => {
				patched.__scopeApplied = false;
				return done(...doneArgs);
			};
			return callback(null, patched, wrappedDone);
		});
	}

	return originalConnect(...args).then((client) => patchClientScope(client));
};

export const query = async (text, params) => {
	let client;
	try {
		client = await pool.connect();
		return await client.query(text, params);
	} catch (err) {
		if (err?.code === '53300') {
			err.status = 503;
			err.message =
				'Base de datos saturada temporalmente. Intente nuevamente en unos segundos.';
		}
		console.error('❌ Error en la consulta SQL:', err.message);
		throw err;
	} finally {
		if (client) client.release();
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
