import express from 'express';
import { verificarSesion } from '../middlewares/auth.js';
import {
	actualizarVoucherEmbarque,
	anularVoucherEmbarque,
	confirmarVoucherEmbarque,
	crearVoucherEmbarque,
	getPreliquidacionEmbarque,
	getVoucherEmbarque,
	listVouchersEmbarque,
} from '../controllers/embarqueController.js';

const router = express.Router();

router.use(verificarSesion);

router.get('/preliquidacion', getPreliquidacionEmbarque);
router.post('/vouchers', crearVoucherEmbarque);
router.put('/vouchers/:id', actualizarVoucherEmbarque);
router.post('/vouchers/:id/confirmar', confirmarVoucherEmbarque);
router.post('/vouchers/:id/anular', anularVoucherEmbarque);
router.get('/vouchers/:id', getVoucherEmbarque);
router.get('/vouchers', listVouchersEmbarque);

export default router;
