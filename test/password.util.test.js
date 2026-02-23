import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, isPasswordHash, verifyPassword } from '../src/utils/password.js';

test('hashPassword genera formato hash valido', () => {
	const hash = hashPassword('ClaveSegura123');
	assert.equal(typeof hash, 'string');
	assert.equal(isPasswordHash(hash), true);
});

test('verifyPassword valida password correcta', () => {
	const plain = 'ClaveSegura123';
	const hash = hashPassword(plain);
	const result = verifyPassword(plain, hash);
	assert.equal(result.matches, true);
	assert.equal(result.legacy, false);
});

test('verifyPassword rechaza password incorrecta', () => {
	const hash = hashPassword('ClaveSegura123');
	const result = verifyPassword('OtraClave999', hash);
	assert.equal(result.matches, false);
});

test('verifyPassword soporta legacy plaintext', () => {
	const result = verifyPassword('12345678', '12345678');
	assert.equal(result.matches, true);
	assert.equal(result.legacy, true);
});
