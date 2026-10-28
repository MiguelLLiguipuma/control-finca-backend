import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimit } from '../src/middlewares/rateLimitSimple.js';
import { publicRegistrationEnabled } from '../src/utils/registrationPolicy.js';
import { missingTenantEvidence } from '../scripts/requireTenantE2E.js';

function request(limiter, ip = 'test') {
    const result = { status: 200, headers: {}, next: false };
    const res = {
        set(key, value) { result.headers[key] = value; return this; },
        status(value) { result.status = value; return this; },
        json() { return this; },
    };
    limiter({ ip }, res, () => { result.next = true; });
    return result;
}

test('los limitadores no comparten contadores entre rutas ni aplicaciones', () => {
    const one = createRateLimit({ max: 1 });
    const two = createRateLimit({ max: 1 });
    assert.equal(request(one).status, 200);
    assert.equal(request(one).status, 429);
    assert.equal(request(two).status, 200);
});

test('limita memoria sin permitir solicitudes nuevas ilimitadas', () => {
    const limiter = createRateLimit({ max: 2, maxBuckets: 1 });
    assert.equal(request(limiter, 'a').status, 200);
    const blocked = request(limiter, 'b');
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers['Retry-After']) >= 1);
    assert.equal(request(limiter, 'a').status, 200);
});

test('libera contadores vencidos y reinicia exactamente al terminar ventana', (t) => {
    let now = 100;
    t.mock.method(Date, 'now', () => now);
    const limiter = createRateLimit({ max: 1, windowMs: 100, maxBuckets: 1 });
    request(limiter, 'a');
    now = 200;
    assert.equal(request(limiter, 'b').status, 200);
});

test('rechaza configuracion que desactive accidentalmente los limites', () => {
    for (const max of [NaN, 0, -1, Infinity, 1.5]) assert.throws(() => createRateLimit({ max }));
});

test('registro publico cerrado por defecto y solo habilitado explicitamente', () => {
    for (const value of [undefined, '', 'false', 'TRUE']) {
        assert.equal(publicRegistrationEnabled({ ALLOW_PUBLIC_REGISTRATION: value }), false);
    }
    assert.equal(publicRegistrationEnabled({ ALLOW_PUBLIC_REGISTRATION: 'true' }), true);
});

test('la verificacion de publicacion no aprueba E2E omitidos por falta de configuracion', () => {
    assert.equal(missingTenantEvidence({}).length, 7);
    const env = { E2E_BASE_URL: 'http://127.0.0.1', E2E_TOKEN_OPERATOR: 'a', E2E_TOKEN_SUPERVISOR: 'b', E2E_TOKEN_ADMIN: 'c',
        E2E_FINCA_PERMITIDA: '1', E2E_FINCA_NO_PERMITIDA: '2', E2E_FINCA_OTRA_EMPRESA: '3' };
    assert.deepEqual(missingTenantEvidence(env), []);
    assert.equal(missingTenantEvidence({ ...env, E2E_FINCA_OTRA_EMPRESA: '1' }).length, 1);
});
