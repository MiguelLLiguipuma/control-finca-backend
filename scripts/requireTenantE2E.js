import { pathToFileURL } from 'node:url';

export function missingTenantEvidence(env) {
    const required = ['E2E_BASE_URL', 'E2E_TOKEN_OPERATOR', 'E2E_TOKEN_SUPERVISOR', 'E2E_TOKEN_ADMIN'];
    const missing = required.filter(key => !String(env[key] || '').trim());
    for (const key of ['E2E_FINCA_PERMITIDA', 'E2E_FINCA_NO_PERMITIDA', 'E2E_FINCA_OTRA_EMPRESA']) {
        const value = Number(env[key]);
        if (!Number.isSafeInteger(value) || value <= 0) missing.push(key);
    }
    const ids = ['E2E_FINCA_PERMITIDA', 'E2E_FINCA_NO_PERMITIDA', 'E2E_FINCA_OTRA_EMPRESA'].map(key => Number(env[key]));
    if (!missing.length && new Set(ids).size !== ids.length) missing.push('E2E_FINCA_* deben ser distintas');
    return missing;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const missing = missingTenantEvidence(process.env);
    if (missing.length) {
        console.error(`Publicacion bloqueada: faltan datos de prueba multitenant: ${missing.join(', ')}. Use un entorno de pruebas, no datos de clientes.`);
        process.exitCode = 1;
    }
}
