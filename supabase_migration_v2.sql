-- Tabla de categorías personalizables
CREATE TABLE IF NOT EXISTS cal_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cal_categories DISABLE ROW LEVEL SECURITY;

-- Insertar categorías default
INSERT INTO cal_categories (slug, name, color, is_default, sort_order) VALUES
  ('viaje',         'Viaje',            '#059669', true, 0),
  ('curso_dm',      'Curso DM Training','#f15922', true, 1),
  ('curso_externo', 'Curso externo',    '#2563eb', true, 2),
  ('congreso',      'Congreso',         '#7c3aed', true, 3),
  ('jornada',       'Jornada',          '#0891b2', true, 4),
  ('modulos',       'Módulos',          '#b45309', true, 5),
  ('simposio',      'Simposio',         '#be185d', true, 6)
ON CONFLICT (slug) DO NOTHING;

-- Agregar columna category_slug a cal_activities si no existe
ALTER TABLE cal_activities ADD COLUMN IF NOT EXISTS category_slug text;

-- Actualizar registros existentes mapeando type → category_slug
UPDATE cal_activities SET category_slug = type WHERE category_slug IS NULL;
