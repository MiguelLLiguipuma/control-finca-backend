import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS_MATRIX } from '../src/utils/permissionsMatrix.js';

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPERVISOR', 'OPERADOR']);

test('permissions matrix no debe tener duplicados metodo+ruta', () => {
	const seen = new Set();
	for (const row of PERMISSIONS_MATRIX) {
		const key = `${String(row.method).toUpperCase()} ${row.path}`;
		assert.equal(seen.has(key), false, `duplicado en matriz: ${key}`);
		seen.add(key);
	}
});

test('permissions matrix debe usar roles válidos y no vacíos', () => {
	for (const row of PERMISSIONS_MATRIX) {
		assert.ok(Array.isArray(row.roles), `roles inválidos en ${row.path}`);
		assert.ok(row.roles.length > 0, `sin roles en ${row.path}`);
		for (const role of row.roles) {
			assert.equal(
				ALLOWED_ROLES.has(String(role).toUpperCase()),
				true,
				`rol inválido ${role} en ${row.path}`,
			);
		}
	}
});

test('rutas de escritura sobre empresas deben ser solo ADMIN', () => {
	const writes = PERMISSIONS_MATRIX.filter(
		(r) =>
			String(r.path).startsWith('/api/empresas') &&
			['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(r.method).toUpperCase()),
	);
	assert.ok(writes.length > 0, 'faltan reglas de escritura en empresas');
	for (const row of writes) {
		assert.deepEqual(row.roles, ['ADMIN'], `ruta no restringida: ${row.method} ${row.path}`);
	}
});
