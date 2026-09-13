-- ====================================================================
-- ACTUALIZACIÓN: AFICHES Y TEMARIOS PARA CURSOS
-- Ejecutar en el SQL Editor de Supabase si se desea persistencia en BD
-- ====================================================================

-- 1. Agregar columna afiche_url para guardar la URL o imagen del afiche oficial
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS afiche_url TEXT;

-- 2. Agregar columna temario para guardar el contenido 'Aprenderás'
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS temario TEXT;

-- 3. Si existe la tabla cursos, asegurar permisos de lectura y escritura
GRANT ALL ON TABLE cursos TO authenticated, anon;
