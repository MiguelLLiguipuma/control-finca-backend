import express from 'express';
import { login } from '../controllers/authController.js';

const router = express.Router();

// Esta es la ruta que llamará tu frontend: http://localhost:4000/api/auth/login
router.post('/login', login);

export default router;
