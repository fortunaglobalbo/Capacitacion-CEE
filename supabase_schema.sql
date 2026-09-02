-- =============================================================
-- SCHEMA COMPLETO - SISTEMA DE CONTROL DE MAESTROS
-- Base de datos: Supabase (PostgreSQL)
-- Fecha de última actualización: 2026-08-09
-- =============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 1. TABLA: tecnicos
-- Equivalente a la hoja TECNICO del sistema original
-- =============================================================
CREATE TABLE IF NOT EXISTS tecnicos (
  carnet TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE tecnicos IS 'Técnicos responsables del seguimiento de cursos UNEFCO';
COMMENT ON COLUMN tecnicos.carnet IS 'Carnet o ID único del técnico';
COMMENT ON COLUMN tecnicos.nombre IS 'Nombre completo del técnico';

-- =============================================================
-- 2. TABLA: facilitadores
-- Equivalente a la hoja FACILITADOR del sistema original
-- =============================================================
CREATE TABLE IF NOT EXISTS facilitadores (
  carnet TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE facilitadores IS 'Facilitadores que imparten los cursos';
COMMENT ON COLUMN facilitadores.carnet IS 'Carnet o ID único del facilitador';
COMMENT ON COLUMN facilitadores.nombre IS 'Nombre completo del facilitador';

-- =============================================================
-- 3. TABLA: ciclos_formativos
-- Equivalente a la hoja CICLOS FORMATIVOS del sistema original
-- Cada fila tiene: id, grupo, nombre, tema1, tema2, tema3, tema4
-- =============================================================
CREATE TABLE IF NOT EXISTS ciclos_formativos (
  id TEXT PRIMARY KEY,
  grupo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  area_formativa TEXT,
  tema1 TEXT,
  tema2 TEXT,
  tema3 TEXT,
  tema4 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE ciclos_formativos IS 'Catálogo de ciclos formativos agrupados por nivel educativo';
COMMENT ON COLUMN ciclos_formativos.grupo IS 'Grupo del ciclo: PARA TODOS LOS ACTORES DEL SEP, EDUCACION PRIMARIA, etc.';
COMMENT ON COLUMN ciclos_formativos.nombre IS 'Nombre del ciclo formativo';
COMMENT ON COLUMN ciclos_formativos.tema1 IS 'Tema del curso 1 (C1)';
COMMENT ON COLUMN ciclos_formativos.tema2 IS 'Tema del curso 2 (C2)';
COMMENT ON COLUMN ciclos_formativos.tema3 IS 'Tema del curso 3 (C3)';
COMMENT ON COLUMN ciclos_formativos.tema4 IS 'Tema del curso 4 (C4)';

-- =============================================================
-- 4. TABLA: cursos
-- Tabla principal de notas / cursos
-- =============================================================
CREATE TABLE IF NOT EXISTS cursos (
  id TEXT PRIMARY KEY,
  tecnico_carnet TEXT REFERENCES tecnicos(carnet) ON DELETE SET NULL,
  ciclo_id TEXT REFERENCES ciclos_formativos(id) ON DELETE SET NULL,
  facilitador_carnet TEXT REFERENCES facilitadores(carnet) ON DELETE SET NULL,
  distrito TEXT,
  lugar TEXT,
  area_urbano_rural TEXT,
  segmento TEXT,
  fecha_inicio TEXT,
  estado TEXT DEFAULT 'POR EJECUTAR',
  observaciones TEXT,
  mostrar TEXT DEFAULT 'M',
  inscritos INTEGER DEFAULT 0,
  costo NUMERIC(10,2) DEFAULT 0,
  total_bs NUMERIC(10,2) DEFAULT 0,
  organizador_nombre TEXT,
  organizador_telefono TEXT,
  organizador_lugar TEXT,
  organizador_maps TEXT,
  organizador_descripcion TEXT,
  organizador_semaforo TEXT DEFAULT 'Atendido',
  organizador_color TEXT DEFAULT '#3b82f6',
  link_archivo TEXT,
  link_sheet_participantes TEXT,
  mes TEXT,
  part TEXT,
  prev TEXT,
  form_url TEXT,
  grupo_nombre TEXT,
  grupo_color TEXT DEFAULT '#2f80ed',
  grupo_tipo TEXT,
  horarios_tentativos JSONB DEFAULT '[]'::jsonb,
  inscritos_formulario INTEGER DEFAULT 0,
  inscritos_id INTEGER DEFAULT 0,
  link_inscripcion_externo TEXT,
  planificacion_recibida BOOLEAN DEFAULT false,
  evaluacion_realizada BOOLEAN DEFAULT false,
  informe_final_recibido BOOLEAN DEFAULT false,
  registrado_sie BOOLEAN DEFAULT false,
  conforme BOOLEAN DEFAULT false,
  total_participantes INTEGER DEFAULT 0,
  total_aprobados INTEGER DEFAULT 0,
  total_reprobados INTEGER DEFAULT 0,
  form_habilitado BOOLEAN DEFAULT true,
  mostrar_whatsapp BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE cursos IS 'Tabla principal de cursos/notas - equivale a CONEXION en Google Sheets';
COMMENT ON COLUMN cursos.id IS 'Identificador único del curso (ej: 10001)';
COMMENT ON COLUMN cursos.fecha_inicio IS 'Fecha de inicio del curso como texto (puede incluir hora)';
COMMENT ON COLUMN cursos.estado IS 'Estado operativo: POR EJECUTAR, EJECUTADO';
COMMENT ON COLUMN cursos.mostrar IS 'Visibilidad de la nota: M (mostrar) o N (no mostrar)';
COMMENT ON COLUMN cursos.prev IS 'Número preventivo';
COMMENT ON COLUMN cursos.grupo_nombre IS 'Nombre del grupo operativo al que pertenece la nota';
COMMENT ON COLUMN cursos.grupo_color IS 'Color hexadecimal asociado a la nota/grupo';
COMMENT ON COLUMN cursos.horarios_tentativos IS 'JSON con calendario de actividades: C1-C4, SOC1-4, EVAL1-4 con fechas y horas';
COMMENT ON COLUMN cursos.link_sheet_participantes IS 'Link al Google Sheets externo de participantes (campo crítico)';
COMMENT ON COLUMN cursos.form_url IS 'URL del formulario de preinscripción';
COMMENT ON COLUMN cursos.inscritos_formulario IS 'Conteo de inscritos por respuestas de formulario';
COMMENT ON COLUMN cursos.inscritos_id IS 'Conteo de participantes oficiales desde pestaña ID';
COMMENT ON COLUMN cursos.planificacion_recibida IS 'Check: planificación recibida';
COMMENT ON COLUMN cursos.evaluacion_realizada IS 'Check: evaluación/verificador realizado';
COMMENT ON COLUMN cursos.informe_final_recibido IS 'Check: informe final recibido';

CREATE INDEX idx_cursos_tecnico ON cursos(tecnico_carnet);
CREATE INDEX idx_cursos_ciclo ON cursos(ciclo_id);
CREATE INDEX idx_cursos_facilitador ON cursos(facilitador_carnet);
CREATE INDEX idx_cursos_grupo ON cursos(grupo_nombre);
CREATE INDEX idx_cursos_estado ON cursos(estado);
CREATE INDEX idx_cursos_mes ON cursos(mes);
CREATE INDEX idx_cursos_mostrar ON cursos(mostrar);
CREATE INDEX idx_cursos_prev ON cursos(prev);

-- =============================================================
-- 6. TABLA: sie_ue
-- Catálogo de código SIE y unidades educativas
-- Equivalente a la hoja SIE UE del sistema original
-- =============================================================
CREATE TABLE IF NOT EXISTS sie_ue (
  codigo_sie TEXT PRIMARY KEY,
  unidad_educativa TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE sie_ue IS 'Catálogo de unidades educativas con código SIE';

-- =============================================================
-- 7. TABLA: participantes
-- =============================================================
CREATE TABLE IF NOT EXISTS participantes (
  ci TEXT PRIMARY KEY,
  apellidos TEXT NOT NULL,
  nombres TEXT NOT NULL,
  rda TEXT,
  celular TEXT,
  sie TEXT,
  unidad_educativa TEXT,
  validado BOOLEAN DEFAULT false,
  observaciones_sie TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE participantes IS 'Tabla central de datos personales únicos de los participantes';

-- =============================================================
-- 7b. TABLA: inscripcion_ciclo (Relación muchos-a-muchos)
-- =============================================================
CREATE TABLE IF NOT EXISTS inscripcion_ciclo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  curso_id TEXT REFERENCES cursos(id) ON DELETE CASCADE,
  participante_ci TEXT REFERENCES participantes(ci) ON DELETE CASCADE,
  nro INTEGER,
  pagos TEXT DEFAULT 'Pendiente',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(curso_id, participante_ci)
);

COMMENT ON TABLE inscripcion_ciclo IS 'Tabla intermedia que registra la inscripción de participantes en ciclos formativos';

CREATE INDEX idx_inscripcion_ciclo_curso ON inscripcion_ciclo(curso_id);
CREATE INDEX idx_inscripcion_ciclo_ci ON inscripcion_ciclo(participante_ci);

-- =============================================================
-- 8. TABLA: sync_log
-- Registro de sincronizaciones entre Supabase y Google Sheets
-- =============================================================
CREATE TABLE IF NOT EXISTS sync_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  operacion TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE sync_log IS 'Log de sincronización entre Supabase y Google Sheets';

CREATE INDEX idx_sync_estado ON sync_log(estado);

-- =============================================================
-- 9. FUNCIONES Y TRIGGERS
-- =============================================================

-- Función genérica para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at para cada tabla principal
CREATE TRIGGER trg_tecnicos_updated
  BEFORE UPDATE ON tecnicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_facilitadores_updated
  BEFORE UPDATE ON facilitadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ciclos_updated
  BEFORE UPDATE ON ciclos_formativos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agenda_updated
  BEFORE UPDATE ON agenda_contactos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cursos_updated
  BEFORE UPDATE ON cursos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_participantes_updated
  BEFORE UPDATE ON participantes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_inscripcion_ciclo_updated
  BEFORE UPDATE ON inscripcion_ciclo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- Por ahora desactivado - se activará cuando se implemente auth
-- =============================================================
ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilitadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ciclos_formativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sie_ue ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscripcion_ciclo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Políticas públicas temporales (sin auth)
-- Permiten lectura y escritura desde la anon key
CREATE POLICY "Allow all for tecnicos" ON tecnicos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for facilitadores" ON facilitadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for ciclos_formativos" ON ciclos_formativos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for agenda_contactos" ON agenda_contactos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for cursos" ON cursos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for sie_ue" ON sie_ue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for participantes" ON participantes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for inscripcion_ciclo" ON inscripcion_ciclo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for sync_log" ON sync_log FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- 11. DATOS DE EJEMPLO (SEED)
-- =============================================================

-- Técnicos de ejemplo / oficiales
INSERT INTO tecnicos (carnet, nombre) VALUES
  ('8639300', 'Gilmar Felix Chavarria Choque'),
  ('7782629', 'Juan Pablo Alba Vaca'),
  ('3355859', 'Claudia Lisett Olivares Rivero'),
  ('GARAY001', 'GARAY FLORES VIOLETA ANGELA')
ON CONFLICT (carnet) DO NOTHING;

-- Facilitadores de ejemplo
INSERT INTO facilitadores (carnet, nombre) VALUES
  ('FAC001', 'Ana Torres Condori'),
  ('FAC002', 'Pedro Vargas Choque'),
  ('FAC003', 'Rosa Gutiérrez Apaza'),
  ('FAC004', 'Luis Mamani Callisaya')
ON CONFLICT (carnet) DO NOTHING;

-- Ciclos formativos de ejemplo
INSERT INTO ciclos_formativos (id, grupo, nombre, area_formativa, tema1, tema2, tema3, tema4) VALUES
  ('CF001', 'PARA TODOS LOS ACTORES DEL SEP', 'Gestión Educativa Participativa', 'Gestión', 'Planificación institucional', 'Gestión curricular', 'Evaluación participativa', 'Sistematización de experiencias'),
  ('CF002', 'PARA TODOS LOS ACTORES DEL SEP', 'Convivencia Escolar', 'Convivencia', 'Marco normativo', 'Resolución de conflictos', 'Cultura de paz', 'Protocolos institucionales'),
  ('CF003', 'EDUCACION PRIMARIA COMUNITARIA VOCACIONAL', 'Didáctica de Matemáticas', 'Matemáticas', 'Números y operaciones', 'Geometría y medida', 'Estadística', 'Razonamiento lógico'),
  ('CF004', 'EDUCACION SECUNDARIA COMUNITARIA PRODUCTIVA', 'Producción de Textos', 'Comunicación y Lenguajes', 'Tipología textual', 'Escritura creativa', 'Textos académicos', 'Publicación y difusión'),
  ('CF005', 'EDUCACION INICIAL EN FAMILIA COMUNITARIA', 'Desarrollo Infantil Integral', 'Desarrollo Integral', 'Desarrollo psicomotor', 'Estimulación temprana', 'Nutrición infantil', 'Vínculo familia-escuela'),
  ('CF006', 'EDUCACION ALTERNATIVA', 'Educación de Adultos', 'Alternativa', 'Andragogía', 'Alfabetización digital', 'Proyecto de vida', 'Emprendimiento comunitario')
ON CONFLICT (id) DO NOTHING;

-- Agenda de contactos de ejemplo
INSERT INTO agenda_contactos (id_contacto, tecnico_carnet, nombre, telefono, lugar, link_maps, descripcion, estado_semaforo, color) VALUES
  ('AGD001', 'TEC001', 'Prof. Roberto Quispe', '71234567', 'U.E. Simón Bolívar - El Alto', 'https://maps.app.goo.gl/example1', 'Director de la unidad educativa, disponible por las mañanas', 'Pendiente', '#2f80ed'),
  ('AGD002', 'TEC001', 'Lic. Carmen Flores', '72345678', 'U.E. Mariscal Sucre - La Paz', 'https://maps.app.goo.gl/example2', 'Coordinadora pedagógica', 'Atendido', '#2e9f5e'),
  ('AGD003', 'TEC002', 'Prof. Daniel Mamani', '73456789', 'Núcleo Educativo Viacha', '', 'Responsable del núcleo, coordinar con anticipación', 'Pendiente', '#fbbc05'),
  ('AGD004', 'TEC002', 'Lic. Silvia Condori', '74567890', 'U.E. Franz Tamayo - Oruro', 'https://maps.app.goo.gl/example4', 'Directora distrital adjunta', 'Atendido', '#8e44ad'),
  ('AGD005', 'TEC003', 'Prof. Miguel Apaza', '75678901', 'Centro de Formación Comunitaria Achacachi', '', 'Facilitador local de apoyo', 'Pendiente', '#2f80ed')
ON CONFLICT (id_contacto) DO NOTHING;

-- Cursos de ejemplo con datos completos
INSERT INTO cursos (
  id, tecnico_carnet, ciclo_id, facilitador_carnet, distrito, lugar,
  area_urbano_rural, segmento, fecha_inicio, estado, observaciones,
  mostrar, inscritos, costo, total_bs, contacto_agenda,
  mes, prev, grupo_nombre, grupo_color, grupo_tipo,
  horarios_tentativos, inscritos_formulario, inscritos_id,
  planificacion_recibida, evaluacion_realizada, informe_final_recibido
) VALUES
  (
    '10001', 'TEC001', 'CF001', 'FAC001', 'La Paz 1', 'U.E. Simón Bolívar',
    'Urbano', 'Docentes', '2026-06-10 08:00', 'POR EJECUTAR', 'Grupo grande, coordinar aula magna',
    'M', 35, 50.00, 1750.00, 'AGD001',
    'JUNIO', '1001', 'Grupo Norte', '#2f80ed', 'regular',
    '[{"date":"2026-06-10","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-06-11","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-06-17","startTime":"08:00","endTime":"12:00","hours":4,"course":2},{"date":"2026-06-24","startTime":"14:00","endTime":"18:00","hours":4,"course":"soc1"},{"date":"2026-07-01","startTime":"08:00","endTime":"12:00","hours":4,"course":3}]'::jsonb,
    28, 25,
    true, false, false
  ),
  (
    '10002', 'TEC001', 'CF002', 'FAC002', 'La Paz 1', 'U.E. Mariscal Sucre',
    'Urbano', 'Directores', '2026-06-15 14:00', 'POR EJECUTAR', '',
    'M', 22, 50.00, 1100.00, 'AGD002',
    'JUNIO', '1002', 'Grupo Norte', '#2f80ed', 'regular',
    '[{"date":"2026-06-15","startTime":"14:00","endTime":"18:00","hours":4,"course":1},{"date":"2026-06-22","startTime":"14:00","endTime":"18:00","hours":4,"course":2}]'::jsonb,
    18, 20,
    false, false, false
  ),
  (
    '10003', 'TEC001', 'CF003', 'FAC003', 'El Alto 1', 'Centro Comunitario Villa Adela',
    'Urbano', 'Docentes', '2026-05-20 08:00', 'EJECUTADO', 'Curso completado exitosamente',
    'M', 40, 50.00, 2000.00, NULL,
    'MAYO', '1003', 'Grupo Sur', '#2e9f5e', 'regular',
    '[{"date":"2026-05-20","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-05-21","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-05-27","startTime":"08:00","endTime":"12:00","hours":4,"course":2},{"date":"2026-06-03","startTime":"08:00","endTime":"12:00","hours":4,"course":"soc1"},{"date":"2026-06-10","startTime":"14:00","endTime":"16:00","hours":2,"course":"eval1"},{"date":"2026-06-17","startTime":"08:00","endTime":"12:00","hours":4,"course":3},{"date":"2026-06-24","startTime":"08:00","endTime":"12:00","hours":4,"course":"soc2"}]'::jsonb,
    38, 36,
    true, true, false
  ),
  (
    '10004', 'TEC002', 'CF004', 'FAC004', 'Oruro 1', 'U.E. Franz Tamayo',
    'Urbano', 'Docentes', '2026-07-05 08:00', 'POR EJECUTAR', 'Confirmar disponibilidad de aula',
    'M', 30, 50.00, 1500.00, 'AGD004',
    'JULIO', '1004', 'Grupo Oruro', '#8e44ad', 'regular',
    '[{"date":"2026-07-05","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-07-12","startTime":"08:00","endTime":"12:00","hours":4,"course":2}]'::jsonb,
    0, 0,
    false, false, false
  ),
  (
    '10005', 'TEC002', 'CF001', 'FAC001', 'Oruro 2', 'Núcleo Educativo Caracollo',
    'Rural', 'Docentes', '2026-06-20 09:00', 'POR EJECUTAR', 'Zona rural, verificar acceso',
    'M', 25, 50.00, 1250.00, NULL,
    'JUNIO', '1005', 'Grupo Oruro', '#8e44ad', 'regular',
    '[{"date":"2026-06-20","startTime":"09:00","endTime":"13:00","hours":4,"course":1}]'::jsonb,
    12, 0,
    false, false, false
  ),
  (
    '10006', 'TEC003', 'CF005', 'FAC002', 'Cochabamba 1', 'Centro de Formación Comunitaria',
    'Urbano', 'Docentes', '2026-06-08 08:00', 'POR EJECUTAR', 'Requiere proyector',
    'M', 28, 50.00, 1400.00, 'AGD005',
    'JUNIO', '1006', 'Grupo Cochabamba', '#e91e63', 'regular',
    '[{"date":"2026-06-08","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-06-09","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-06-15","startTime":"08:00","endTime":"12:00","hours":4,"course":2},{"date":"2026-06-22","startTime":"14:00","endTime":"17:00","hours":3,"course":"soc1"}]'::jsonb,
    22, 18,
    true, false, false
  ),
  (
    '10007', 'TEC003', 'CF006', 'FAC003', 'Cochabamba 2', 'U.E. Gualberto Villarroel',
    'Urbano', 'Directores', '2026-06-25 14:00', 'POR EJECUTAR', '',
    'M', 18, 50.00, 900.00, NULL,
    'JUNIO', '', 'Grupo Cochabamba', '#e91e63', 'regular',
    '[]'::jsonb,
    5, 0,
    false, false, false
  ),
  (
    '10008', 'TEC001', 'CF003', 'FAC004', 'La Paz 2', 'U.E. Eduardo Avaroa',
    'Urbano', 'Docentes', '2026-04-15 08:00', 'EJECUTADO', 'Completado con éxito, 100% asistencia',
    'M', 32, 50.00, 1600.00, 'AGD002',
    'ABRIL', '1008', 'Grupo Norte', '#2f80ed', 'regular',
    '[{"date":"2026-04-15","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-04-16","startTime":"08:00","endTime":"12:00","hours":4,"course":1},{"date":"2026-04-22","startTime":"08:00","endTime":"12:00","hours":4,"course":2},{"date":"2026-04-29","startTime":"14:00","endTime":"17:00","hours":3,"course":"soc1"},{"date":"2026-05-06","startTime":"08:00","endTime":"12:00","hours":4,"course":3},{"date":"2026-05-13","startTime":"14:00","endTime":"17:00","hours":3,"course":"soc2"},{"date":"2026-05-20","startTime":"08:00","endTime":"10:00","hours":2,"course":"eval1"},{"date":"2026-05-27","startTime":"08:00","endTime":"12:00","hours":4,"course":4},{"date":"2026-06-03","startTime":"14:00","endTime":"17:00","hours":3,"course":"soc3"},{"date":"2026-06-10","startTime":"08:00","endTime":"10:00","hours":2,"course":"eval2"}]'::jsonb,
    32, 30,
    true, true, true
  )
ON CONFLICT (id) DO NOTHING;

-- SIE de ejemplo
INSERT INTO sie_ue (codigo_sie, unidad_educativa) VALUES
  ('80730001', 'U.E. Simón Bolívar'),
  ('80730002', 'U.E. Mariscal Sucre'),
  ('80730003', 'U.E. Franz Tamayo'),
  ('80730004', 'U.E. Eduardo Avaroa'),
  ('80730005', 'U.E. Gualberto Villarroel'),
  ('80730006', 'Centro Comunitario Villa Adela'),
  ('80730007', 'Núcleo Educativo Caracollo'),
  ('80730008', 'Centro de Formación Comunitaria Achacachi')
ON CONFLICT (codigo_sie) DO NOTHING;

-- Seed de participantes de ejemplo
INSERT INTO participantes (ci, apellidos, nombres, rda, celular, sie, unidad_educativa) VALUES
  ('1234567', 'Quispe Mamani', 'Juan Carlos', 'RDA001', '71111111', '80730001', 'U.E. Simón Bolívar'),
  ('2345678', 'Flores Condori', 'María Elena', 'RDA002', '72222222', '80730002', 'U.E. Mariscal Sucre'),
  ('3456789', 'Huanca Torres', 'Pedro', 'RDA003', '73333333', '80730001', 'U.E. Simón Bolívar'),
  ('4567890', 'Apaza López', 'Rosa', 'RDA004', '74444444', '80730003', 'U.E. Franz Tamayo'),
  ('5678901', 'Condori Vargas', 'Luis Alberto', 'RDA005', '75555555', '80730004', 'U.E. Eduardo Avaroa')
ON CONFLICT (ci) DO NOTHING;

-- Seed de inscripciones en cursos (inscripcion_ciclo)
INSERT INTO inscripcion_ciclo (curso_id, participante_ci, nro, pagos, observaciones) VALUES
  ('10003', '1234567', 1, 'Pagado', ''),
  ('10003', '2345678', 2, 'Pagado', ''),
  ('10003', '3456789', 3, 'Pendiente', 'Solicita factura'),
  ('10003', '4567890', 4, 'Pagado', ''),
  ('10003', '5678901', 5, 'Pagado', '')
ON CONFLICT DO NOTHING;

-- =============================================================
-- 12. VISTAS ÚTILES
-- =============================================================

-- Vista de cursos con datos enriquecidos
CREATE OR REPLACE VIEW cursos_enriquecidos AS
SELECT
  c.*,
  t.nombre AS tecnico_nombre,
  f.nombre AS facilitador_nombre,
  cf.nombre AS ciclo_nombre,
  cf.grupo AS ciclo_grupo,
  cf.area_formativa,
  cf.tema1, cf.tema2, cf.tema3, cf.tema4
FROM cursos c
LEFT JOIN tecnicos t ON c.tecnico_carnet = t.carnet
LEFT JOIN facilitadores f ON c.facilitador_carnet = f.carnet
LEFT JOIN ciclos_formativos cf ON c.ciclo_id = cf.id;

COMMENT ON VIEW cursos_enriquecidos IS 'Vista con todos los datos de cursos enriquecidos con nombres de técnico, facilitador y ciclo';

-- =============================================================
-- 13. TABLA: plantillas_reporte
-- Plantillas HTML personalizadas para el Reporte Diario de Monitoreo
-- =============================================================
CREATE TABLE IF NOT EXISTS plantillas_reporte (
  id TEXT PRIMARY KEY DEFAULT 'default',
  tecnico_carnet TEXT,
  contenido_html TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE plantillas_reporte IS 'Almacena plantillas HTML personalizadas para la generación del Reporte Diario de Monitoreo';

CREATE TRIGGER trg_plantillas_updated
  BEFORE UPDATE ON plantillas_reporte
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE plantillas_reporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for plantillas_reporte" ON plantillas_reporte FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- 15. SISTEMA DE AUTENTICACIÓN Y USUARIOS (login_usuario RPC)
-- =============================================================
CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('tecnico', 'supervisor')),
  nombre_completo VARCHAR(150) NOT NULL,
  activo BOOLEAN DEFAULT true,
  requiere_cambio_clave BOOLEAN DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios_sistema ADD COLUMN IF NOT EXISTS requiere_cambio_clave BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS registro_accesos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
  username VARCHAR(50) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('login', 'logout')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registro_accesos_usuario ON registro_accesos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_registro_accesos_fecha ON registro_accesos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_sistema_username ON usuarios_sistema(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_sistema_rol ON usuarios_sistema(rol);

-- Función RPC para validar login
CREATE OR REPLACE FUNCTION login_usuario(p_username TEXT, p_password TEXT)
RETURNS TABLE(
  id UUID,
  username VARCHAR(50),
  rol VARCHAR(20),
  nombre_completo VARCHAR(150),
  requiere_cambio_clave BOOLEAN
) AS $$
BEGIN
  UPDATE usuarios_sistema u
  SET ultimo_acceso = NOW(), updated_at = NOW()
  WHERE u.username = p_username
    AND u.password_hash = p_password
    AND u.activo = true;

  RETURN QUERY
  SELECT u.id, u.username, u.rol, u.nombre_completo, u.requiere_cambio_clave
  FROM usuarios_sistema u
  WHERE u.username = p_username
    AND u.password_hash = p_password
    AND u.activo = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función RPC para cambiar contraseña
CREATE OR REPLACE FUNCTION cambiar_password(
  p_usuario_id UUID,
  p_new_password TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE usuarios_sistema
  SET password_hash = p_new_password,
      requiere_cambio_clave = false,
      updated_at = NOW()
  WHERE id = p_usuario_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar accesos
CREATE OR REPLACE FUNCTION registrar_acceso(
  p_usuario_id UUID,
  p_username TEXT,
  p_rol TEXT,
  p_accion TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO registro_accesos (usuario_id, username, rol, accion, user_agent)
  VALUES (p_usuario_id, p_username, p_rol, p_accion, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usuarios de prueba iniciales (Clave por defecto: 123456)
INSERT INTO usuarios_sistema (username, password_hash, rol, nombre_completo, requiere_cambio_clave) VALUES
  ('7782629', '123456', 'tecnico', 'Juan Pablo Alba vaca', true),
  ('3355859', '123456', 'tecnico', 'CLAUDIA LISETT OLIVARES RIVERO', true),
  ('8888888', '123456', 'supervisor', 'Hugo Eduardo Rodriguez Mondaque', true)
ON CONFLICT (username) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    nombre_completo = EXCLUDED.nombre_completo,
    rol = EXCLUDED.rol,
    requiere_cambio_clave = true;

-- Habilitar RLS y políticas
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_accesos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de usuarios" ON usuarios_sistema;
DROP POLICY IF EXISTS "Permitir inserción de accesos" ON registro_accesos;
DROP POLICY IF EXISTS "Permitir lectura de accesos" ON registro_accesos;
DROP POLICY IF EXISTS "Permitir modificación de usuarios" ON usuarios_sistema;

CREATE POLICY "Permitir lectura de usuarios" ON usuarios_sistema FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de accesos" ON registro_accesos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir lectura de accesos" ON registro_accesos FOR SELECT USING (true);

-- Tabla para almacenamiento exclusivo del HTML del Reporte Diario
CREATE TABLE IF NOT EXISTS reportes_html (
  id VARCHAR(50) PRIMARY KEY,
  contenido TEXT,
  tecnico_carnet VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas para adjuntos digitales (RDA / Certificado de Trabajo y Comprobantes) y Fecha de Nacimiento
ALTER TABLE IF EXISTS participantes ADD COLUMN IF NOT EXISTS documento_url TEXT;
ALTER TABLE IF EXISTS participantes ADD COLUMN IF NOT EXISTS fecha_nacimiento TEXT;
ALTER TABLE IF EXISTS inscripcion_ciclo ADD COLUMN IF NOT EXISTS documento_url TEXT;
ALTER TABLE IF EXISTS inscripcion_ciclo ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS mostrar_whatsapp BOOLEAN DEFAULT true;

ALTER TABLE reportes_html ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo en reportes_html" ON reportes_html;
CREATE POLICY "Permitir todo en reportes_html" ON reportes_html FOR ALL USING (true) WITH CHECK (true);
