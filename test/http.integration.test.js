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
	assert.equal(res.headers.get('x-powered-by'), null);
	assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
	assert.equal(res.headers.get('cache-control'), 'no-store');
	const data = await res.json();
	assert.equal(data.status, 'OK');
});

test('registro publico no crea cuentas sin habilitacion expresa', async (t) => {
    const previous = process.env.ALLOW_PUBLIC_REGISTRATION;
    delete process.env.ALLOW_PUBLIC_REGISTRATION;
    t.after(() => {
        if (previous === undefined) delete process.env.ALLOW_PUBLIC_REGISTRATION;
        else process.env.ALLOW_PUBLIC_REGISTRATION = previous;
    });
    const { server, baseUrl } = await startTestServer();
    t.after(() => server.close());
    const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(res.status, 403);
    assert.match((await res.json()).message, /invitacion/);
});

test('CORS no admite previews por coincidencia parcial del nombre', async (t) => {
    const { server, baseUrl } = await startTestServer();
    t.after(() => server.close());
    const res = await fetch(`${baseUrl}/debug`, { headers: { Origin: 'https://control-finca-frontend-untrusted.vercel.app' } });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('JSON malformado devuelve 400, no un fallo interno', async (t) => {
    const { server, baseUrl } = await startTestServer();
    t.after(() => server.close());
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
    });
    assert.equal(res.status, 400);
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
