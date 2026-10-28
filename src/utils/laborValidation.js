const invalido = message => Object.assign(new Error(message), { status: 400 });

export function hoyLabores() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function validarFechaLabor(fecha, hoy = hoyLabores()) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha.startsWith('0000-') ||
      !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha || fecha > hoy) {
    throw invalido('La fecha debe ser real y no futura.');
  }
  return fecha;
}

export function validarObservacionesLabor(value) {
  const observaciones = value == null ? '' : value;
  if (typeof observaciones !== 'string' || observaciones.length > 1000 || observaciones.includes('\0')) {
    throw invalido('Las observaciones deben ser texto valido de hasta 1000 caracteres.');
  }
  return observaciones.trim();
}

export function enteroLabor(value, max = Number.MAX_SAFE_INTEGER) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !/^\d+$/.test(value))) return null;
  const numero = Number(value);
  return Number.isSafeInteger(numero) && numero > 0 && numero <= max ? numero : null;
}
