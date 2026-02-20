import { EmbarqueService } from '../services/embarqueService.js';

function responderError(res, error, scope = 'embarque') {
	const status = Number(error?.status) || 500;
	if (status >= 500) {
		console.error(`Error ${scope}:`, error);
	}
	return res.status(status).json({
		success: false,
		error: error?.message || 'Error interno del servidor',
	});
}

export const getPreliquidacionEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.getPreliquidacion(req.query || {});
		return res.json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'getPreliquidacionEmbarque');
	}
};

export const crearVoucherEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.crearVoucher(req.body, {
			usuarioIdSesion: req.user?.id,
		});
		return res.status(201).json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'crearVoucherEmbarque');
	}
};

export const actualizarVoucherEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.actualizarVoucher(req.params.id, req.body, {
			usuarioIdSesion: req.user?.id,
		});
		return res.json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'actualizarVoucherEmbarque');
	}
};

export const confirmarVoucherEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.confirmarVoucher(req.params.id, req.body, {
			usuarioIdSesion: req.user?.id,
		});
		const code = data.duplicated ? 200 : 201;
		return res.status(code).json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'confirmarVoucherEmbarque');
	}
};

export const anularVoucherEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.anularVoucher(req.params.id, req.body, {
			usuarioIdSesion: req.user?.id,
		});
		return res.json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'anularVoucherEmbarque');
	}
};

export const getVoucherEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.getVoucher(req.params.id);
		return res.json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'getVoucherEmbarque');
	}
};

export const listVouchersEmbarque = async (req, res) => {
	try {
		const data = await EmbarqueService.listVouchers(req.query || {});
		return res.json({ success: true, data });
	} catch (error) {
		return responderError(res, error, 'listVouchersEmbarque');
	}
};
