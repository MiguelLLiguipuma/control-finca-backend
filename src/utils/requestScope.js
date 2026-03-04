import { AsyncLocalStorage } from 'async_hooks';

const requestScopeStorage = new AsyncLocalStorage();

export function runWithRequestScope(baseContext, callback) {
	const context = {
		requestId: baseContext?.requestId || null,
		userId: null,
		empresaId: null,
		role: null,
		allowedFincaIds: [],
	};
	return requestScopeStorage.run(context, callback);
}

export function setRequestAuthScope(authContext = {}) {
	const store = requestScopeStorage.getStore();
	if (!store) return;

	store.userId = Number(authContext.userId || 0) || null;
	store.empresaId = Number(authContext.empresaId || 0) || null;
	store.role = authContext.role ? String(authContext.role) : null;
	store.allowedFincaIds = Array.isArray(authContext.allowedFincaIds)
		? authContext.allowedFincaIds
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0)
		: [];
}

export function getRequestScope() {
	return requestScopeStorage.getStore() || null;
}
