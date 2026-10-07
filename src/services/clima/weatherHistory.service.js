import { query } from '../../db/db.js';

const DAY_MS = 86400000;
export function validarConsultaClima(input, hoy) {
  const fincaId = Number(input?.finca_id);
  const desde = input?.desde;
  const hasta = input?.hasta;
  const fechaValida = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!Number.isSafeInteger(fincaId) || fincaId <= 0) throw Object.assign(new Error('Seleccione una finca valida.'), { status: 400 });
  if (!fechaValida(desde) || !fechaValida(hasta)) throw Object.assign(new Error('Las fechas deben ser fechas reales en formato YYYY-MM-DD.'), { status: 400 });
  const dias = (Date.parse(hasta) - Date.parse(desde)) / DAY_MS + 1;
  if (dias < 1 || dias > 366 || hasta > hoy) throw Object.assign(new Error('Seleccione un periodo de 1 a 366 dias, sin fechas futuras.'), { status: 400 });
  return { fincaId, desde, hasta, dias };
}

const numero = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export async function getWeatherHistory({ fincaId, desde, hasta, dias, hoy }, consultar = query) {
  const { rows: fincas } = await consultar('SELECT id, nombre, latitud, longitud FROM fincas WHERE id = $1', [fincaId]);
  const finca = fincas[0];
  if (!finca) throw Object.assign(new Error('Finca no encontrada o no disponible para esta sesion.'), { status: 404 });
  // The join also applies the existing tenant policies on fincas to climate rows.
  const { rows } = await consultar(`SELECT h.fecha::text AS fecha, h.temp_media, h.unidades_calor_dia,
      h.precipitacion_mm, h.actualizado_en
    FROM historial_clima_fincas h JOIN fincas f ON f.id = h.finca_id
    WHERE f.id = $1 AND h.fecha BETWEEN $2::date AND $3::date ORDER BY h.fecha`, [fincaId, desde, hasta]);
  const { rows: ultimos } = await consultar(`SELECT h.fecha::text AS fecha, h.actualizado_en
    FROM historial_clima_fincas h JOIN fincas f ON f.id = h.finca_id
    WHERE f.id = $1 AND h.fecha <= $2::date ORDER BY h.fecha DESC LIMIT 1`, [fincaId, hoy]);
  const ultimo = ultimos[0] || null;
  return {
    finca: { id: Number(finca.id), nombre: finca.nombre, latitud: numero(finca.latitud), longitud: numero(finca.longitud) },
    periodo: { desde, hasta, dias },
    ultima_fecha: ultimo?.fecha || null,
    ultima_actualizacion: ultimo?.actualizado_en || null,
    dias_atraso: ultimo ? Math.max(0, (Date.parse(hoy) - Date.parse(ultimo.fecha)) / DAY_MS) : null,
    metodologia: {
      tipo: 'MUESTRA_PUNTUAL', temperatura_base: 14, lluvia_diaria_disponible: false,
      fuente: 'Integracion actual: OpenWeather',
      nota: 'La captura actual usa temperatura puntual y lluvia de 1 h o 3 h; el historial no conserva esa ventana. Las UC se estiman con max(0, temperatura - 14). No son diarios consolidados ni mediciones de una estacion en la finca.',
    },
    registros: rows.map(row => ({ fecha: row.fecha, temp_media: numero(row.temp_media),
      unidades_calor_dia: numero(row.unidades_calor_dia), precipitacion_mm: numero(row.precipitacion_mm), actualizado_en: row.actualizado_en })),
  };
}
