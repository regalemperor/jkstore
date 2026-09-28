-- JKSTORE Phase 7.7C: owner revenue and profitability timeline
-- Timeline data is private owner business intelligence.
-- Buckets are rendered in Africa/Lagos local time and include empty buckets.

create or replace function public.owner_profitability_timeline(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_period text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_role_db text;
  bucket_start timestamptz;
  bucket_end timestamptz;
  bucket_interval interval;
  result jsonb;
begin
  select ar.role
  into actor_role_db
  from public.admin_roles ar
  where ar.user_id = p_actor_id;

  if actor_role_db <> 'owner' then
    raise exception 'Owner authorization required';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'Invalid reporting period';
  end if;

  if p_period not in ('24h', '7d', '30d', '1y') then
    raise exception 'Invalid timeline period';
  end if;

  if p_period = '24h' then
    bucket_interval := interval '1 hour';
    bucket_start := date_trunc('hour', p_start_at at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    bucket_end := date_trunc('hour', p_end_at at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  elsif p_period = '7d' or p_period = '30d' then
    bucket_interval := interval '1 day';
    bucket_start := date_trunc('day', p_start_at at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    bucket_end := date_trunc('day', p_end_at at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  else
    bucket_interval := interval '1 month';
    bucket_start := date_trunc('month', p_start_at at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    bucket_end := date_trunc('month', p_end_at at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  end if;

  with buckets as (
    select generate_series(bucket_start, bucket_end, bucket_interval) as bucket_at
  ),
  successful_orders as (
    select
      o.id,
      o.created_at,
      o.total_kobo
    from public.orders o
    where o.payment_status = 'success'
      and o.status <> 'refunded'
      and o.created_at >= p_start_at
      and o.created_at < p_end_at
  ),
  order_economics as (
    select
      o.id,
      o.created_at,
      o.total_kobo as revenue_kobo,
      coalesce(sum(oi.line_total_kobo) filter (where oi.unit_cost_kobo is not null), 0)::bigint as costed_revenue_kobo,
      coalesce(sum(oi.unit_cost_kobo * oi.quantity), 0)::bigint as cogs_kobo,
      coalesce(sum(oi.quantity) filter (where oi.unit_cost_kobo is not null), 0)::bigint as costed_units,
      coalesce(sum(oi.quantity) filter (where oi.unit_cost_kobo is null), 0)::bigint as missing_cost_units
    from successful_orders o
    left join public.order_items oi on oi.order_id = o.id
    group by o.id, o.created_at, o.total_kobo
  ),
  order_fees as (
    select
      pt.order_id,
      coalesce(sum(pt.provider_fee_kobo), 0)::bigint as payment_fees_kobo
    from public.payment_transactions pt
    where pt.status = 'success'
    group by pt.order_id
  ),
  timeline as (
    select
      b.bucket_at,
      coalesce(sum(e.revenue_kobo), 0)::bigint as revenue_kobo,
      coalesce(sum(e.costed_revenue_kobo), 0)::bigint as costed_revenue_kobo,
      coalesce(sum(e.cogs_kobo), 0)::bigint as cogs_kobo,
      coalesce(sum(f.payment_fees_kobo), 0)::bigint as payment_fees_kobo,
      count(e.id)::integer as order_count,
      coalesce(sum(e.costed_units), 0)::bigint as units_sold,
      coalesce(sum(e.missing_cost_units), 0)::bigint as missing_cost_units
    from buckets b
    left join order_economics e
      on e.created_at >= b.bucket_at
      and e.created_at < b.bucket_at + bucket_interval
    left join order_fees f on f.order_id = e.id
    group by b.bucket_at
    order by b.bucket_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucketAt', t.bucket_at,
        'revenueKobo', t.revenue_kobo,
        'costedRevenueKobo', t.costed_revenue_kobo,
        'cogsKobo', t.cogs_kobo,
        'paymentFeesKobo', t.payment_fees_kobo,
        'grossProfitKobo', t.costed_revenue_kobo - t.cogs_kobo,
        'profitAfterPaymentFeesKobo', t.costed_revenue_kobo - t.cogs_kobo - t.payment_fees_kobo,
        'orderCount', t.order_count,
        'unitsSold', t.units_sold,
        'missingCostUnits', t.missing_cost_units
      )
    ),
    '[]'::jsonb
  )
  into result
  from timeline t;

  return result;
end;
$function$;

revoke all on function public.owner_profitability_timeline(timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.owner_profitability_timeline(timestamptz, timestamptz, text, uuid)
  to service_role;
