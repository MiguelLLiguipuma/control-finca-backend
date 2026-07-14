import crypto from 'crypto';
import { query } from '../../db/db.js';

const CHALLENGE_TTL_MS = Number(process.env.WEBAUTHN_CHALLENGE_TTL_MS || 5 * 60 * 1000);
const DEFAULT_RP_NAME = process.env.WEBAUTHN_RP_NAME || 'ControlFinca';

function base64UrlEncode(input) {
	const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return buffer
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function base64UrlDecode(value) {
	const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
	return Buffer.from(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='), 'base64');
}

function sha256(buffer) {
	return crypto.createHash('sha256').update(buffer).digest();
}

function getRpId(req) {
	const configured = String(process.env.WEBAUTHN_RP_ID || '').trim();
	if (configured) return configured;
	return String(req.hostname || req.get('host') || '').split(':')[0];
}

function getAllowedOrigins(req) {
	const configured = String(process.env.WEBAUTHN_ORIGIN || process.env.FRONTEND_URL || '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
	if (configured.length) return configured;
	return [`${req.protocol}://${req.get('host')}`];
}

function parseClientData(credential, expectedType, expectedChallenge, req) {
	if (!credential?.response?.clientDataJSON) {
		throw Object.assign(new Error('clientDataJSON es requerido'), { status: 400 });
	}

	let clientDataJSON;
	let parsed;
	try {
		clientDataJSON = base64UrlDecode(credential.response.clientDataJSON);
		parsed = JSON.parse(clientDataJSON.toString('utf8'));
	} catch {
		throw Object.assign(new Error('clientDataJSON WebAuthn inválido'), { status: 400 });
	}

	if (parsed.type !== expectedType) {
		throw Object.assign(new Error('Tipo WebAuthn inválido'), { status: 400 });
	}
	if (expectedChallenge && parsed.challenge !== expectedChallenge) {
		throw Object.assign(new Error('Challenge WebAuthn inválido'), { status: 400 });
	}
	const allowedOrigins = getAllowedOrigins(req);
	if (!allowedOrigins.includes(parsed.origin)) {
		throw Object.assign(new Error('Origen WebAuthn no autorizado'), { status: 403 });
	}
	return { parsed, clientDataJSON };
}

function createChallenge() {
	return base64UrlEncode(crypto.randomBytes(32));
}

async function storeChallenge({ challenge, type, userId = null, email = null }) {
	await query(
		`INSERT INTO webauthn_challenges (challenge, tipo, usuario_id, email, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5::TEXT || ' milliseconds')::INTERVAL)`,
		[challenge, type, userId, email, CHALLENGE_TTL_MS],
	);
}

async function consumeChallenge(challenge, type) {
	const result = await query(
		`UPDATE webauthn_challenges
     SET used_at = NOW()
     WHERE challenge = $1
       AND tipo = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING *`,
		[challenge, type],
	);
	if (!result.rows.length) {
		throw Object.assign(new Error('Challenge expirado o inválido'), { status: 400 });
	}
	return result.rows[0];
}

function readCborLength(buffer, offset, additional) {
	if (additional < 24) return { length: additional, offset };
	if (additional === 24) return { length: buffer.readUInt8(offset), offset: offset + 1 };
	if (additional === 25) return { length: buffer.readUInt16BE(offset), offset: offset + 2 };
	if (additional === 26) return { length: buffer.readUInt32BE(offset), offset: offset + 4 };
	throw new Error('CBOR no soportado');
}

function decodeCborItem(buffer, offset = 0) {
	const initial = buffer.readUInt8(offset);
	const major = initial >> 5;
	const additional = initial & 0x1f;
	let cursor = offset + 1;
	const read = () => {
		const res = readCborLength(buffer, cursor, additional);
		cursor = res.offset;
		return res.length;
	};

	if (major === 0) return { value: read(), offset: cursor };
	if (major === 1) return { value: -1 - read(), offset: cursor };
	if (major === 2) {
		const length = read();
		return { value: buffer.subarray(cursor, cursor + length), offset: cursor + length };
	}
	if (major === 3) {
		const length = read();
		return { value: buffer.subarray(cursor, cursor + length).toString('utf8'), offset: cursor + length };
	}
	if (major === 4) {
		const length = read();
		const arr = [];
		for (let i = 0; i < length; i += 1) {
			const item = decodeCborItem(buffer, cursor);
			arr.push(item.value);
			cursor = item.offset;
		}
		return { value: arr, offset: cursor };
	}
	if (major === 5) {
		const length = read();
		const map = new Map();
		for (let i = 0; i < length; i += 1) {
			const key = decodeCborItem(buffer, cursor);
			cursor = key.offset;
			const value = decodeCborItem(buffer, cursor);
			cursor = value.offset;
			map.set(key.value, value.value);
		}
		return { value: map, offset: cursor };
	}
	if (major === 7) {
		if (additional === 20) return { value: false, offset: cursor };
		if (additional === 21) return { value: true, offset: cursor };
		if (additional === 22 || additional === 23) return { value: null, offset: cursor };
	}
	throw new Error('CBOR no soportado');
}

function parseAuthData(authData) {
	const rpIdHash = authData.subarray(0, 32);
	const flags = authData.readUInt8(32);
	const signCount = authData.readUInt32BE(33);
	const hasAttestedCredential = Boolean(flags & 0x40);
	let credentialId = null;
	let credentialPublicKey = null;

	if (hasAttestedCredential) {
		let offset = 37 + 16;
		const credentialIdLength = authData.readUInt16BE(offset);
		offset += 2;
		credentialId = authData.subarray(offset, offset + credentialIdLength);
		offset += credentialIdLength;
		credentialPublicKey = authData.subarray(offset);
	}

	return {
		rpIdHash,
		flags,
		signCount,
		userPresent: Boolean(flags & 0x01),
		userVerified: Boolean(flags & 0x04),
		credentialId,
		credentialPublicKey,
	};
}

function coseKeyToPublicKeyPem(coseBuffer) {
	const { value } = decodeCborItem(coseBuffer);
	if (!(value instanceof Map)) {
		throw new Error('Llave pública WebAuthn inválida');
	}

	const kty = value.get(1);
	const alg = value.get(3);
	if (kty === 2 && alg === -7) {
		const crv = value.get(-1);
		const x = value.get(-2);
		const y = value.get(-3);
		if (crv !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
			throw new Error('Llave EC2 WebAuthn inválida');
		}
		return crypto
			.createPublicKey({
				key: {
					kty: 'EC',
					crv: 'P-256',
					x: base64UrlEncode(x),
					y: base64UrlEncode(y),
					ext: true,
				},
				format: 'jwk',
			})
			.export({ type: 'spki', format: 'pem' });
	}

	if (kty === 3 && alg === -257) {
		const n = value.get(-1);
		const e = value.get(-2);
		if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) {
			throw new Error('Llave RSA WebAuthn inválida');
		}
		return crypto
			.createPublicKey({
				key: {
					kty: 'RSA',
					n: base64UrlEncode(n),
					e: base64UrlEncode(e),
					ext: true,
				},
				format: 'jwk',
			})
			.export({ type: 'spki', format: 'pem' });
	}

	throw Object.assign(new Error('Algoritmo WebAuthn no soportado'), { status: 400 });
}

function assertAuthData(authData, req) {
	const expectedRpHash = sha256(Buffer.from(getRpId(req)));
	if (!authData.rpIdHash.equals(expectedRpHash)) {
		throw Object.assign(new Error('RP ID WebAuthn inválido'), { status: 403 });
	}
	if (!authData.userPresent || !authData.userVerified) {
		throw Object.assign(new Error('Verificación biométrica requerida'), { status: 400 });
	}
}

async function getUserForSessionById(userId) {
	const result = await query(
		`SELECT u.id, u.nombre, u.email, u.empresa_id, COALESCE(u.token_version, 1) AS token_version, r.nombre AS rol
     FROM usuarios u
     JOIN usuarios_roles ur ON ur.usuario_id = u.id
     JOIN roles r ON r.id = ur.rol_id
     WHERE u.id = $1 AND u.activo = true
     LIMIT 1`,
		[userId],
	);
	return result.rows[0] || null;
}

export async function buildPasskeyRegisterOptions(req) {
	const userId = Number(req.user?.id || 0);
	if (!Number.isInteger(userId) || userId <= 0) {
		throw Object.assign(new Error('Sesión inválida'), { status: 401 });
	}

	const user = await getUserForSessionById(userId);
	if (!user) {
		throw Object.assign(new Error('Usuario no encontrado o inactivo'), { status: 401 });
	}

	const existing = await query(
		'SELECT credential_id, transports FROM usuario_passkeys WHERE usuario_id = $1',
		[userId],
	);
	const challenge = createChallenge();
	await storeChallenge({ challenge, type: 'registration', userId });

	return {
		options: {
			challenge,
			rp: {
				name: DEFAULT_RP_NAME,
				id: getRpId(req),
			},
			user: {
				id: base64UrlEncode(String(user.id)),
				name: user.email,
				displayName: user.nombre,
			},
			pubKeyCredParams: [
				{ type: 'public-key', alg: -7 },
				{ type: 'public-key', alg: -257 },
			],
			timeout: 60000,
			attestation: 'none',
			authenticatorSelection: {
				authenticatorAttachment: 'platform',
				residentKey: 'preferred',
				userVerification: 'required',
			},
			excludeCredentials: existing.rows.map((row) => ({
				id: row.credential_id,
				type: 'public-key',
				transports: row.transports || [],
			})),
		},
	};
}

export async function verifyPasskeyRegistration(req) {
	const credential = req.body?.credential;
	const clientData = parseClientData(
		credential,
		'webauthn.create',
		null,
		req,
	);
	const challenge = await consumeChallenge(clientData.parsed.challenge, 'registration');
	const userId = Number(req.user?.id || 0);
	if (Number(challenge.usuario_id) !== userId) {
		throw Object.assign(new Error('Challenge no pertenece al usuario'), { status: 403 });
	}

	const attestationObject = base64UrlDecode(credential?.response?.attestationObject);
	const { value: attestation } = decodeCborItem(attestationObject);
	const authDataBuffer = attestation.get('authData');
	const authData = parseAuthData(authDataBuffer);
	assertAuthData(authData, req);

	if (!authData.credentialId || !authData.credentialPublicKey) {
		throw Object.assign(new Error('Credencial WebAuthn incompleta'), { status: 400 });
	}

	const credentialId = base64UrlEncode(authData.credentialId);
	const publicKeyPem = coseKeyToPublicKeyPem(authData.credentialPublicKey);
	const transports = Array.isArray(credential.response?.transports)
		? credential.response.transports
		: [];

	await query(
		`INSERT INTO usuario_passkeys
       (usuario_id, credential_id, public_key_pem, sign_count, transports, device_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (credential_id) DO UPDATE
       SET usuario_id = EXCLUDED.usuario_id,
           public_key_pem = EXCLUDED.public_key_pem,
           sign_count = EXCLUDED.sign_count,
           transports = EXCLUDED.transports,
           last_used_at = NOW()`,
		[userId, credentialId, publicKeyPem, authData.signCount, transports, req.body?.device_name || null],
	);
}

export async function buildPasskeyLoginOptions(req) {
	const email = String(req.body?.email || '').trim().toLowerCase();
	let credentials = [];
	if (email) {
		const result = await query(
			`SELECT p.credential_id, p.transports
       FROM usuario_passkeys p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE LOWER(u.email) = $1 AND u.activo = true`,
			[email],
		);
		credentials = result.rows;
	}

	const challenge = createChallenge();
	await storeChallenge({ challenge, type: 'authentication', email: email || null });
	return {
		options: {
			challenge,
			timeout: 60000,
			rpId: getRpId(req),
			userVerification: 'required',
			allowCredentials: credentials.length
				? credentials.map((row) => ({
					id: row.credential_id,
					type: 'public-key',
					transports: row.transports || [],
				  }))
				: undefined,
		},
	};
}

export async function verifyPasskeyLogin(req) {
	const credential = req.body?.credential;
	const { parsed: parsedClientData, clientDataJSON } = parseClientData(
		credential,
		'webauthn.get',
		null,
		req,
	);
	await consumeChallenge(parsedClientData.challenge, 'authentication');

	const credentialId = String(credential?.id || '');
	const stored = await query(
		`SELECT p.id AS passkey_id, p.usuario_id, p.public_key_pem, p.sign_count,
            u.id, u.nombre, u.email, u.empresa_id, COALESCE(u.token_version, 1) AS token_version, r.nombre AS rol
     FROM usuario_passkeys p
     JOIN usuarios u ON u.id = p.usuario_id
     JOIN usuarios_roles ur ON ur.usuario_id = u.id
     JOIN roles r ON r.id = ur.rol_id
     WHERE p.credential_id = $1 AND u.activo = true
     LIMIT 1`,
		[credentialId],
	);
	if (!stored.rows.length) {
		throw Object.assign(new Error('Credencial biométrica no registrada'), { status: 401 });
	}

	const row = stored.rows[0];
	const authenticatorData = base64UrlDecode(credential.response.authenticatorData);
	const authData = parseAuthData(authenticatorData);
	assertAuthData(authData, req);

	const signatureBase = Buffer.concat([authenticatorData, sha256(clientDataJSON)]);
	const signature = base64UrlDecode(credential.response.signature);
	const valid = crypto.verify('sha256', signatureBase, row.public_key_pem, signature);
	if (!valid) {
		throw Object.assign(new Error('Firma biométrica inválida'), { status: 401 });
	}

	const previousCount = Number(row.sign_count || 0);
	if (authData.signCount > previousCount || previousCount === 0) {
		await query(
			`UPDATE usuario_passkeys
       SET sign_count = $1, last_used_at = NOW()
       WHERE id = $2`,
			[authData.signCount, row.passkey_id],
		);
	}

	return {
		id: row.id,
		nombre: row.nombre,
		email: row.email,
		empresa_id: row.empresa_id,
		token_version: row.token_version,
		rol: row.rol,
	};
}
