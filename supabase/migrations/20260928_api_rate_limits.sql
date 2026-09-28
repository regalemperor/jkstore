-- Phase 8.3: durable application-level API rate limiting.
-- Fixed-window counters are intentionally kept in Supabase so limits survive
-- Vercel serverless instance changes.

create table if not exists public.api_rate_limit_buckets (
  scope text not null,
  key_hash text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 0,
  expires_at timestamptz not null,
  primary key (scope, key_hash, bucket_start),
  constraint api_rate_limit_buckets_scope_check
    check (scope <> ''),
  constraint api_rate_limit_buckets_key_hash_check
    check (key_hash <> ''),
  constraint api_rate_limit_buckets_request_count_check
    check (request_count >= 0)
);

create index if not exists api_rate_limit_buckets_expires_at_idx
  on public.api_rate_limit_buckets (expires_at);

alter table public.api_rate_limit_buckets enable row level security;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_max_requests integer,
  p_now timestamptz default now()
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_start timestamptz;
  v_expires_at timestamptz;
  v_count integer;
  v_retry integer;
begin
  if p_scope is null or btrim(p_scope) = ''
     or p_key_hash is null or btrim(p_key_hash) = ''
     or p_window_seconds < 1
     or p_max_requests < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_bucket_start :=
    to_timestamp(
      floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
    );

  v_expires_at := v_bucket_start + make_interval(secs => p_window_seconds);

  -- Remove only expired rows for this caller/scope. This keeps cleanup bounded
  -- without turning every request into a table-wide maintenance operation.
  delete from public.api_rate_limit_buckets
  where scope = p_scope
    and key_hash = p_key_hash
    and expires_at <= p_now;

  insert into public.api_rate_limit_buckets (
    scope,
    key_hash,
    bucket_start,
    request_count,
    expires_at
  )
  values (
    p_scope,
    p_key_hash,
    v_bucket_start,
    1,
    v_expires_at
  )
  on conflict (scope, key_hash, bucket_start)
  do update
    set request_count = public.api_rate_limit_buckets.request_count + 1
  returning request_count into v_count;

  v_retry := greatest(
    1,
    ceil(extract(epoch from (v_expires_at - p_now)))::integer
  );

  return query
  select
    v_count <= p_max_requests,
    greatest(0, p_max_requests - v_count),
    v_retry;
end;
$$;

revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer, timestamptz)
  to service_role;
