-- JKSTORE Phase 7.5: product administration
-- Product mutations are trusted server-side operations only.
-- Inventory quantity is intentionally excluded; inventory has its own audited path.

create table if not exists public.product_admin_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null check (actor_role in ('owner', 'admin', 'operations')),
  action text not null check (action in ('created', 'updated')),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_admin_events_product_created_idx
  on public.product_admin_events(product_id, created_at desc);

create index if not exists product_admin_events_actor_created_idx
  on public.product_admin_events(actor_id, created_at desc);

alter table public.product_admin_events enable row level security;
revoke all on public.product_admin_events from public, anon, authenticated;
grant select, insert on public.product_admin_events to service_role;

create or replace function public.admin_save_product(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_price_kobo integer,
  p_category_id text,
  p_tag text,
  p_image_url text,
  p_is_featured boolean,
  p_is_active boolean,
  p_actor_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_role_db text;
  existing_product public.products%rowtype;
  saved_product public.products%rowtype;
  action_name text;
  change_set jsonb;
begin
  if p_actor_id is null then raise exception 'Admin actor is required'; end if;

  select ar.role into actor_role_db
  from public.admin_roles ar
  where ar.user_id = p_actor_id;

  if actor_role_db is null or actor_role_db <> p_actor_role then
    raise exception 'Admin authorization failed';
  end if;

  if actor_role_db not in ('owner', 'admin', 'operations') then
    raise exception 'Admin role is not permitted';
  end if;

  if p_name is null or length(trim(p_name)) = 0 or length(trim(p_name)) > 200 then
    raise exception 'Invalid product name';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug) > 200 then
    raise exception 'Invalid product slug';
  end if;

  if p_description is null or length(p_description) > 5000 then
    raise exception 'Invalid product description';
  end if;

  if p_price_kobo is null or p_price_kobo < 0 then
    raise exception 'Invalid product price';
  end if;

  if p_category_id is null or length(trim(p_category_id)) = 0 then
    raise exception 'Category is required';
  end if;

  if not exists (
    select 1 from public.categories c where c.id = p_category_id
  ) then
    raise exception 'Category does not exist';
  end if;

  if p_tag is not null and length(p_tag) > 100 then
    raise exception 'Product tag is too long';
  end if;

  if p_image_url is not null and length(p_image_url) > 2000 then
    raise exception 'Product image URL is too long';
  end if;

  if p_product_id is null then
    if exists (
      select 1 from public.products p
      where lower(p.slug) = lower(trim(p_slug))
         or lower(p.name) = lower(trim(p_name))
    ) then
      raise exception 'Product name or slug already exists';
    end if;

    insert into public.products (
      name, slug, description, price_kobo, category_id, tag, image_url,
      is_featured, is_active
    )
    values (
      trim(p_name), lower(trim(p_slug)), trim(p_description), p_price_kobo,
      p_category_id, nullif(trim(p_tag), ''), nullif(trim(p_image_url), ''),
      p_is_featured, p_is_active
    )
    returning * into saved_product;

    action_name := 'created';
    change_set := jsonb_build_object(
      'name', saved_product.name,
      'slug', saved_product.slug,
      'price_kobo', saved_product.price_kobo,
      'category_id', saved_product.category_id,
      'is_featured', saved_product.is_featured,
      'is_active', saved_product.is_active
    );
  else
    select * into existing_product
    from public.products p
    where p.id = p_product_id
    for update;

    if not found then raise exception 'Product not found'; end if;

    if exists (
      select 1 from public.products p
      where p.id <> p_product_id
        and (lower(p.slug) = lower(trim(p_slug)) or lower(p.name) = lower(trim(p_name)))
    ) then
      raise exception 'Product name or slug already exists';
    end if;

    update public.products p
    set name = trim(p_name),
        slug = lower(trim(p_slug)),
        description = trim(p_description),
        price_kobo = p_price_kobo,
        category_id = p_category_id,
        tag = nullif(trim(p_tag), ''),
        image_url = nullif(trim(p_image_url), ''),
        is_featured = p_is_featured,
        is_active = p_is_active,
        updated_at = now()
    where p.id = p_product_id
    returning * into saved_product;

    action_name := 'updated';
    change_set := jsonb_build_object(
      'name', jsonb_build_object('before', existing_product.name, 'after', saved_product.name),
      'slug', jsonb_build_object('before', existing_product.slug, 'after', saved_product.slug),
      'price_kobo', jsonb_build_object('before', existing_product.price_kobo, 'after', saved_product.price_kobo),
      'category_id', jsonb_build_object('before', existing_product.category_id, 'after', saved_product.category_id),
      'tag', jsonb_build_object('before', existing_product.tag, 'after', saved_product.tag),
      'image_url', jsonb_build_object('before', existing_product.image_url, 'after', saved_product.image_url),
      'is_featured', jsonb_build_object('before', existing_product.is_featured, 'after', saved_product.is_featured),
      'is_active', jsonb_build_object('before', existing_product.is_active, 'after', saved_product.is_active)
    );
  end if;

  insert into public.product_admin_events (
    product_id, actor_id, actor_role, action, changes
  )
  values (
    saved_product.id, p_actor_id, actor_role_db, action_name, change_set
  );

  return jsonb_build_object(
    'id', saved_product.id,
    'name', saved_product.name,
    'slug', saved_product.slug,
    'description', saved_product.description,
    'priceKobo', saved_product.price_kobo,
    'categoryId', saved_product.category_id,
    'tag', saved_product.tag,
    'imageUrl', saved_product.image_url,
    'isFeatured', saved_product.is_featured,
    'isActive', saved_product.is_active,
    'inventoryQuantity', saved_product.inventory_quantity,
    'createdAt', saved_product.created_at,
    'updatedAt', saved_product.updated_at
  );
end;
$function$;

revoke all on function public.admin_save_product(
  uuid, text, text, text, integer, text, text, text, boolean, boolean, uuid, text
) from public, anon, authenticated;

grant execute on function public.admin_save_product(
  uuid, text, text, text, integer, text, text, text, boolean, boolean, uuid, text
) to service_role;
