-- JKSTORE Phase 7.6 — customer operations derived from authoritative orders.
-- No canonical customers table is introduced yet because guest checkout does not
-- currently create customer accounts. The customer directory is therefore a
-- bounded operational projection of order contact data.

create or replace function public.admin_list_customers(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  customer_key text,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_count bigint,
  paid_order_count bigint,
  total_paid_kobo bigint,
  first_order_at timestamptz,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with normalized_orders as (
    select
      o.*,
      case
        when nullif(lower(trim(o.customer_email)), '') is not null
          then 'email:' || lower(trim(o.customer_email))
        when nullif(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9+]', '', 'g'), '') is not null
          then 'phone:' || regexp_replace(o.customer_phone, '[^0-9+]', '', 'g')
        else null
      end as identity_key
    from public.orders o
  ),
  grouped as (
    select
      md5(identity_key) as customer_key,
      (array_agg(customer_name order by created_at desc) filter (where customer_name is not null))[1] as customer_name,
      (array_agg(customer_email order by created_at desc) filter (where customer_email is not null))[1] as customer_email,
      (array_agg(customer_phone order by created_at desc) filter (where customer_phone is not null))[1] as customer_phone,
      count(*) as order_count,
      count(*) filter (where payment_status = 'success') as paid_order_count,
      coalesce(sum(total_kobo) filter (where payment_status = 'success'), 0) as total_paid_kobo,
      min(created_at) as first_order_at,
      max(created_at) as last_order_at
    from normalized_orders
    where identity_key is not null
    group by identity_key
  )
  select
    g.customer_key,
    g.customer_name,
    g.customer_email,
    g.customer_phone,
    g.order_count,
    g.paid_order_count,
    g.total_paid_kobo,
    g.first_order_at,
    g.last_order_at
  from grouped g
  where p_search is null
     or trim(p_search) = ''
     or coalesce(g.customer_name, '') ilike '%' || trim(p_search) || '%'
     or coalesce(g.customer_email, '') ilike '%' || trim(p_search) || '%'
     or coalesce(g.customer_phone, '') ilike '%' || trim(p_search) || '%'
  order by g.last_order_at desc
  limit least(greatest(coalesce(p_page_size, 25), 1), 100)
  offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 25), 1), 100);
$$;

create or replace function public.admin_count_customers(
  p_search text default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
  with identities as (
    select distinct
      case
        when nullif(lower(trim(customer_email)), '') is not null
          then 'email:' || lower(trim(customer_email))
        when nullif(regexp_replace(coalesce(customer_phone, ''), '[^0-9+]', '', 'g'), '') is not null
          then 'phone:' || regexp_replace(customer_phone, '[^0-9+]', '', 'g')
        else null
      end as identity_key,
      customer_name,
      customer_email,
      customer_phone
    from public.orders
  )
  select count(*)
  from (
    select identity_key
    from identities
    where identity_key is not null
      and (
        p_search is null
        or trim(p_search) = ''
        or coalesce(customer_name, '') ilike '%' || trim(p_search) || '%'
        or coalesce(customer_email, '') ilike '%' || trim(p_search) || '%'
        or coalesce(customer_phone, '') ilike '%' || trim(p_search) || '%'
      )
    group by identity_key
  ) grouped;
$$;

create or replace function public.admin_get_customer(
  p_customer_key text
)
returns table (
  customer_key text,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_count bigint,
  paid_order_count bigint,
  total_paid_kobo bigint,
  first_order_at timestamptz,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with normalized_orders as (
    select
      o.*,
      case
        when nullif(lower(trim(o.customer_email)), '') is not null
          then 'email:' || lower(trim(o.customer_email))
        when nullif(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9+]', '', 'g'), '') is not null
          then 'phone:' || regexp_replace(o.customer_phone, '[^0-9+]', '', 'g')
        else null
      end as identity_key
    from public.orders o
  )
  select
    md5(identity_key),
    (array_agg(customer_name order by created_at desc) filter (where customer_name is not null))[1],
    (array_agg(customer_email order by created_at desc) filter (where customer_email is not null))[1],
    (array_agg(customer_phone order by created_at desc) filter (where customer_phone is not null))[1],
    count(*),
    count(*) filter (where payment_status = 'success'),
    coalesce(sum(total_kobo) filter (where payment_status = 'success'), 0),
    min(created_at),
    max(created_at)
  from normalized_orders
  where identity_key is not null
    and md5(identity_key) = p_customer_key
  group by identity_key;
$$;

create or replace function public.admin_get_customer_orders(
  p_customer_key text,
  p_limit integer default 50
)
returns table (
  id uuid,
  status text,
  payment_status text,
  total_kobo bigint,
  customer_name text,
  customer_email text,
  customer_phone text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with normalized_orders as (
    select
      o.*,
      case
        when nullif(lower(trim(o.customer_email)), '') is not null
          then 'email:' || lower(trim(o.customer_email))
        when nullif(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9+]', '', 'g'), '') is not null
          then 'phone:' || regexp_replace(o.customer_phone, '[^0-9+]', '', 'g')
        else null
      end as identity_key
    from public.orders o
  )
  select
    o.id,
    o.status,
    o.payment_status,
    o.total_kobo,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.created_at
  from normalized_orders o
  where o.identity_key is not null
    and md5(o.identity_key) = p_customer_key
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.admin_list_customers(text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_count_customers(text) from public, anon, authenticated;
revoke all on function public.admin_get_customer(text) from public, anon, authenticated;
revoke all on function public.admin_get_customer_orders(text, integer) from public, anon, authenticated;

grant execute on function public.admin_list_customers(text, integer, integer) to service_role;
grant execute on function public.admin_count_customers(text) to service_role;
grant execute on function public.admin_get_customer(text) to service_role;
grant execute on function public.admin_get_customer_orders(text, integer) to service_role;
