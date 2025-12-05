-- backend/sql/menu_init.sql

-- categories (master data)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(130) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  price_pence INTEGER NOT NULL DEFAULT 0,  -- store in pence (UK)
  available BOOLEAN DEFAULT TRUE,
  image_url VARCHAR(1024),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  price_gbp Numeric
);

-- sample categories (master)
INSERT INTO categories (name, slug, description, is_active)
VALUES
  ('Burgers','burgers','Juicy grilled burgers','true'),
  ('Pizza','pizza','Stone-baked pizzas','true'),
  ('Sides','sides','Fries, salads & snacks','true')
ON CONFLICT (slug) DO NOTHING;

-- sample menu item (using uploaded sample image path)
INSERT INTO menu_items (category_id, title, description, price_pence, available, image_url)
SELECT c.id, 'Signature Burger', 'Smash patty with cheese, lettuce, secret sauce', 699, true, '/mnt/data/b919f2e7-aa51-4d2f-9434-d7b5a23ab1bb.png'
FROM categories c WHERE c.slug='burgers'
ON CONFLICT DO NOTHING;
