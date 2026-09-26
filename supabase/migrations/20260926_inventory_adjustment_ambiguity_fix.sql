-- Fix Phase 7.4 inventory adjustment column ambiguity.
-- Qualify product_id references that conflict with the RETURNS TABLE output variable.

create or replace function public.admin_adjust_inventory(
  p_product_id uuid,
  p_quantity_delta integer,
  p_reason text,
  p_note text,
  p_reference text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_actor_role text
)
returns table (
  adjustment_id uuid,
  product_id uuid,
  quantity_before integer,
  quantity_after integer,
  quantity_delta integer,
  reserved_quantity bigint
)
language plpgsql
security definer
set search_path = public, auth
as $
declare
  locked_product public.products%rowtype;
  existing_adjustment public.inventory_adjustments%rowtype;
  expected_role text;
  active_reserved bigint;
  resulting_quantity integer;
begin
  if p_product_id is null then raise exception 'Product id is required'; end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then raise exception 'Inventory adjustment cannot be zero'; end if;
  if p_reason not in ('stock_received','stock_count_correction','damaged_or_lost','returned_stock','manual_correction') then
    raise exception 'Unsupported inventory adjustment reason';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'Invalid inventory adjustment idempotency key';
  end if;
  if p_note is not null and length(p_note) > 1000 then raise exception 'Inventory adjustment note is too long'; end if;
  if p_reference is not null and length(p_reference) > 200 then raise exception 'Inventory adjustment reference is too long'; end if;
  if p_actor_id is null then raise exception 'Admin actor is required'; end if;

  select ar.role into expected_role from public.admin_roles ar where ar.user_id = p_actor_id;
  if expected_role is null or expected_role <> p_actor_role then raise exception 'Admin authorization failed'; end if;
  if expected_role not in ('owner','admin','operations') then raise exception 'Admin role is not permitted'; end if;

  select ia.* into existing_adjustment
  from public.inventory_adjustments ia
  where ia.idempotency_key = trim(p_idempotency_key)
  for update;

  if found then
    if existing_adjustment.product_id <> p_product_id
       or existing_adjustment.quantity_delta <> p_quantity_delta
       or existing_adjustment.reason <> p_reason
       or existing_adjustment.actor_id <> p_actor_id then
      raise exception 'Idempotency key already belongs to another adjustment';
    end if;

    select coalesce(sum(r.quantity), 0) into active_reserved
    from public.inventory_reservations r
    where r.product_id = existing_adjustment.product_id
      and r.status = 'reserved'
      and r.expires_at > now();

    return query select existing_adjustment.id, existing_adjustment.product_id,
      existing_adjustment.quantity_before, existing_adjustment.quantity_after,
      existing_adjustment.quantity_delta, active_reserved;
    return;
  end if;

  select p.* into locked_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then raise exception 'Product not found'; end if;

  update public.inventory_reservations as ir
  set status = 'released',
      released_at = coalesce(ir.released_at, now())
  where ir.product_id = p_product_id
    and ir.status = 'reserved'
    and ir.expires_at <= now();

  select coalesce(sum(r.quantity), 0) into active_reserved
  from public.inventory_reservations r
  where r.product_id = p_product_id
    and r.status = 'reserved'
    and r.expires_at > now();

  resulting_quantity := locked_product.inventory_quantity + p_quantity_delta;
  if resulting_quantity < 0 then raise exception 'Inventory quantity cannot be negative'; end if;
  if resulting_quantity < active_reserved then raise exception 'Inventory cannot be reduced below active reservations'; end if;

  update public.products as p
  set inventory_quantity = resulting_quantity, updated_at = now()
  where p.id = p_product_id;

  insert into public.inventory_adjustments (
    product_id, actor_id, actor_role, quantity_delta, quantity_before,
    quantity_after, reason, note, reference, idempotency_key
  )
  values (
    p_product_id, p_actor_id, expected_role, p_quantity_delta,
    locked_product.inventory_quantity, resulting_quantity, p_reason,
    nullif(trim(p_note), ''), nullif(trim(p_reference), ''), trim(p_idempotency_key)
  )
  returning id into adjustment_id;

  product_id := p_product_id;
  quantity_before := locked_product.inventory_quantity;
  quantity_after := resulting_quantity;
  quantity_delta := p_quantity_delta;
  reserved_quantity := active_reserved;
  return next;
end;
$$;


revoke all on function public.admin_adjust_inventory(
  uuid, integer, text, text, text, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.admin_adjust_inventory(
  uuid, integer, text, text, text, text, uuid, text
) to service_role;
