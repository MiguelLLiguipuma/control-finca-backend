export const PERMISSIONS_MATRIX = [
	{ method: 'GET', path: '/api/empresas', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{ method: 'POST', path: '/api/empresas', roles: ['ADMIN'] },
	{ method: 'PUT', path: '/api/empresas/:id', roles: ['ADMIN'] },
	{ method: 'DELETE', path: '/api/empresas/:id', roles: ['ADMIN'] },

	{
		method: 'GET',
		path: '/api/calendarios-enfunde',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
	{ method: 'POST', path: '/api/calendarios-enfunde', roles: ['ADMIN', 'SUPERVISOR'] },
	{
		method: 'PUT',
		path: '/api/calendarios-enfunde/:id',
		roles: ['ADMIN', 'SUPERVISOR'],
	},
	{
		method: 'DELETE',
		path: '/api/calendarios-enfunde/:id',
		roles: ['ADMIN', 'SUPERVISOR'],
	},

	{ method: 'GET', path: '/api/cintas', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{ method: 'POST', path: '/api/cintas', roles: ['ADMIN', 'SUPERVISOR'] },
	{ method: 'PUT', path: '/api/cintas/:id', roles: ['ADMIN', 'SUPERVISOR'] },
	{ method: 'DELETE', path: '/api/cintas/:id', roles: ['ADMIN', 'SUPERVISOR'] },

	{ method: 'GET', path: '/api/usuarios', roles: ['ADMIN'] },
	{ method: 'POST', path: '/api/usuarios', roles: ['ADMIN'] },
	{ method: 'PUT', path: '/api/usuarios/:id', roles: ['ADMIN'] },
	{ method: 'DELETE', path: '/api/usuarios/:id', roles: ['ADMIN'] },
	{ method: 'PUT', path: '/api/usuarios/:id/fincas', roles: ['ADMIN'] },

	{ method: 'GET', path: '/api/reportes/auditoria', roles: ['ADMIN', 'SUPERVISOR'] },
	{
		method: 'GET',
		path: '/api/reportes/score-salud/:fincaId/:anio',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
	{
		method: 'POST',
		path: '/api/cosecha/registrar-liquidacion',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
	{
		method: 'GET',
		path: '/api/cosecha/inventario-historico',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
	{
		method: 'POST',
		path: '/api/cosecha/inventario-historico/cerrar',
		roles: ['ADMIN', 'SUPERVISOR'],
	},
	{
		method: 'GET',
		path: '/api/cosecha/prediccion-multi',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
	{ method: 'GET', path: '/api/clima/status', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{ method: 'POST', path: '/api/clima/sync', roles: ['ADMIN', 'SUPERVISOR'] },
	{ method: 'GET', path: '/api/alertas', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{ method: 'GET', path: '/api/alertas/resumen', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{ method: 'POST', path: '/api/alertas/generar', roles: ['ADMIN', 'SUPERVISOR'] },
	{ method: 'PATCH', path: '/api/alertas/:id/leida', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{ method: 'PATCH', path: '/api/alertas/:id/resolver', roles: ['ADMIN', 'SUPERVISOR'] },
	{ method: 'POST', path: '/api/embarque/vouchers', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{
		method: 'POST',
		path: '/api/embarque/vouchers/:id/confirmar',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
];
