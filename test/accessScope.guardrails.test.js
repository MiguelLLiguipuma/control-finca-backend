import test from 'node:test';
import assert from 'node:assert/strict';
import {
	applyEmpresaScopeToRequestedIds,
	applyFincaScopeToRequestedIds,
} from '../src/utils/accessScope.js';

test('applyFincaScopeToRequestedIds devuelve permitidas cuando enforce=true y no requested', () => {
	const ids = applyFincaScopeToRequestedIds([], {
		enforce: true,
		allowedFincaIds: [2, 5],
	});
	assert.deepEqual(ids, [2, 5]);
});

test('applyFincaScopeToRequestedIds bloquea requested fuera de alcance', () => {
	assert.throws(
		() =>
			applyFincaScopeToRequestedIds([1, 3], {
				enforce: true,
				allowedFincaIds: [1, 2],
			}),
		/no tiene permisos/i,
	);
});

test('applyEmpresaScopeToRequestedIds devuelve permitidas cuando enforce=true y no requested', () => {
	const ids = applyEmpresaScopeToRequestedIds([], {
		enforce: true,
		allowedEmpresaIds: [7, 9],
	});
	assert.deepEqual(ids, [7, 9]);
});

test('applyEmpresaScopeToRequestedIds bloquea requested fuera de alcance', () => {
	assert.throws(
		() =>
			applyEmpresaScopeToRequestedIds([7, 10], {
				enforce: true,
				allowedEmpresaIds: [7, 9],
			}),
		/no tiene permisos/i,
	);
});
