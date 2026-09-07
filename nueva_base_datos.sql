-- ====================================================================
-- ESQUEMA DE BASE DE DATOS: CURSO DE CAPACITACIÓN (CEE MARTHA MENDOZA)
-- Sistema: Capacitacion-CEE
-- Base de datos: Supabase (PostgreSQL)
-- ====================================================================

-- 1. Habilitar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. TABLA: cursos
-- Permite gestionar múltiples cursos con su ID, costo y grupo de WhatsApp
-- ====================================================================
CREATE TABLE IF NOT EXISTS cursos (
  id TEXT PRIMARY KEY, -- Slug o código identificador (ej: 'operador-pc', 'gastronomia')
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo NUMERIC(10,2) DEFAULT 150.00,
  whatsapp_url TEXT, -- Enlace de invitación al grupo de WhatsApp
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar curso inicial por defecto
INSERT INTO cursos (id, nombre, descripcion, costo, whatsapp_url, activo)
VALUES (
  'capacitacion-general',
  'Curso de Capacitación Continua',
  'Programa integral de capacitación técnica en el C.E.A. Martha Mendoza.',
  150.00,
  'https://chat.whatsapp.com/',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. TABLA: participantes (Creación o Actualización si ya existía)
-- ====================================================================
CREATE TABLE IF NOT EXISTS participantes (
  id UUID DEFAULT gen_random_uuid(),
  ci TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  telefono TEXT,
  curso_id TEXT REFERENCES cursos(id) ON DELETE SET NULL,
  carnet_anverso_url TEXT,
  carnet_reverso_url TEXT,
  carnet_escaneado_url TEXT,
  comprobante_url TEXT,
  monto_pago NUMERIC(10,2) DEFAULT 150.00,
  estado_pago TEXT DEFAULT 'PENDIENTE',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Si la tabla participantes ya existía previamente sin estas columnas,
-- las agregamos automáticamente para evitar el error 'column does not exist':
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS curso_id TEXT REFERENCES cursos(id) ON DELETE SET NULL;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS carnet_anverso_url TEXT;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS carnet_reverso_url TEXT;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS carnet_escaneado_url TEXT;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS monto_pago NUMERIC(10,2) DEFAULT 150.00;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS estado_pago TEXT DEFAULT 'PENDIENTE';
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_participantes_ci ON participantes(ci);
CREATE INDEX IF NOT EXISTS idx_participantes_curso ON participantes(curso_id);
CREATE INDEX IF NOT EXISTS idx_participantes_apellidos ON participantes(apellidos);
CREATE INDEX IF NOT EXISTS idx_participantes_estado ON participantes(estado_pago);

-- ====================================================================
-- 4. TRIGGERS AUTOMÁTICOS PARA updated_at
-- ====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cursos_updated ON cursos;
CREATE TRIGGER trg_cursos_updated
  BEFORE UPDATE ON cursos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_participantes_updated ON participantes;
CREATE TRIGGER trg_participantes_updated
  BEFORE UPDATE ON participantes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- 5. POLÍTICAS DE ACCESO (Row Level Security - RLS)
-- ====================================================================
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;

-- Políticas para cursos
DROP POLICY IF EXISTS "Permitir lectura publica de cursos" ON cursos;
CREATE POLICY "Permitir lectura publica de cursos"
  ON cursos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir insercion de cursos" ON cursos;
CREATE POLICY "Permitir insercion de cursos"
  ON cursos FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de cursos" ON cursos;
CREATE POLICY "Permitir actualizacion de cursos"
  ON cursos FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de cursos" ON cursos;
CREATE POLICY "Permitir eliminacion de cursos"
  ON cursos FOR DELETE
  USING (true);

-- Políticas para participantes
DROP POLICY IF EXISTS "Permitir lectura publica de participantes" ON participantes;
CREATE POLICY "Permitir lectura publica de participantes"
  ON participantes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de participantes" ON participantes;
CREATE POLICY "Permitir insercion publica de participantes"
  ON participantes FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de participantes" ON participantes;
CREATE POLICY "Permitir actualizacion de participantes"
  ON participantes FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de participantes" ON participantes;
CREATE POLICY "Permitir eliminacion de participantes"
  ON participantes FOR DELETE
  USING (true);

-- ====================================================================
-- 6. BUCKETS DE STORAGE (Comprobantes y Carnets)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('carnets', 'carnets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para 'comprobantes'
DROP POLICY IF EXISTS "Acceso publico lectura comprobantes" ON storage.objects;
CREATE POLICY "Acceso publico lectura comprobantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprobantes');

DROP POLICY IF EXISTS "Subida publica comprobantes" ON storage.objects;
CREATE POLICY "Subida publica comprobantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprobantes');

DROP POLICY IF EXISTS "Actualizacion publica comprobantes" ON storage.objects;
CREATE POLICY "Actualizacion publica comprobantes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'comprobantes');

-- Políticas de Storage para 'carnets'
DROP POLICY IF EXISTS "Acceso publico lectura carnets" ON storage.objects;
CREATE POLICY "Acceso publico lectura carnets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carnets');

DROP POLICY IF EXISTS "Subida publica carnets" ON storage.objects;
CREATE POLICY "Subida publica carnets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'carnets');

DROP POLICY IF EXISTS "Actualizacion publica carnets" ON storage.objects;
CREATE POLICY "Actualizacion publica carnets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'carnets');
