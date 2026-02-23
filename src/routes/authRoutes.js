import express from 'express';
import { googleLogin, login, register } from '../controllers/authController.js';
import { createRateLimit } from '../middlewares/rateLimitSimple.js';

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

export default router;
