-- Phase 7.3: atomic, role-checked admin fulfillment transitions.
-- Payment success remains authoritative from Paystack reconciliation.

create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_target_status text,
  p_actor_id uuid,
  p_actor_role text
)
returns table (
  order_id uuid,
  previous_status text,
  new_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  locked_order public.orders%rowtype;
  allowed_transition boolean := false;
  expected_role text;
begin
  if p_target_status not in ('processing', 'shipped', 'delivered') then
    raise exception 'Unsupported fulfillment status';
  end if;

  select ar.role
    into expected_role
  from public.admin_roles ar
  where ar.user_id = p_actor_id;

  if expected_role is null or expected_role <> p_actor_role then
    raise exception 'Admin authorization failed';
  end if;

  if expected_role not in ('owner', 'admin', 'operations') then
    raise exception 'Admin role is not permitted';
  end if;

  select *
    into locked_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if locked_order.payment_status <> 'success' then
    raise exception 'Only successfully paid orders can enter fulfillment';
  end if;

  allowed_transition :=
    (locked_order.status = 'paid' and p_target_status = 'processing')
    or (locked_order.status = 'processing' and p_target_status = 'shipped')
    or (locked_order.status = 'shipped' and p_target_status = 'delivered');

  if not allowed_transition then
    raise exception 'Invalid order status transition';
  end if;

  update public.orders
  set status = p_target_status
  where id = locked_order.id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  )
  values (
    locked_order.id,
    'order.status_changed',
    'admin',
    p_actor_id,
    jsonb_build_object(
      'from_status', locked_order.status,
      'to_status', p_target_status,
      'admin_role', expected_role
    )
  );

  return query
  select locked_order.id, locked_order.status, p_target_status;
end;
$$;

revoke all on function public.admin_transition_order(uuid, text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_transition_order(uuid, text, uuid, text)
  to service_role;
