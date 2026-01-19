import jwt from 'jsonwebtoken';

export const verificarSesion = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ message: 'No hay token, acceso denegado' });
	}

	try {
		// IMPORTANTE: Asegúrate que JWT_SECRET esté en tu .env
		const cifrado = jwt.verify(token, process.env.JWT_SECRET);
		req.user = cifrado;
		next();
	} catch (error) {
		return res.status(403).json({ message: 'Token no válido o expirado' });
	}
};
