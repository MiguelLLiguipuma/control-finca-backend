import express from 'express';
import {
	googleLogin,
	login,
	passkeyLoginOptions,
	passkeyLoginVerify,
	passkeyRegisterOptions,
	passkeyRegisterVerify,
	register,
} from '../controllers/authController.js';
import { createRateLimit } from '../middlewares/rateLimitSimple.js';
import { verificarSesion } from '../middlewares/auth.js';

const router = express.Router();

const loginLimiter = createRateLimit({
	windowMs: 10 * 60 * 1000,
	max: 8,
	keyFn: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
	message: 'Demasiados intentos de login. Espere unos minutos e intente nuevamente.',
});

router.post('/login', loginLimiter, login);
router.post('/register', loginLimiter, register);
router.post('/google', loginLimiter, googleLogin);
router.post('/passkeys/register/options', verificarSesion, passkeyRegisterOptions);
router.post('/passkeys/register/verify', verificarSesion, passkeyRegisterVerify);
router.post('/passkeys/login/options', loginLimiter, passkeyLoginOptions);
router.post('/passkeys/login/verify', loginLimiter, passkeyLoginVerify);

export default router;
