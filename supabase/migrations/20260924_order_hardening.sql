-- Phase 6 hardening: remove the legacy checkout RPC and prevent
-- unauthenticated callers from reaching the pre-guest-access overload.

revoke all on function public.create_pending_order(
  jsonb, text, text, text, jsonb, text
) from public, anon, authenticated;

drop function if exists public.create_pending_order(
  jsonb, text, text, text, jsonb, text
);

revoke all on function public.create_pending_order(
  jsonb, text, text, text, jsonb, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.create_pending_order(
  jsonb, text, text, text, jsonb, text, text, timestamptz
) to anon, authenticated;

revoke all on function public.reconcile_paystack_payment(
  uuid, text, text, bigint, text, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.reconcile_paystack_payment(
  uuid, text, text, bigint, text, text, jsonb, text
) to service_role;
