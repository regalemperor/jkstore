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
