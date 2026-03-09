import test from 'node:test';
import assert from 'node:assert/strict';
import { __cosechaServiceInternals } from '../src/services/cosecha/cosechaService.js';

test('validarFechaISO acepta fecha real valida', () => {
	const ok = __cosechaServiceInternals.validarFechaISO('2026-03-09');
	assert.equal(ok, true);
});

test('validarFechaISO rechaza fecha calendario invalida', () => {
	const ok = __cosechaServiceInternals.validarFechaISO('2026-02-31');
	assert.equal(ok, false);
});
