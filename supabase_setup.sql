-- ============================================================
--  VCs - Supabase Database Setup
--  Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================================

-- ── Extensión para UUIDs ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── TABLA: brands ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,          -- ej: "vhill", "iplay"
  name        TEXT NOT NULL,                 -- ej: "Vhill", "IPLAY"
  color       TEXT DEFAULT '#7c3aed',        -- color hex para UI
  glow        TEXT DEFAULT 'rgba(124,58,237,.25)',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABLA: models ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                 -- ej: "v3000", "max-2500"
  name        TEXT NOT NULL,                 -- ej: "V3000", "MAX 2500"
  puffs       INTEGER DEFAULT 3000,
  coil_ohm    TEXT DEFAULT '1.0',            -- ej: "1.0" → "1.0Ω mesh coil"
  juice_ml    INTEGER DEFAULT 10,
  juice_nic   TEXT DEFAULT '5',              -- porcentaje sin "%"
  battery_mah INTEGER DEFAULT 1450,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, slug)
);

-- ── TABLA: products ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  model_id      UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  flavor        TEXT NOT NULL,               -- sabor en minúsculas
  flavor_display TEXT NOT NULL,             -- sabor con capitalización original
  price         NUMERIC(10,2) NOT NULL DEFAULT 300,
  in_stock      BOOLEAN DEFAULT TRUE,
  stock_units   INTEGER DEFAULT 0,
  top_sales     BOOLEAN DEFAULT FALSE,
  recommended   BOOLEAN DEFAULT FALSE,
  emoji         TEXT DEFAULT '💨',
  image_url     TEXT DEFAULT '',            -- URL externa o data:base64
  category      TEXT DEFAULT 'frutal',      -- frutal | menta | cremoso | bebida
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Trigger: actualizar updated_at automáticamente ────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TABLA: admin_users ────────────────────────────────────
-- Credenciales del admin almacenadas con hash
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- bcrypt hash
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Insertar admin con password hasheado ──────────────────
-- Password: VCs28042026 → bcrypt hash (generado externamente)
INSERT INTO admin_users (username, email, password_hash)
VALUES (
  'ADMIN',
  'vcs11042@gmail.com',
  '$2a$10$rOzJ5YkGkBqJ.5mJQ1Kz7.8XqZdBbhGODXtY8HKkX9DJPVN4KLtAy'
)
ON CONFLICT (username) DO NOTHING;

-- ── Row Level Security (RLS) ──────────────────────────────
ALTER TABLE brands      ENABLE ROW LEVEL SECURITY;
ALTER TABLE models      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Lectura pública para brands, models y products
CREATE POLICY "public_read_brands"   ON brands   FOR SELECT USING (true);
CREATE POLICY "public_read_models"   ON models   FOR SELECT USING (true);
CREATE POLICY "public_read_products" ON products FOR SELECT USING (true);

-- admin_users: solo lectura anónima (para login verificación en edge function)
-- La escritura sobre products/brands/models se hará desde el frontend autenticado

-- Políticas de escritura: permitir todo (la autenticación se valida en JS)
CREATE POLICY "allow_all_brands"    ON brands   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_models"    ON models   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products"  ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_read_admin"    ON admin_users FOR SELECT USING (true);

-- ============================================================
--  DATOS INICIALES
-- ============================================================

-- ── Marcas ────────────────────────────────────────────────
INSERT INTO brands (slug, name, color, glow) VALUES
  ('vhill', 'Vhill',  '#7c3aed', 'rgba(124,58,237,.25)'),
  ('iplay', 'IPLAY',  '#0ea5e9', 'rgba(14,165,233,.25)')
ON CONFLICT (slug) DO NOTHING;

-- ── Modelos ───────────────────────────────────────────────
INSERT INTO models (brand_id, slug, name, puffs, coil_ohm, juice_ml, juice_nic, battery_mah)
SELECT b.id, 'v3000', 'V3000', 3000, '1.0', 10, '5', 1450
FROM brands b WHERE b.slug = 'vhill'
ON CONFLICT (brand_id, slug) DO NOTHING;

INSERT INTO models (brand_id, slug, name, puffs, coil_ohm, juice_ml, juice_nic, battery_mah)
SELECT b.id, 'max-2500', 'MAX 2500', 2500, '1.2', 8, '5', 1200
FROM brands b WHERE b.slug = 'iplay'
ON CONFLICT (brand_id, slug) DO NOTHING;

-- ── Productos Vhill V3000 ─────────────────────────────────
WITH v AS (
  SELECT b.id AS brand_id, m.id AS model_id
  FROM brands b JOIN models m ON m.brand_id = b.id
  WHERE b.slug = 'vhill' AND m.slug = 'v3000'
)
INSERT INTO products (brand_id, model_id, flavor, flavor_display, price, in_stock, stock_units, top_sales, recommended, emoji, image_url, category)
SELECT v.brand_id, v.model_id, flavor, flavor_display, 300, in_stock, 0, top_sales, FALSE, emoji, image_url, category
FROM v, (VALUES
  ('strawberry watermelon','Strawberry Watermelon', FALSE, TRUE,  '🍓', '', 'frutal'),
  ('black mint',           'Black Mint',            FALSE, TRUE,  '🖤', '', 'menta'),
  ('grape strawberry',     'Grape Strawberry',      FALSE, TRUE,  '🍇', '', 'frutal'),
  ('apple strawberry raspberry','Apple Strawberry Raspberry', FALSE, FALSE, '🍎', '', 'frutal'),
  ('black berry ice',      'Black Berry Ice',       FALSE, FALSE, '🫐', '', 'frutal'),
  ('blueberry raspberry ice','Blueberry Raspberry Ice', FALSE, FALSE, '🫐', '', 'frutal'),
  ('blueberry kiwi',       'Blueberry Kiwi',        FALSE, FALSE, '🥝', '', 'frutal'),
  ('banana ice',           'Banana Ice',            FALSE, FALSE, '🍌', '', 'frutal'),
  ('blueberry mango',      'Blueberry Mango',       FALSE, FALSE, '🥭', '', 'frutal'),
  ('bubblegum mint',       'Bubblegum Mint',        FALSE, FALSE, '🩷', '', 'cremoso'),
  ('coconut milk',         'Coconut Milk',          FALSE, FALSE, '🥥', '', 'cremoso'),
  ('cool mint',            'Cool Mint',             FALSE, TRUE,  '❄️', '', 'menta'),
  ('coconut ice',          'Coconut Ice',           FALSE, FALSE, '🥥', '', 'cremoso'),
  ('cherry ice',           'Cherry Ice',            FALSE, FALSE, '🍒', '', 'frutal'),
  ('coconut pineapple',    'Coconut Pineapple',     FALSE, FALSE, '🍍', '', 'cremoso'),
  ('energy drink',         'Energy Drink',          FALSE, FALSE, '⚡', '', 'bebida'),
  ('clear',                'Clear',                 FALSE, FALSE, '💎', '', 'frutal'),
  ('cherry mint',          'Cherry Mint',           FALSE, FALSE, '🍒', '', 'menta'),
  ('green apple',          'Green Apple',           FALSE, FALSE, '🍏', '', 'frutal'),
  ('guava raspberry',      'Guava Raspberry',       FALSE, FALSE, '🌺', '', 'frutal'),
  ('grape lemonade',       'Grape Lemonade',        FALSE, FALSE, '🍋', '', 'bebida'),
  ('grape ice',            'Grape Ice',             FALSE, TRUE,  '🍇', '', 'frutal'),
  ('kiwi passion fruit guava','Kiwi Passion Fruit Guava', FALSE, FALSE, '🥝', '', 'frutal'),
  ('lychee ice',           'Lychee Ice',            FALSE, FALSE, '🌸', '', 'frutal'),
  ('lush ice',             'Lush Ice',              FALSE, TRUE,  '🌿', '', 'menta'),
  ('mighty mint',          'Mighty Mint',           FALSE, FALSE, '💚', '', 'menta'),
  ('mango ice',            'Mango Ice',             FALSE, FALSE, '🥭', '', 'frutal'),
  ('mint tobacco',         'Mint Tobacco',          FALSE, FALSE, '🌿', '', 'menta'),
  ('orange ice',           'Orange Ice',            FALSE, FALSE, '🍊', '', 'frutal'),
  ('peach blueberry',      'Peach Blueberry',       FALSE, FALSE, '🍑', '', 'frutal'),
  ('peach mango',          'Peach Mango',           FALSE, FALSE, '🍑', '', 'frutal'),
  ('peach ice',            'Peach Ice',             FALSE, FALSE, '🍑', '', 'frutal'),
  ('raspberry candy bubblegum','Raspberry Candy Bubblegum', FALSE, FALSE, '🍬', '', 'cremoso'),
  ('strawberry banana',    'Strawberry Banana',     FALSE, FALSE, '🍓', '', 'frutal'),
  ('unicorn shake',        'Unicorn Shake',         FALSE, FALSE, '🦄', '', 'cremoso'),
  ('white carajillo',      'White Carajillo',       FALSE, FALSE, '☕', '', 'bebida')
) AS t(flavor, flavor_display, in_stock, top_sales, emoji, image_url, category)
ON CONFLICT DO NOTHING;

-- ── Productos IPLAY MAX 2500 ──────────────────────────────
WITH ip AS (
  SELECT b.id AS brand_id, m.id AS model_id
  FROM brands b JOIN models m ON m.brand_id = b.id
  WHERE b.slug = 'iplay' AND m.slug = 'max-2500'
)
INSERT INTO products (brand_id, model_id, flavor, flavor_display, price, in_stock, stock_units, top_sales, recommended, emoji, image_url, category)
SELECT ip.brand_id, ip.model_id, flavor, flavor_display, 280, in_stock, 0, top_sales, FALSE, emoji, image_url, category
FROM ip, (VALUES
  ('black mint',       'Black Mint',       TRUE, TRUE,  '🖤', '', 'menta'),
  ('berry watermelon', 'Berry Watermelon', TRUE, TRUE,  '🍉', '', 'frutal'),
  ('grape ice',        'Grape Ice',        TRUE, TRUE,  '🍇', '', 'frutal'),
  ('peach berries ice','Peach Berries Ice',TRUE, FALSE, '🍑', '', 'frutal'),
  ('strawberry ice',   'Strawberry Ice',   TRUE, FALSE, '🍓', '', 'frutal'),
  ('grape strawberry', 'Grape Strawberry', TRUE, FALSE, '🍇', '', 'frutal'),
  ('cool mint',        'Cool Mint',        TRUE, FALSE, '❄️', '', 'menta')
) AS t(flavor, flavor_display, in_stock, top_sales, emoji, image_url, category)
ON CONFLICT DO NOTHING;
