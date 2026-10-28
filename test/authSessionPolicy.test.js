import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCurrentIdentity, getCachedSession, setCachedSession, sessionCacheRevision, invalidateUserSessions } from '../src/utils/authSessionPolicy.js';
import { UsuarioService } from '../src/services/usuarioService.js';
import { UsuarioModel } from '../src/models/usuarioModel.js';
import { EmpresaModel } from '../src/models/empresaModel.js';

test('un token antiguo no conserva otro rol, empresa o un rol desconocido', () => {
    const token = { rol: 'ADMIN', eid: 5 };
    assert.equal(matchesCurrentIdentity(token, { rol: 'ADMINISTRADOR', empresa_id: 5 }), true);
    assert.equal(matchesCurrentIdentity(token, { rol: 'OPERADOR', empresa_id: 5 }), false);
    assert.equal(matchesCurrentIdentity(token, { rol: 'ADMIN', empresa_id: 6 }), false);
    assert.equal(matchesCurrentIdentity({ rol: 'UNKNOWN' }, { rol: 'UNKNOWN' }), false);
    assert.equal(matchesCurrentIdentity({ rol: 'OPERARIO', eid: 5 }, { rol: 'TRABAJADOR', empresa_id: 5 }), true);
});

test('invalidacion limpia solo al usuario y una consulta antigua no repuebla cache', () => {
    const revision = sessionCacheRevision();
    setCachedSession('1:1:ADMIN:5', { id: 1 }, revision);
    setCachedSession('2:1:ADMIN:5', { id: 2 }, revision);
    invalidateUserSessions(1);
    assert.equal(getCachedSession('1:1:ADMIN:5'), null);
    assert.deepEqual(getCachedSession('2:1:ADMIN:5'), { id: 2 });
    setCachedSession('1:1:ADMIN:5', { stale: true }, revision);
    assert.equal(getCachedSession('1:1:ADMIN:5'), null);
});

test('cache no conserva permisos mas de 30 segundos aunque entorno indique mas', t => {
    const previous = process.env.AUTH_SESSION_CACHE_TTL_MS;
    process.env.AUTH_SESSION_CACHE_TTL_MS = '3600000';
    t.after(() => { if (previous === undefined) delete process.env.AUTH_SESSION_CACHE_TTL_MS; else process.env.AUTH_SESSION_CACHE_TTL_MS = previous; });
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    setCachedSession('3:1:ADMIN:5', { id: 3 }, sessionCacheRevision());
    now += 30000;
    assert.equal(getCachedSession('3:1:ADMIN:5'), null);
});

for (const payload of [{ rol_id: 2 }, { empresa_id: 6 }, { activo: false }, { password: 'scrypt$not-a-server-hash' }]) {
    test(`actualizar ${Object.keys(payload)[0]} revoca antes de modificar y limpia cache`, async t => {
        const calls = [];
        t.mock.method(UsuarioModel, 'findById', async () => ({ rows: [{ id: 10, empresa_id: 5 }] }));
        t.mock.method(EmpresaModel, 'findById', async () => ({ rows: [{ id: 6 }] }));
        t.mock.method(UsuarioModel, 'revokeTokens', async () => { calls.push('revoke'); });
        t.mock.method(UsuarioModel, 'update', async (_id, data) => {
            calls.push('update');
            if (payload.password) assert.notEqual(data.password, payload.password);
        });
        t.mock.method(UsuarioModel, 'replaceUsuarioRol', async () => { calls.push('role'); });
        setCachedSession('10:1:ADMIN:5', { id: 10 }, sessionCacheRevision());
        await UsuarioService.update(10, payload);
        assert.equal(calls[0], 'revoke');
        assert.equal(getCachedSession('10:1:ADMIN:5'), null);
    });
}

test('un fallo de actualizacion tambien invalida la cache de la sesion revocada', async t => {
    t.mock.method(UsuarioModel, 'findById', async () => ({ rows: [{ id: 11 }] }));
    t.mock.method(UsuarioModel, 'revokeTokens', async () => {});
    t.mock.method(UsuarioModel, 'update', async () => { throw new Error('write failed'); });
    setCachedSession('11:1:ADMIN:5', { id: 11 }, sessionCacheRevision());
    await assert.rejects(UsuarioService.update(11, { activo: false }));
    assert.equal(getCachedSession('11:1:ADMIN:5'), null);
});

test('editar nombre no vacia la contrasena ni revoca una sesion innecesariamente', async t => {
    t.mock.method(UsuarioModel, 'findById', async () => ({ rows: [{ id: 12 }] }));
    const revoke = t.mock.method(UsuarioModel, 'revokeTokens', async () => {});
    t.mock.method(UsuarioModel, 'update', async (_id, data) => { assert.equal('password' in data, false); });
    await UsuarioService.update(12, { nombre: 'Nombre', password: '' });
    assert.equal(revoke.mock.callCount(), 0);
});
