-- JKSTORE Phase 7.7B: owner-only profitability foundation
-- Cost data is private business information. It is never exposed to normal admin APIs.
-- Historical order-item costs remain NULL when no trustworthy cost snapshot existed.

alter table public.products
  add column if not exists cost_kobo integer;

alter table public.products
  drop constraint if exists products_cost_kobo_nonnegative;

alter table public.products
  add constraint products_cost_kobo_nonnegative
  check (cost_kobo is null or cost_kobo >= 0);

alter table public.order_items
  add column if not exists unit_cost_kobo integer;

alter table public.order_items
  drop constraint if exists order_items_unit_cost_kobo_nonnegative;

alter table public.order_items
  add constraint order_items_unit_cost_kobo_nonnegative
  check (unit_cost_kobo is null or unit_cost_kobo >= 0);

create index if not exists order_items_order_cost_idx
  on public.order_items(order_id, product_id);

-- Only the owner can set product cost. Admin/operations never receive this capability.
create or replace function public.owner_set_product_cost(
  p_product_id uuid,
  p_cost_kobo integer,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_role_db text;
  saved_product public.products%rowtype;
  previous_cost integer;
begin
  if p_actor_id is null then
    raise exception 'Owner actor is required';
  end if;

  select ar.role into actor_role_db
  from public.admin_roles ar
  where ar.user_id = p_actor_id;

  if actor_role_db <> 'owner' then
    raise exception 'Owner authorization required';
  end if;

  if p_cost_kobo is null or p_cost_kobo < 0 then
    raise exception 'Invalid product cost';
  end if;

  select cost_kobo into previous_cost
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  update public.products
  set cost_kobo = p_cost_kobo,
      updated_at = now()
  where id = p_product_id
  returning * into saved_product;

  insert into public.product_admin_events (
    product_id, actor_id, actor_role, action, changes
  )
  values (
    saved_product.id,
    p_actor_id,
    'owner',
    'updated',
    jsonb_build_object(
      'cost_kobo',
      jsonb_build_object('before', previous_cost, 'after', saved_product.cost_kobo)
    )
  );

  return jsonb_build_object(
    'id', saved_product.id,
    'costKobo', saved_product.cost_kobo
  );
end;
$function$;

revoke all on function public.owner_set_product_cost(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.owner_set_product_cost(uuid, integer, uuid)
  to service_role;

-- Snapshot product cost at checkout so historical profitability does not change
-- when a product's current cost is edited later.
create or replace function public.create_pending_order(
  p_items jsonb,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_idempotency_key text,
  p_guest_access_token_hash text,
  p_guest_access_expires_at timestamptz
)
returns table (
  order_id uuid,
  total_kobo bigint,
  payment_reference text
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  item jsonb;
  product_row public.products%rowtype;
  requested_quantity integer;
  subtotal bigint := 0;
  order_uuid uuid;
  payment_ref text;
  existing_order public.orders%rowtype;
  reservation_expiry timestamptz := now() + interval '30 minutes';
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 then
    raise exception 'Invalid idempotency key';
  end if;

  if p_guest_access_token_hash is null or length(trim(p_guest_access_token_hash)) <> 64 then
    raise exception 'Invalid guest access token hash';
  end if;

  if p_guest_access_expires_at is null or p_guest_access_expires_at <= now() then
    raise exception 'Invalid guest access token expiry';
  end if;

  if p_customer_email is null or position('@' in p_customer_email) < 2 then
    raise exception 'Valid customer email is required';
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) < 2 then
    raise exception 'Customer name is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart cannot be empty';
  end if;

  select * into existing_order
  from public.orders
  where idempotency_key = p_idempotency_key
  limit 1;

  if existing_order.id is not null then
    update public.orders
    set guest_access_token_hash = p_guest_access_token_hash,
        guest_access_expires_at = p_guest_access_expires_at
    where id = existing_order.id;

    return query
      select existing_order.id, existing_order.total_kobo, existing_order.payment_reference;
    return;
  end if;

  update public.inventory_reservations
  set status = 'released',
      released_at = coalesce(released_at, now())
  where status = 'reserved'
    and expires_at <= now();

  for item in
    select value
    from jsonb_array_elements(p_items)
    order by (value->>'productId')
  loop
    requested_quantity := (item->>'quantity')::integer;

    if requested_quantity is null or requested_quantity < 1 or requested_quantity > 100 then
      raise exception 'Invalid product quantity';
    end if;

    select * into product_row
    from public.products
    where id = (item->>'productId')::uuid
      and is_active = true
    for update;

    if not found then
      raise exception 'Product is unavailable';
    end if;

    if product_row.inventory_quantity <
       requested_quantity + coalesce((
         select sum(r.quantity)
         from public.inventory_reservations r
         where r.product_id = product_row.id
           and r.status = 'reserved'
           and r.expires_at > now()
       ), 0) then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;

    subtotal := subtotal + (product_row.price_kobo * requested_quantity);
  end loop;

  order_uuid := gen_random_uuid();
  payment_ref := 'JK-' || replace(order_uuid::text, '-', '');

  insert into public.orders (
    id, user_id, status, payment_status, currency,
    subtotal_kobo, shipping_kobo, discount_kobo, total_kobo,
    customer_email, customer_name, customer_phone, shipping_address,
    idempotency_key, payment_reference,
    guest_access_token_hash, guest_access_expires_at
  )
  values (
    order_uuid, auth.uid(), 'pending_payment', 'pending', 'NGN',
    subtotal, 0, 0, subtotal,
    lower(trim(p_customer_email)), trim(p_customer_name), trim(p_customer_phone),
    p_shipping_address, p_idempotency_key, payment_ref,
    p_guest_access_token_hash, p_guest_access_expires_at
  );

  for item in
    select value
    from jsonb_array_elements(p_items)
    order by (value->>'productId')
  loop
    requested_quantity := (item->>'quantity')::integer;

    select * into product_row
    from public.products
    where id = (item->>'productId')::uuid
      and is_active = true;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price_kobo,
      unit_cost_kobo, quantity, line_total_kobo
    )
    values (
      order_uuid, product_row.id, product_row.name, product_row.price_kobo,
      product_row.cost_kobo, requested_quantity,
      product_row.price_kobo * requested_quantity
    );

    insert into public.inventory_reservations (
      order_id, product_id, quantity, status, expires_at
    )
    values (
      order_uuid, product_row.id, requested_quantity, 'reserved', reservation_expiry
    );
  end loop;

  insert into public.order_events (order_id, event_type, actor_type, metadata)
  values (
    order_uuid,
    'order.created',
    'system',
    jsonb_build_object(
      'reservation_expires_at', reservation_expiry,
      'currency', 'NGN'
    )
  );

  return query select order_uuid, subtotal, payment_ref;
end;
$function$;

revoke all on function public.create_pending_order(
  jsonb, text, text, text, jsonb, text, text, timestamptz
) from public;
grant execute on function public.create_pending_order(
  jsonb, text, text, text, jsonb, text, text, timestamptz
) to anon, authenticated;

-- Owner-only profitability RPC. It returns only aggregated/product-economic data
-- and refuses non-owner actors at the database boundary.
create or replace function public.owner_profitability_report(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_role_db text;
  revenue bigint := 0;
  cogs bigint := 0;
  fees bigint := 0;
  order_count integer := 0;
  units_sold bigint := 0;
  result jsonb;
begin
  select ar.role into actor_role_db
  from public.admin_roles ar
  where ar.user_id = p_actor_id;

  if actor_role_db <> 'owner' then
    raise exception 'Owner authorization required';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'Invalid reporting period';
  end if;

  select
    coalesce(sum(o.total_kobo), 0),
    count(*)
  into revenue, order_count
  from public.orders o
  where o.payment_status = 'success'
    and o.status <> 'refunded'
    and o.created_at >= p_start_at
    and o.created_at < p_end_at;

  select
    coalesce(sum(oi.unit_cost_kobo * oi.quantity), 0),
    coalesce(sum(oi.quantity), 0)
  into cogs, units_sold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.payment_status = 'success'
    and o.status <> 'refunded'
    and o.created_at >= p_start_at
    and o.created_at < p_end_at;

  select coalesce(sum(pt.provider_fee_kobo), 0)
  into fees
  from public.payment_transactions pt
  join public.orders o on o.id = pt.order_id
  where pt.status = 'success'
    and o.payment_status = 'success'
    and o.status <> 'refunded'
    and o.created_at >= p_start_at
    and o.created_at < p_end_at;

  select jsonb_agg(x order by x.revenue_kobo desc)
  into result
  from (
    select
      oi.product_id,
      oi.product_name,
      coalesce(sum(oi.line_total_kobo), 0)::bigint as revenue_kobo,
      coalesce(sum(oi.unit_cost_kobo * oi.quantity), 0)::bigint as cogs_kobo,
      coalesce(sum(oi.quantity), 0)::bigint as units_sold,
      coalesce(sum(oi.line_total_kobo) - sum(oi.unit_cost_kobo * oi.quantity), 0)::bigint as gross_profit_kobo
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.payment_status = 'success'
      and o.status <> 'refunded'
      and oi.unit_cost_kobo is not null
      and o.created_at >= p_start_at
      and o.created_at < p_end_at
    group by oi.product_id, oi.product_name
  ) x;

  return jsonb_build_object(
    'revenueKobo', revenue,
    'cogsKobo', cogs,
    'paymentFeesKobo', fees,
    'grossProfitKobo', revenue - cogs,
    'profitAfterPaymentFeesKobo', revenue - cogs - fees,
    'orderCount', order_count,
    'unitsSold', units_sold,
    'products', coalesce(result, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.owner_profitability_report(timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.owner_profitability_report(timestamptz, timestamptz, uuid)
  to service_role;
