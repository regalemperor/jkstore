-- JKSTORE Phase 8 database access-control hardening
-- Defense in depth for Supabase Data API exposure.
--
-- RLS controls which rows are visible; PostgreSQL grants also control which
-- objects/columns are reachable. Private business fields must not be exposed
-- merely because a row is public.

-- 1) Public catalog: clients may read catalog fields, but never product cost.
revoke all on table public.products from anon, authenticated;

grant select (
  id,
  name,
  slug,
  description,
  price_kobo,
  category_id,
  tag,
  image_url,
  is_featured,
  is_active,
  inventory_quantity,
  created_at,
  updated_at
) on table public.products to anon, authenticated;

-- 2) Customer order reads: keep direct authenticated access limited to fields
-- the customer-facing data model needs. Sensitive checkout secrets and payment
-- references remain server-side.
revoke all on table public.orders from anon, authenticated;

grant select (
  id,
  user_id,
  status,
  payment_status,
  currency,
  subtotal_kobo,
  shipping_kobo,
  discount_kobo,
  total_kobo,
  customer_email,
  customer_name,
  customer_phone,
  shipping_address,
  guest_access_expires_at,
  created_at,
  updated_at
) on table public.orders to authenticated;

-- Order detail is served through the protected application API, which uses the
-- server-side service role. Do not expose payment ledger/event tables directly
-- to browser roles.
revoke all on table public.payment_transactions from anon, authenticated;
revoke all on table public.order_events from anon, authenticated;
revoke all on table public.inventory_reservations from anon, authenticated;

-- 3) Existing sensitive business/audit tables remain server-only.
revoke all on table public.product_admin_events from anon, authenticated;
revoke all on table public.inventory_adjustments from anon, authenticated;
revoke all on table public.api_rate_limit_buckets from anon, authenticated;

-- 4) Remove direct execution of database functions from browser roles unless
-- explicitly required by the application. Checkout is the intentional public
-- exception; all administrative, payment-reconciliation, inventory, customer
-- and profitability functions remain service-role-only.
revoke execute on function public.reconcile_paystack_payment(
  uuid, text, text, bigint, text, text, jsonb, text
) from public, anon, authenticated;

revoke execute on function public.admin_transition_order(
  uuid, text, uuid, text
) from public, anon, authenticated;

revoke execute on function public.admin_adjust_inventory(
  uuid, integer, text, text, text, text, uuid, text
) from public, anon, authenticated;

revoke execute on function public.admin_list_customers(
  text, integer, integer
) from public, anon, authenticated;

revoke execute on function public.admin_count_customers(
  text
) from public, anon, authenticated;

revoke execute on function public.admin_get_customer(
  text
) from public, anon, authenticated;

revoke execute on function public.admin_get_customer_orders(
  text, integer
) from public, anon, authenticated;

revoke execute on function public.admin_save_product(
  uuid, text, text, text, integer, text, text, text, boolean, boolean, uuid, text
) from public, anon, authenticated;

revoke execute on function public.owner_set_product_cost(
  uuid, integer, uuid
) from public, anon, authenticated;

revoke execute on function public.owner_profitability_report(
  timestamptz, timestamptz, uuid
) from public, anon, authenticated;

revoke execute on function public.owner_profitability_timeline(
  timestamptz, timestamptz, text, uuid
) from public, anon, authenticated;

revoke execute on function public.consume_api_rate_limit(
  text, text, integer, integer, timestamptz
) from public, anon, authenticated;

-- Re-assert the intended explicit grants.
grant execute on function public.admin_transition_order(
  uuid, text, uuid, text
) to service_role;

grant execute on function public.admin_adjust_inventory(
  uuid, integer, text, text, text, text, uuid, text
) to service_role;

grant execute on function public.admin_list_customers(
  text, integer, integer
) to service_role;

grant execute on function public.admin_count_customers(
  text
) to service_role;

grant execute on function public.admin_get_customer(
  text
) to service_role;

grant execute on function public.admin_get_customer_orders(
  text, integer
) to service_role;

grant execute on function public.admin_save_product(
  uuid, text, text, text, integer, text, text, text, boolean, boolean, uuid, text
) to service_role;

grant execute on function public.owner_set_product_cost(
  uuid, integer, uuid
) to service_role;

grant execute on function public.owner_profitability_report(
  timestamptz, timestamptz, uuid
) to service_role;

grant execute on function public.owner_profitability_timeline(
  timestamptz, timestamptz, text, uuid
) to service_role;

grant execute on function public.consume_api_rate_limit(
  text, text, integer, integer, timestamptz
) to service_role;

grant execute on function public.reconcile_paystack_payment(
  uuid, text, text, bigint, text, text, jsonb, text
) to service_role;

-- create_pending_order remains intentionally callable by the checkout's
-- publishable-key roles. The RPC performs its own input, pricing, inventory,
-- idempotency and guest-token checks.
grant execute on function public.create_pending_order(
  jsonb, text, text, text, jsonb, text, text, timestamptz
) to anon, authenticated;

-- 5) Prevent newly-created public-schema objects from inheriting broad Data API
-- access. Existing objects above are explicitly controlled; future objects must
-- receive deliberate grants.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;
