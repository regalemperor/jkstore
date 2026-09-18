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

create policy "Public can read active categories"
  on categories for select
  using (true);

create policy "Public can read active products"
  on products for select
  using (is_active = true);
