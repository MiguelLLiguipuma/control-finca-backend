import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.API_RATE_LIMIT_MAX = '3';

const { createApp } = await import('../src/app.js');

function startTestServer() {
	const app = createApp();
	return new Promise((resolve) => {
		const server = app.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
		});
	});
}

test('GET /debug responde 200 y x-request-id', async (t) => {
	const { server, baseUrl } = await startTestServer();
	t.after(() => server.close());

	const res = await fetch(`${baseUrl}/debug`);
	assert.equal(res.status, 200);
	assert.ok(res.headers.get('x-request-id'));
	const data = await res.json();
	assert.equal(data.status, 'OK');
});

test('GET /api/embarque/vouchers sin token responde 401', async (t) => {
	const { server, baseUrl } = await startTestServer();
	t.after(() => server.close());

	const res = await fetch(`${baseUrl}/api/embarque/vouchers`);
	assert.equal(res.status, 401);
});

test('Rate limit global de /api responde 429 al exceder', async (t) => {
	const { server, baseUrl } = await startTestServer();
	t.after(() => server.close());

	const statuses = [];
	for (let i = 0; i < 5; i += 1) {
		const res = await fetch(`${baseUrl}/api/roles`);
		statuses.push(res.status);
	}

	assert.ok(statuses.includes(429));
});
