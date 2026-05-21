import pg from 'pg';
import dotenv from 'dotenv';
import { getRequestScope } from '../utils/requestScope.js';
import { logger } from '../utils/logger.js';

dotenv.config();

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const DEFAULT_POOL_MAX = isProduction ? 3 : 10;
const POOL_PRESSURE_WARN_INTERVAL_MS = Number(
	process.env.DB_POOL_WARN_INTERVAL_MS || 30000,
);
const DB_SATURATION_COOLDOWN_MS = Number(
	process.env.DB_SATURATION_COOLDOWN_MS || 5000,
);

const baseDbConfig = databaseUrl
	? {
		connectionString: databaseUrl,
	  }
	: {
		host: process.env.DB_HOST || 'localhost',
		user: process.env.DB_USER || 'postgres',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'control_finca',
		port: Number(process.env.DB_PORT || 5432),
	  };

const dbConfig = {
	...baseDbConfig,
	max: Number(process.env.DB_POOL_MAX || DEFAULT_POOL_MAX),
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
	connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
	allowExitOnIdle: !isProduction,
	application_name: process.env.DB_APP_NAME || 'control-finca-backend',
	ssl: isProduction ? { rejectUnauthorized: false } : false,
};

if (isProduction && !databaseUrl && !dbConfig.password) {
	throw new Error('DB_PASSWORD es obligatorio en producción cuando DATABASE_URL no está configurado');
}

export const pool = new Pool(dbConfig);

export function getPoolStats() {
	return {
		max: Number(dbConfig.max || 0),
		totalCount: Number(pool.totalCount || 0),
		idleCount: Number(pool.idleCount || 0),
		waitingCount: Number(pool.waitingCount || 0),
	};
}

let lastPoolPressureWarnAt = 0;
let dbSaturatedUntil = 0;

function buildDbSaturationError() {
	const err = new Error(
		'Base de datos saturada temporalmente. Intente nuevamente en unos segundos.',
	);
	err.code = '53300';
	err.status = 503;
	return err;
}

function isDbSaturationActive() {
	return Date.now() < dbSaturatedUntil;
}

function markDbSaturated() {
	dbSaturatedUntil = Date.now() + DB_SATURATION_COOLDOWN_MS;
}

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

function shouldWarnPoolPressure() {
	const now = Date.now();
	if (now - lastPoolPressureWarnAt < POOL_PRESSURE_WARN_INTERVAL_MS) {
		return false;
	}
	lastPoolPressureWarnAt = now;
	return true;
}

function maybeWarnPoolPressure(reason, extra = {}) {
	const stats = getPoolStats();
	const underPressure =
		stats.waitingCount > 0 ||
		(stats.totalCount >= stats.max && stats.idleCount === 0);

	if (!underPressure || !shouldWarnPoolPressure()) return;

	logger.warn('db_pool_pressure', {
		reason,
		...stats,
		...extra,
	});
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

pool.on('connect', () => {
	maybeWarnPoolPressure('connect');
});

pool.on('acquire', () => {
	maybeWarnPoolPressure('acquire');
});

pool.on('remove', () => {
	maybeWarnPoolPressure('remove');
});

pool.on('error', (err) => {
	logger.error('db_pool_error', {
		error: err?.message || 'unknown',
		...getPoolStats(),
	});
});

logger.info('db_pool_initialized', {
	max: dbConfig.max,
	idleTimeoutMillis: dbConfig.idleTimeoutMillis,
	connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
	allowExitOnIdle: dbConfig.allowExitOnIdle,
	ssl: Boolean(dbConfig.ssl),
	application_name: dbConfig.application_name,
	usingDatabaseUrl: Boolean(databaseUrl),
	dbSaturationCooldownMs: DB_SATURATION_COOLDOWN_MS,
});

export const query = async (text, params) => {
	let client;
	try {
		if (isDbSaturationActive()) {
			throw buildDbSaturationError();
		}
		client = await pool.connect();
		return await client.query(text, params);
	} catch (err) {
		if (err?.code === '53300') {
			markDbSaturated();
			err.status = 503;
			err.message =
				'Base de datos saturada temporalmente. Intente nuevamente en unos segundos.';
		}
		logger.error('db_query_error', {
			error: err?.message || 'unknown',
			code: err?.code || null,
			status: err?.status || null,
			...getPoolStats(),
		});
		maybeWarnPoolPressure('query_error', {
			code: err?.code || null,
		});
		throw err;
	} finally {
		if (client) client.release();
	}
};

export async function testDbConnection() {
	const client = await pool.connect();
	try {
		return getPoolStats();
	} finally {
		client.release();
	}
}
