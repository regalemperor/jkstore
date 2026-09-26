create extension if not exists "pgcrypto";

create table if not exists categories (
  id text primary key,
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text not null default '',
  price_kobo integer not null check (price_kobo >= 0),
  category_id text not null references categories(id),
  tag text,
  image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on products(category_id);
create index if not exists products_featured_idx on products(is_featured) where is_active = true;

alter table categories enable row level security;
alter table products enable row level security;

drop policy if exists "Public can read active categories" on categories;
create policy "Public can read active categories"
  on categories for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read active products" on products;
create policy "Public can read active products"
  on products for select
  to anon, authenticated
  using (is_active = true);

insert into categories (id, name, slug)
values
  ('new-arrivals', 'New arrivals', 'new-arrivals'),
  ('men', 'Men', 'men'),
  ('women', 'Women', 'women'),
  ('accessories', 'Accessories', 'accessories')
on conflict (id) do update
set name = excluded.name, slug = excluded.slug;

insert into products (
  id, name, slug, description, price_kobo, category_id, tag, is_featured, is_active, inventory_quantity
)
values
  ('00000000-0000-4000-8000-000000000001', 'Essential Tee', 'essential-tee', 'A clean everyday essential.', 1800000, 'new-arrivals', 'New', true, true, 24),
  ('00000000-0000-4000-8000-000000000002', 'Classic Overshirt', 'classic-overshirt', 'A versatile layer for everyday wear.', 3200000, 'men', 'Popular', true, true, 12),
  ('00000000-0000-4000-8000-000000000003', 'Everyday Sneakers', 'everyday-sneakers', 'Comfort-focused everyday footwear.', 4500000, 'new-arrivals', 'Featured', true, true, 18)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  price_kobo = excluded.price_kobo,
  category_id = excluded.category_id,
  tag = excluded.tag,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active,
  inventory_quantity = excluded.inventory_quantity,
  updated_at = now();
