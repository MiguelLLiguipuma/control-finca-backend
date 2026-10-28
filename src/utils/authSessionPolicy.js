const sessions = new Map();
let revision = 0;
const normalizeRole = role => {
    const value = String(role || '').trim().toUpperCase();
    if (['TRABAJADOR', 'OPERARIO'].includes(value)) return 'OPERADOR';
    if (['ADMINISTRADOR', 'GERENTE'].includes(value)) return 'ADMIN';
    return value;
};

export function matchesCurrentIdentity(decoded, user) {
    const role = normalizeRole(user?.rol);
    return ['ADMIN', 'SUPERVISOR', 'OPERADOR'].includes(role) &&
        role === normalizeRole(decoded?.rol) &&
        Number(decoded?.eid || 0) === Number(user?.empresa_id || 0);
}

export function sessionCacheRevision() { return revision; }
export function getCachedSession(key) {
    const value = sessions.get(key);
    if (!value) return null;
    if (value.expiresAt <= Date.now()) { sessions.delete(key); return null; }
    return value.value;
}
export function setCachedSession(key, value, expectedRevision) {
    if (expectedRevision !== revision) return;
    const configured = Number(process.env.AUTH_SESSION_CACHE_TTL_MS ?? 30000);
    const ttl = Number.isFinite(configured) ? Math.max(0, Math.min(configured, 30000)) : 0;
    if (!ttl) return;
    if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    sessions.set(key, { value, expiresAt: Date.now() + ttl });
}
export function invalidateUserSessions(userId) {
    revision++;
    for (const key of sessions.keys()) {
        if (key.startsWith(`${Number(userId)}:`)) sessions.delete(key);
    }
}
