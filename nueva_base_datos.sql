-- ====================================================================
-- ESQUEMA DE BASE DE DATOS: CURSO DE CAPACITACIÓN (CEE MARTHA MENDOZA)
-- Sistema: Capacitacion-CEE
-- Base de datos: Supabase (PostgreSQL)
-- ====================================================================

-- 1. Habilitar extensión pgcrypto si no está habilitada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA PRINCIPAL: participantes
CREATE TABLE IF NOT EXISTS participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci TEXT UNIQUE NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  telefono TEXT,
  carnet_anverso_url TEXT,
  carnet_reverso_url TEXT,
  carnet_escaneado_url TEXT,
  comprobante_url TEXT,
  monto_pago NUMERIC(10,2) DEFAULT 150.00,
  estado_pago TEXT DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'VERIFICADO', 'OBSERVADO'
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_participantes_ci ON participantes(ci);
CREATE INDEX IF NOT EXISTS idx_participantes_apellidos ON participantes(apellidos);
CREATE INDEX IF NOT EXISTS idx_participantes_estado ON participantes(estado_pago);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_participantes_updated ON participantes;
CREATE TRIGGER trg_participantes_updated
  BEFORE UPDATE ON participantes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- 3. POLÍTICAS DE ACCESO (Row Level Security - RLS)
-- Permite lectura e inserción pública para el formulario, y administración
-- ====================================================================
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;

-- Permitir a usuarios anónimos consultar su estado de inscripción por CI o listar
CREATE POLICY "Permitir lectura publica de participantes"
  ON participantes FOR SELECT
  USING (true);

-- Permitir a participantes inscribirse públicamente
CREATE POLICY "Permitir insercion publica de participantes"
  ON participantes FOR INSERT
  WITH CHECK (true);

-- Permitir actualización pública/admin (para subir comprobantes o cambiar estado)
CREATE POLICY "Permitir actualizacion de participantes"
  ON participantes FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Permitir eliminación
CREATE POLICY "Permitir eliminacion de participantes"
  ON participantes FOR DELETE
  USING (true);

-- ====================================================================
-- 4. BUCKETS DE STORAGE (Comprobantes y Carnets)
-- ====================================================================
-- Crear bucket 'comprobantes' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Crear bucket 'carnets' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('carnets', 'carnets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para 'comprobantes'
CREATE POLICY "Acceso publico lectura comprobantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprobantes');

CREATE POLICY "Subida publica comprobantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprobantes');

CREATE POLICY "Actualizacion publica comprobantes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'comprobantes');

-- Políticas de Storage para 'carnets'
CREATE POLICY "Acceso publico lectura carnets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carnets');

CREATE POLICY "Subida publica carnets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'carnets');

CREATE POLICY "Actualizacion publica carnets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'carnets');
