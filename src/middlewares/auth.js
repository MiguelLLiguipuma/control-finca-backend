import jwt from 'jsonwebtoken';

export const verificarSesion = (req, res, next) => {
	const authHeader = req.headers['authorization'];

	// 1. Verificación de formato Bearer
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({
			message: 'Acceso denegado: Formato de autenticación inválido',
		});
	}

	const token = authHeader.split(' ')[1];

	try {
		// 2. Verificación del Secreto
		if (!process.env.JWT_SECRET) {
			console.error(
				'❌ ERROR CRÍTICO: JWT_SECRET no definido en variables de entorno',
			);
			return res
				.status(500)
				.json({ message: 'Error interno de configuración' });
		}

		const cifrado = jwt.verify(token, process.env.JWT_SECRET);

		// 3. Inyectamos los datos del usuario en el request
		req.user = cifrado;

		next();
	} catch (error) {
		// 4. Diferenciamos entre token expirado y token malformado para los logs
		const mensaje =
			error.name === 'TokenExpiredError'
				? 'Sesión expirada, ingrese nuevamente'
				: 'Token de seguridad no válido';

		console.error(`🔐 Error Auth: ${error.message}`);

		return res.status(403).json({ message: mensaje });
	}
};
