-- JKSTORE Phase 8 checkout integrity hardening
-- Prevent duplicate product entries in a client-supplied cart from bypassing
-- the per-product quantity limit or stock reservation calculation.
--
-- A cart is treated as a set of product quantities: duplicate product IDs are
-- aggregated before stock checks and before order-item/reservation creation.

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

  -- Safe retry: do not revive an expired pending checkout.
  select * into existing_order
  from public.orders
  where idempotency_key = p_idempotency_key
  limit 1;

  if existing_order.id is not null then
    if existing_order.status = 'pending_payment'
       and existing_order.payment_status = 'pending'
       and not exists (
         select 1
         from public.inventory_reservations r
         where r.order_id = existing_order.id
           and r.status = 'reserved'
           and r.expires_at > now()
       ) then
      raise exception 'Checkout session expired; please create a new order';
    end if;

    update public.orders
    set guest_access_token_hash = p_guest_access_token_hash,
        guest_access_expires_at = p_guest_access_expires_at
    where id = existing_order.id;

    return query
      select existing_order.id, existing_order.total_kobo, existing_order.payment_reference;
    return;
  end if;

  -- Release stale reservations before checking current stock.
  update public.inventory_reservations
  set status = 'released',
      released_at = coalesce(released_at, now())
  where status = 'reserved'
    and expires_at <= now();

  -- Aggregate duplicate product IDs before validating stock. This prevents a
  -- malicious client from splitting one product across multiple cart entries
  -- and bypassing the per-product quantity limit/stock calculation.
  for item in
    select jsonb_build_object(
      'productId', product_id,
      'quantity', total_quantity
    )
    from (
      select
        value->>'productId' as product_id,
        sum((value->>'quantity')::integer)::integer as total_quantity
      from jsonb_array_elements(p_items)
      group by value->>'productId'
      order by value->>'productId'
    ) aggregated_items
  loop
    if item->>'productId' is null
       or not (item->>'productId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
      raise exception 'Invalid product ID';
    end if;

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

  -- Persist one order item and one reservation per unique product, using the
  -- same aggregated quantity used by the authoritative stock check.
  for item in
    select jsonb_build_object(
      'productId', product_id,
      'quantity', total_quantity
    )
    from (
      select
        value->>'productId' as product_id,
        sum((value->>'quantity')::integer)::integer as total_quantity
      from jsonb_array_elements(p_items)
      group by value->>'productId'
      order by value->>'productId'
    ) aggregated_items
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
