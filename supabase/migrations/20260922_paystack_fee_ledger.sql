-- Paystack fee-aware payment ledger.
-- Keeps the order amount separate from the customer charge so Paystack's
-- dashboard fee-pass-through mode can be enabled without weakening verification.

alter table payment_transactions
  add column if not exists order_amount_kobo bigint,
  add column if not exists expected_customer_charge_kobo bigint,
  add column if not exists fee_mode text,
  add column if not exists provider_fee_kobo bigint;

update payment_transactions pt
set order_amount_kobo = o.total_kobo,
    expected_customer_charge_kobo = pt.amount_kobo,
    fee_mode = 'absorb'
from orders o
where o.id = pt.order_id
  and (pt.order_amount_kobo is null
    or pt.expected_customer_charge_kobo is null
    or pt.fee_mode is null);

alter table payment_transactions
  alter column order_amount_kobo set not null,
  alter column expected_customer_charge_kobo set not null,
  alter column fee_mode set default 'absorb',
  alter column fee_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_transactions_fee_mode_check'
  ) then
    alter table payment_transactions
      add constraint payment_transactions_fee_mode_check
      check (fee_mode in ('absorb', 'pass_to_customer'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_transactions_order_amount_check'
  ) then
    alter table payment_transactions
      add constraint payment_transactions_order_amount_check
      check (order_amount_kobo >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_transactions_expected_charge_check'
  ) then
    alter table payment_transactions
      add constraint payment_transactions_expected_charge_check
      check (expected_customer_charge_kobo >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_transactions_provider_fee_check'
  ) then
    alter table payment_transactions
      add constraint payment_transactions_provider_fee_check
      check (provider_fee_kobo is null or provider_fee_kobo >= 0);
  end if;
end
$$;

create or replace function reconcile_paystack_payment(
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
as $$
declare
  locked_order orders%rowtype;
  locked_payment payment_transactions%rowtype;
  provider_fee bigint;
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
       from payment_transactions
       where webhook_event_key = p_webhook_event_key
     ) then
    select o.status, o.payment_status,
           exists (
             select 1 from inventory_reservations r
             where r.order_id = o.id and r.status = 'fulfilled'
           )
    into order_status, payment_status, fulfilled
    from payment_transactions pt
    join orders o on o.id = pt.order_id
    where pt.webhook_event_key = p_webhook_event_key;

    return next;
    return;
  end if;

  select * into locked_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if locked_order.payment_reference is distinct from p_provider_reference then
    raise exception 'Payment reference does not match order';
  end if;

  select * into locked_payment
  from payment_transactions
  where order_id = p_order_id
    and provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'Payment transaction record not found';
  end if;

  if locked_payment.order_amount_kobo <> locked_order.total_kobo then
    raise exception 'Payment ledger order amount does not match order total';
  end if;

  if locked_payment.expected_customer_charge_kobo <> p_amount_kobo then
    raise exception 'Payment amount does not match expected customer charge';
  end if;

  if locked_payment.currency <> p_currency then
    raise exception 'Payment currency does not match order';
  end if;

  if p_provider_transaction_id is not null
     and exists (
       select 1
       from payment_transactions pt
       where pt.provider_transaction_id = p_provider_transaction_id
         and pt.id <> locked_payment.id
     ) then
    raise exception 'Provider transaction already belongs to another payment';
  end if;

  provider_fee := case
    when jsonb_typeof(p_metadata->'fees') = 'number'
      then (p_metadata->>'fees')::bigint
    else null
  end;

  if p_provider_status = 'success' then
    update payment_transactions
    set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
        amount_kobo = p_amount_kobo,
        provider_fee_kobo = provider_fee,
        status = 'success',
        verified_at = coalesce(verified_at, now()),
        verification_metadata = coalesce(verification_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
        webhook_event_key = coalesce(p_webhook_event_key, webhook_event_key)
    where id = locked_payment.id;

    if locked_order.status = 'pending_payment' and locked_order.payment_status = 'pending' then
      update orders
      set status = 'paid',
          payment_status = 'success'
      where id = locked_order.id;

      update inventory_reservations
      set status = 'fulfilled'
      where order_id = locked_order.id
        and status = 'reserved';

      insert into order_events (order_id, event_type, actor_type, metadata)
      values (
        locked_order.id,
        'payment.verified',
        'system',
        jsonb_build_object(
          'provider', 'paystack',
          'provider_reference', p_provider_reference,
          'provider_transaction_id', p_provider_transaction_id,
          'order_amount_kobo', locked_payment.order_amount_kobo,
          'customer_charge_kobo', p_amount_kobo,
          'provider_fee_kobo', provider_fee,
          'fee_mode', locked_payment.fee_mode
        )
      );
    end if;
  elsif p_provider_status in ('failed', 'reversed', 'refunded') then
    if locked_order.status = 'pending_payment' and locked_order.payment_status = 'pending' then
      update payment_transactions
      set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
          amount_kobo = p_amount_kobo,
          provider_fee_kobo = provider_fee,
          status = p_provider_status,
          verified_at = coalesce(verified_at, now()),
          verification_metadata = coalesce(verification_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
          webhook_event_key = coalesce(p_webhook_event_key, webhook_event_key)
      where id = locked_payment.id;

      update orders
      set payment_status = p_provider_status
      where id = locked_order.id;

      update inventory_reservations
      set status = 'released',
          released_at = coalesce(released_at, now())
      where order_id = locked_order.id
        and status = 'reserved';

      insert into order_events (order_id, event_type, actor_type, metadata)
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
           select 1 from inventory_reservations r
           where r.order_id = o.id and r.status = 'fulfilled'
         )
  from orders o
  where o.id = p_order_id;
end;
$$;

revoke all on function reconcile_paystack_payment(uuid, text, text, bigint, text, text, jsonb, text) from public;
grant execute on function reconcile_paystack_payment(uuid, text, text, bigint, text, text, jsonb, text) to service_role;
