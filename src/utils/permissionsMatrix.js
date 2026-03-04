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
	{ method: 'POST', path: '/api/embarque/vouchers', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
	{
		method: 'POST',
		path: '/api/embarque/vouchers/:id/confirmar',
		roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'],
	},
];
