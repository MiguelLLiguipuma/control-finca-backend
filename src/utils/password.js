import crypto from 'crypto';

const HASH_PREFIX = 'scrypt';
const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const DEFAULT_KEYLEN = 64;

function safeEqualText(a, b) {
	const aa = Buffer.from(String(a || ''), 'utf8');
	const bb = Buffer.from(String(b || ''), 'utf8');
	if (aa.length !== bb.length) return false;
	return crypto.timingSafeEqual(aa, bb);
}

function derive(password, salt, N, r, p, keylen = DEFAULT_KEYLEN) {
	return crypto.scryptSync(password, salt, keylen, { N, r, p });
}

export function isPasswordHash(value) {
	return typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);
}

export function hashPassword(plainPassword) {
	const plain = String(plainPassword || '');
	if (!plain) throw new Error('Password invalido');
	const salt = crypto.randomBytes(16);
	const key = derive(plain, salt, DEFAULT_N, DEFAULT_R, DEFAULT_P);
	return `${HASH_PREFIX}$${DEFAULT_N}$${DEFAULT_R}$${DEFAULT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(plainPassword, storedPassword) {
	const plain = String(plainPassword || '');
	const stored = String(storedPassword || '');
	if (!plain || !stored) return { matches: false, legacy: false };

	if (!isPasswordHash(stored)) {
		return { matches: safeEqualText(plain, stored), legacy: true };
	}

	const parts = stored.split('$');
	if (parts.length !== 6) return { matches: false, legacy: false };

	const n = Number(parts[1]);
	const r = Number(parts[2]);
	const p = Number(parts[3]);
	const saltB64 = parts[4];
	const keyB64 = parts[5];

	if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
		return { matches: false, legacy: false };
	}

	try {
		const salt = Buffer.from(String(saltB64 || ''), 'base64');
		const expected = Buffer.from(String(keyB64 || ''), 'base64');
		if (!salt.length || !expected.length) return { matches: false, legacy: false };
		const derived = derive(plain, salt, n, r, p, expected.length);
		if (derived.length !== expected.length) return { matches: false, legacy: false };
		return { matches: crypto.timingSafeEqual(derived, expected), legacy: false };
	} catch {
		return { matches: false, legacy: false };
	}
}
