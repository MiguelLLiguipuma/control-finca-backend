import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarRacimos, normalizarDetecciones, validarImagenRacimos } from '../src/services/cosecha/deteccionRacimosService.js';

const imagen = { mime_type: 'image/jpeg', base64: Buffer.from([255, 216, 255, 224, 0, 0, 255, 217]).toString('base64') };
const env = { GEMINI_API_KEY: 'test-not-a-real-key' };
const ok = (racimos) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ racimos }) }] } }] }) });

test('convierte cajas a marcas y elimina solo duplicados exactos', () => {
	assert.deepEqual(normalizarDetecciones({ racimos: [{ box_2d: [100, 200, 300, 400] }, { box_2d: [100, 200, 300, 400] }, { box_2d: [150, 250, 350, 450] }] }),
		[{ id: 1, x: 0.3, y: 0.2 }, { id: 2, x: 0.35, y: 0.25 }]);
	assert.deepEqual(normalizarDetecciones({ racimos: [] }), []);
	assert.deepEqual(normalizarDetecciones([{ box_2d: [100, 200, 300, 400] }]), [{ id: 1, x: 0.3, y: 0.2 }]);
});
test('rechaza cajas invalidas e incompletas sin inventar resultados', () => {
	for (const box of [[0, 0, 1001, 10], [2, 0, 1, 10], [0, 1, 10, 1], [0, 0, '10', 10], [0, 0, NaN, 10], [0, 0, 10]]) {
		assert.throws(() => normalizarDetecciones({ racimos: [{ box_2d: box }] }), { status: 502 });
	}
	assert.throws(() => normalizarDetecciones({}), { status: 502 });
	assert.throws(() => normalizarDetecciones({ racimos: Array(201).fill({ box_2d: [0, 0, 1, 1] }) }), { status: 502 });
});
test('valida tipo, formato, firma y limite de foto', () => {
	assert.equal(validarImagenRacimos(imagen), imagen.base64);
	const large = Buffer.alloc(650 * 1024, 0);
	large[0] = 255; large[1] = 216; large[2] = 255;
	assert.equal(validarImagenRacimos({ ...imagen, base64: large.toString('base64') }).length, large.toString('base64').length);
	for (const invalid of [null, { ...imagen, mime_type: 'image/svg+xml' }, { ...imagen, base64: 'invalid' }, { ...imagen, base64: 'aaaa' }, { ...imagen, base64: Buffer.alloc(651 * 1024).toString('base64') }]) {
		assert.throws(() => validarImagenRacimos(invalid), { status: 400 });
	}
});
test('sin clave no llama al proveedor', async () => {
	await assert.rejects(detectarRacimos(imagen, { env: {}, fetchImpl: () => { throw new Error('no debe llamar'); } }), { status: 503, code: 'DETECCION_NO_CONFIGURADA' });
});
test('envia imagen sin datos de usuario y entrega borrador validado', async () => {
	let calls = 0;
	const result = await detectarRacimos(imagen, { env, fetchImpl: async (url, options) => {
		calls++;
		assert.match(url, /\/gemini-3.6-flash:generateContent$/);
		assert.equal(url.includes(env.GEMINI_API_KEY), false);
		assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
		const body = JSON.parse(options.body);
		assert.equal(body.contents[0].parts[0].inlineData.data, imagen.base64);
		assert.equal(body.generationConfig.responseMimeType, 'application/json');
		return ok([{ box_2d: [100, 200, 300, 400] }]);
	} });
	assert.equal(calls, 1);
	assert.equal(result.borrador, true);
	assert.deepEqual(result.marcas, [{ id: 1, x: 0.3, y: 0.2 }]);
});
test('cuota y configuracion fallan sin reintentos ni respuestas privadas', async () => {
	for (const [providerStatus, status] of [[429, 429], [401, 503], [403, 503], [404, 503], [500, 502]]) {
		let calls = 0;
		await assert.rejects(detectarRacimos(imagen, { env, fetchImpl: async () => { calls++; return { ok: false, status: providerStatus }; } }), { status });
		assert.equal(calls, 1);
	}
});
test('respuesta truncada o JSON roto nunca producen marcas parciales', async () => {
	for (const candidate of [{ finishReason: 'MAX_TOKENS' }, { finishReason: 'STOP', content: { parts: [{ text: 'invalid json' }] } }]) {
		await assert.rejects(detectarRacimos(imagen, { env, fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [candidate] }) }) }), { status: 502 });
	}
});
test('cancelacion no entrega resultados', async () => {
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(detectarRacimos(imagen, { env, signal: controller.signal, fetchImpl: async (_url, { signal }) => { signal.throwIfAborted(); } }), { status: 504 });
});
