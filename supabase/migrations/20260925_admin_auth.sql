-- Phase 7 foundation: explicit admin identity and role boundary.
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'operations')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_roles_role_idx on public.admin_roles(role);

alter table public.admin_roles enable row level security;

drop policy if exists "Admins can read their own role" on public.admin_roles;
create policy "Admins can read their own role"
  on public.admin_roles
  for select
  to authenticated
  using (user_id = auth.uid());

-- No client-side insert/update/delete. Role assignment is an operator-controlled
-- provisioning action performed from the Supabase SQL editor.
revoke all on public.admin_roles from anon;
revoke all on public.admin_roles from authenticated;
grant select on public.admin_roles to authenticated;

drop trigger if exists admin_roles_set_updated_at on public.admin_roles;
create trigger admin_roles_set_updated_at
before update on public.admin_roles
for each row execute function public.set_updated_at();

comment on table public.admin_roles is
  'JKSTORE admin authorization boundary. Provision roles only through trusted operator tooling.';
