-- JKSTORE Phase 8 inventory fulfillment hardening
-- Successful payment must consume the fulfilled reservation and decrement
-- products.inventory_quantity exactly once.
--
-- Automated sales are kept separate from manual admin adjustments because
-- inventory_adjustments intentionally requires a human admin actor.

create table if not exists public.inventory_sales (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.inventory_reservations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  created_at timestamptz not null default now(),
  constraint inventory_sale_math
    check (quantity_after = quantity_before - quantity)
);

create index if not exists inventory_sales_order_idx
  on public.inventory_sales(order_id, created_at);

create index if not exists inventory_sales_product_idx
  on public.inventory_sales(product_id, created_at desc);

alter table public.inventory_sales enable row level security;

revoke all on public.inventory_sales from public, anon, authenticated;
grant select, insert, update, delete on public.inventory_sales to service_role;

-- Replace payment reconciliation so a successful payment:
-- 1. locks the order;
-- 2. verifies the payment amount/reference;
-- 3. locks each product;
-- 4. consumes each reserved quantity exactly once;
-- 5. records the stock before/after in inventory_sales;
-- 6. marks the reservation fulfilled.
--
-- The reservation status transition is the idempotency boundary: a duplicate
-- webhook sees no 'reserved' rows and therefore cannot decrement stock again.

create or replace function public.reconcile_paystack_payment(
  p_order_id uuid,
  p_provider_reference text,
  p_provider_transaction_id text,
  p_amount_kobo bigint,
  p_currency text,
  p_provider_status text,
  p_metadata jsonb default '{}'::jsonb,
  p_webhook_event_key text default null
)
returns table (
  order_status text,
  payment_status text,
  fulfilled boolean
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  locked_order public.orders%rowtype;
  locked_payment public.payment_transactions%rowtype;
  reservation_row public.inventory_reservations%rowtype;
  locked_product public.products%rowtype;
  resulting_quantity integer;
  fulfilled_any boolean := false;
begin
  if p_currency <> 'NGN' then
    raise exception 'Unsupported payment currency';
  end if;

  if p_provider_status not in ('success', 'failed', 'reversed', 'refunded', 'pending') then
    raise exception 'Unsupported provider payment status';
  end if;

  if p_webhook_event_key is not null
     and exists (
       select 1
       from public.payment_transactions
       where webhook_event_key = p_webhook_event_key
     ) then
    select o.status, o.payment_status,
           exists (
             select 1 from public.inventory_sales s
             where s.order_id = o.id
           )
    into order_status, payment_status, fulfilled
    from public.payment_transactions pt
    join public.orders o on o.id = pt.order_id
    where pt.webhook_event_key = p_webhook_event_key;

    return next;
    return;
  end if;

  select *
  into locked_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if locked_order.payment_reference is distinct from p_provider_reference then
    raise exception 'Payment reference does not match order';
  end if;

  if locked_order.total_kobo <> p_amount_kobo then
    raise exception 'Payment amount does not match order total';
  end if;

  select *
  into locked_payment
  from public.payment_transactions
  where order_id = p_order_id
    and provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'Payment transaction record not found';
  end if;

  if locked_payment.amount_kobo <> p_amount_kobo
     or locked_payment.currency <> p_currency then
    raise exception 'Payment transaction does not match order';
  end if;

  if p_provider_transaction_id is not null
     and exists (
       select 1
       from public.payment_transactions pt
       where pt.provider_transaction_id = p_provider_transaction_id
         and pt.id <> locked_payment.id
     ) then
    raise exception 'Provider transaction already belongs to another payment';
  end if;

  if p_provider_status = 'success' then
    update public.payment_transactions
    set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
        status = 'success',
        verified_at = coalesce(verified_at, now()),
        verification_metadata = coalesce(verification_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
        webhook_event_key = coalesce(p_webhook_event_key, webhook_event_key)
    where id = locked_payment.id;

    if locked_order.status = 'pending_payment' and locked_order.payment_status = 'pending' then
      -- Lock products in deterministic order to reduce cross-order deadlock risk.
      for reservation_row in
        select ir.*
        from public.inventory_reservations ir
        where ir.order_id = locked_order.id
          and ir.status = 'reserved'
        order by ir.product_id, ir.id
        for update
      loop
        select *
        into locked_product
        from public.products p
        where p.id = reservation_row.product_id
        for update;

        if not found then
          raise exception 'Reserved product not found';
        end if;

        if locked_product.inventory_quantity < reservation_row.quantity then
          raise exception 'Insufficient inventory for fulfilled order';
        end if;

        resulting_quantity := locked_product.inventory_quantity - reservation_row.quantity;

        update public.products
        set inventory_quantity = resulting_quantity,
            updated_at = now()
        where id = locked_product.id;

        insert into public.inventory_sales (
          reservation_id,
          order_id,
          product_id,
          quantity,
          quantity_before,
          quantity_after
        )
        values (
          reservation_row.id,
          locked_order.id,
          reservation_row.product_id,
          reservation_row.quantity,
          locked_product.inventory_quantity,
          resulting_quantity
        )
        on conflict (reservation_id) do nothing;

        update public.inventory_reservations
        set status = 'fulfilled'
        where id = reservation_row.id
          and status = 'reserved';

        if found then
          fulfilled_any := true;
        end if;
      end loop;

      update public.orders
      set status = 'paid',
          payment_status = 'success'
      where id = locked_order.id;

      insert into public.order_events (order_id, event_type, actor_type, metadata)
      values (
        locked_order.id,
        'payment.verified',
        'system',
        jsonb_build_object(
          'provider', 'paystack',
          'provider_reference', p_provider_reference,
          'provider_transaction_id', p_provider_transaction_id,
          'amount_kobo', p_amount_kobo,
          'inventory_fulfilled', fulfilled_any
        )
      );
    end if;
  elsif p_provider_status in ('failed', 'reversed', 'refunded') then
    -- A previously paid order is never silently downgraded by a customer callback.
    if locked_order.status = 'pending_payment' and locked_order.payment_status = 'pending' then
      update public.payment_transactions
      set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
          status = p_provider_status,
          verified_at = coalesce(verified_at, now()),
          verification_metadata = coalesce(verification_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
          webhook_event_key = coalesce(p_webhook_event_key, webhook_event_key)
      where id = locked_payment.id;

      update public.orders
      set payment_status = p_provider_status
      where id = locked_order.id;

      update public.inventory_reservations
      set status = 'released',
          released_at = coalesce(released_at, now())
      where order_id = locked_order.id
        and status = 'reserved';

      insert into public.order_events (order_id, event_type, actor_type, metadata)
      values (
        locked_order.id,
        'payment.' || p_provider_status,
        'system',
        jsonb_build_object(
          'provider', 'paystack',
          'provider_reference', p_provider_reference,
          'provider_transaction_id', p_provider_transaction_id
        )
      );
    end if;
  end if;

  return query
  select o.status, o.payment_status,
         exists (
           select 1 from public.inventory_sales s
           where s.order_id = o.id
         )
  from public.orders o
  where o.id = p_order_id;
end;
$function$;

revoke all on function public.reconcile_paystack_payment(
  uuid, text, text, bigint, text, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.reconcile_paystack_payment(
  uuid, text, text, bigint, text, text, jsonb, text
) to service_role;
