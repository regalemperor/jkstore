-- JKSTORE commerce foundation
-- Secure order/payment ledger. Public clients receive no write policies.
-- Money is stored as integer kobo (NGN minor units).

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'success', 'failed', 'reversed', 'refunded')),
  currency text not null default 'NGN'
    check (currency = 'NGN'),
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  shipping_kobo bigint not null default 0 check (shipping_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  total_kobo bigint not null check (total_kobo >= 0),
  customer_email text,
  customer_name text,
  customer_phone text,
  shipping_address jsonb,
  idempotency_key text unique,
  payment_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_math check (
    total_kobo = subtotal_kobo + shipping_kobo - discount_kobo
    and total_kobo >= 0
  )
);

create index if not exists orders_user_id_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_payment_status_idx on orders(payment_status);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  product_id uuid references products(id) on delete restrict,
  product_name text not null,
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity > 0),
  line_total_kobo bigint not null check (line_total_kobo >= 0),
  created_at timestamptz not null default now(),
  constraint order_item_total_math check (line_total_kobo = unit_price_kobo * quantity)
);

create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists order_items_product_id_idx on order_items(product_id);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  provider text not null default 'paystack'
    check (provider = 'paystack'),
  provider_reference text not null unique,
  provider_transaction_id text unique,
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN'
    check (currency = 'NGN'),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'reversed', 'refunded')),
  verified_at timestamptz,
  verification_metadata jsonb,
  webhook_event_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_order_id_idx on payment_transactions(order_id);
create index if not exists payment_transactions_status_idx on payment_transactions(status);

create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  event_type text not null,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'customer', 'admin')),
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx on order_events(order_id);
create index if not exists order_events_created_at_idx on order_events(created_at desc);

-- Keep updated_at current for mutable commerce records.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row execute function set_updated_at();

drop trigger if exists payment_transactions_set_updated_at on payment_transactions;
create trigger payment_transactions_set_updated_at
before update on payment_transactions
for each row execute function set_updated_at();

-- RLS is deliberately deny-by-default for writes.
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payment_transactions enable row level security;
alter table order_events enable row level security;

-- Authenticated customers may read only their own orders/items/events.
drop policy if exists "Customers can read their own orders" on orders;
create policy "Customers can read their own orders"
  on orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Customers can read their own order items" on order_items;
create policy "Customers can read their own order items"
  on order_items for select
  to authenticated
  using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Customers can read their own payment transactions" on payment_transactions;
create policy "Customers can read their own payment transactions"
  on payment_transactions for select
  to authenticated
  using (
    exists (
      select 1 from orders
      where orders.id = payment_transactions.order_id
        and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Customers can read their own order events" on order_events;
create policy "Customers can read their own order events"
  on order_events for select
  to authenticated
  using (
    exists (
      select 1 from orders
      where orders.id = order_events.order_id
        and orders.user_id = auth.uid()
    )
  );

-- No anon/authenticated INSERT, UPDATE, or DELETE policies are intentional.
-- Order creation, payment verification, inventory mutation, and fulfillment
-- must run through trusted server-side operations.


-- Inventory reservations keep stock protected while a customer is completing payment.
-- Reservations expire so abandoned/failed checkouts do not permanently consume stock.
create table if not exists inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'released', 'fulfilled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists inventory_reservations_product_idx
  on inventory_reservations(product_id, status, expires_at);

create index if not exists inventory_reservations_order_idx
  on inventory_reservations(order_id);

alter table inventory_reservations enable row level security;

-- Customers do not need direct access to reservation records.
-- All reservation changes happen inside trusted checkout/payment operations.

-- Atomically validates live catalog data, protects inventory, snapshots prices,
-- and creates a pending order. The browser never supplies authoritative prices.
create or replace function create_pending_order(
  p_items jsonb,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_idempotency_key text
)
returns table (
  order_id uuid,
  total_kobo bigint,
  payment_reference text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  item jsonb;
  product_row products%rowtype;
  requested_quantity integer;
  subtotal bigint := 0;
  order_uuid uuid;
  payment_ref text;
  existing_order orders%rowtype;
  reservation_expiry timestamptz := now() + interval '30 minutes';
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 then
    raise exception 'Invalid idempotency key';
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

  -- Safe retry: return the original pending order instead of creating a duplicate.
  select * into existing_order
  from orders
  where idempotency_key = p_idempotency_key
  limit 1;

  if existing_order.id is not null then
    return query select existing_order.id, existing_order.total_kobo, existing_order.payment_reference;
    return;
  end if;

  -- Lock products in deterministic UUID order to reduce concurrent checkout deadlocks.
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
    from products
    where id = (item->>'productId')::uuid
      and is_active = true
    for update;

    if not found then
      raise exception 'Product is unavailable';
    end if;

    if product_row.inventory_quantity <
       requested_quantity + coalesce((
         select sum(r.quantity)
         from inventory_reservations r
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

  insert into orders (
    id, user_id, status, payment_status, currency,
    subtotal_kobo, shipping_kobo, discount_kobo, total_kobo,
    customer_email, customer_name, customer_phone, shipping_address,
    idempotency_key, payment_reference
  )
  values (
    order_uuid, auth.uid(), 'pending_payment', 'pending', 'NGN',
    subtotal, 0, 0, subtotal,
    lower(trim(p_customer_email)), trim(p_customer_name), trim(p_customer_phone),
    p_shipping_address, p_idempotency_key, payment_ref
  );

  for item in
    select value
    from jsonb_array_elements(p_items)
    order by (value->>'productId')
  loop
    requested_quantity := (item->>'quantity')::integer;

    select * into product_row
    from products
    where id = (item->>'productId')::uuid
      and is_active = true;

    insert into order_items (
      order_id, product_id, product_name, unit_price_kobo, quantity, line_total_kobo
    )
    values (
      order_uuid, product_row.id, product_row.name, product_row.price_kobo,
      requested_quantity, product_row.price_kobo * requested_quantity
    );

    insert into inventory_reservations (
      order_id, product_id, quantity, status, expires_at
    )
    values (
      order_uuid, product_row.id, requested_quantity, 'reserved', reservation_expiry
    );
  end loop;

  insert into order_events (order_id, event_type, actor_type, metadata)
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
$$;

revoke all on function create_pending_order(jsonb, text, text, text, jsonb, text) from public;
grant execute on function create_pending_order(jsonb, text, text, text, jsonb, text) to anon, authenticated;
