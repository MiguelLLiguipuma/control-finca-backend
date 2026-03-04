import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = String(process.env.E2E_BASE_URL || '').trim();
const TOKEN_OPERATOR = String(process.env.E2E_TOKEN_OPERATOR || '').trim();
const TOKEN_SUPERVISOR = String(process.env.E2E_TOKEN_SUPERVISOR || '').trim();
const TOKEN_ADMIN = String(process.env.E2E_TOKEN_ADMIN || '').trim();
const FINCA_PERMITIDA = Number(process.env.E2E_FINCA_PERMITIDA || 0);
const FINCA_NO_PERMITIDA = Number(process.env.E2E_FINCA_NO_PERMITIDA || 0);
const ANIO = Number(process.env.E2E_ANIO || new Date().getFullYear());

const missingCritical =
	!BASE_URL || !TOKEN_OPERATOR || !Number.isInteger(FINCA_PERMITIDA) || FINCA_PERMITIDA <= 0;

const maybe =
	!Number.isInteger(FINCA_NO_PERMITIDA) || FINCA_NO_PERMITIDA <= 0
		? null
		: FINCA_NO_PERMITIDA;

function authHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
}

async function getJson(path, token) {
	const res = await fetch(`${BASE_URL}${path}`, {
		method: 'GET',
		headers: authHeaders(token),
	});
	let body = null;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { status: res.status, body };
}

if (missingCritical) {
	test.skip(
		'Multi-tenant E2E: export E2E_BASE_URL, E2E_TOKEN_OPERATOR, E2E_FINCA_PERMITIDA (optional E2E_FINCA_NO_PERMITIDA, E2E_ANIO)',
		() => {},
	);
} else {
	test('Operador accede a reportes de finca permitida', async () => {
		const { status } = await getJson(
			`/api/reportes/total-semanal/${FINCA_PERMITIDA}/${ANIO}`,
			TOKEN_OPERATOR,
		);
		assert.equal(status, 200);
	});

	if (maybe) {
		test('Operador no debe acceder a finca no permitida (reportes)', async () => {
			const { status } = await getJson(
				`/api/reportes/total-semanal/${maybe}/${ANIO}`,
				TOKEN_OPERATOR,
			);
			assert.ok([403, 404].includes(status));
		});

		test('Operador no debe acceder a finca no permitida (registros por finca)', async () => {
			const { status } = await getJson(
				`/api/registros/finca/${maybe}/${ANIO}`,
				TOKEN_OPERATOR,
			);
			assert.ok([403, 404].includes(status));
		});
	}

	test('Operador lista fincas solo de su alcance', async () => {
		const { status, body } = await getJson('/api/fincas', TOKEN_OPERATOR);
		assert.equal(status, 200);
		assert.ok(Array.isArray(body));
		const ids = body.map((x) => Number(x.id)).filter((x) => Number.isInteger(x));
		assert.ok(ids.includes(FINCA_PERMITIDA));
		if (maybe) {
			assert.equal(ids.includes(maybe), false);
		}
	});

	if (TOKEN_SUPERVISOR) {
		test('Supervisor accede a auditoria (si tiene permisos) y mantiene scope', async () => {
			const { status } = await getJson('/api/reportes/auditoria?limit=10', TOKEN_SUPERVISOR);
			assert.ok([200, 403].includes(status));
		});
	}

	if (TOKEN_ADMIN && maybe) {
		test('Admin puede consultar finca no permitida para operador', async () => {
			const { status } = await getJson(
				`/api/reportes/total-semanal/${maybe}/${ANIO}`,
				TOKEN_ADMIN,
			);
			assert.equal(status, 200);
		});
	}
}
