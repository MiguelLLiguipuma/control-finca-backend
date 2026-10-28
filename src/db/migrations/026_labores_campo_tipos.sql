ALTER TABLE labores_suelo DROP CONSTRAINT labores_suelo_tipo_check;
ALTER TABLE labores_suelo ADD CONSTRAINT labores_suelo_tipo_check
  CHECK (tipo IN ('fertilizacion', 'herbicida', 'roza', 'deshoje', 'deshije', 'riego', 'drenaje'));
