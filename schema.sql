-- Run this file in Supabase SQL Editor for the Mazareen project.
-- No public SELECT access is granted. Public visitors may submit registrations only.
create extension if not exists pgcrypto;

create table if not exists public.farmer_registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 120),
  phone text not null check (char_length(phone) between 8 and 20),
  farm_count integer not null check (farm_count between 1 and 999),
  location text not null check (char_length(trim(location)) between 1 and 180),
  created_at timestamptz not null default now()
);

create table if not exists public.machine_registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 120),
  phone text not null check (char_length(phone) between 8 and 20),
  machine_type text not null check (char_length(trim(machine_type)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.mazareen_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.farmer_registrations enable row level security;
alter table public.machine_registrations enable row level security;
alter table public.mazareen_admins enable row level security;

revoke all on public.farmer_registrations from anon, authenticated;
revoke all on public.machine_registrations from anon, authenticated;
revoke all on public.mazareen_admins from anon, authenticated;
grant insert on public.farmer_registrations to anon, authenticated;
grant insert on public.machine_registrations to anon, authenticated;
grant select, update, delete on public.farmer_registrations to authenticated;
grant select, update, delete on public.machine_registrations to authenticated;

drop policy if exists "public can submit farmers" on public.farmer_registrations;
create policy "public can submit farmers"
  on public.farmer_registrations for insert to anon, authenticated
  with check (true);

drop policy if exists "public can submit machinery owners" on public.machine_registrations;
create policy "public can submit machinery owners"
  on public.machine_registrations for insert to anon, authenticated
  with check (true);

-- This function checks an allowlist maintained by the project owner in SQL Editor.
create or replace function public.is_mazareen_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mazareen_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_mazareen_admin() from public;
grant execute on function public.is_mazareen_admin() to authenticated;

drop policy if exists "admins can read farmers" on public.farmer_registrations;
create policy "admins can read farmers"
  on public.farmer_registrations for select to authenticated
  using ((select public.is_mazareen_admin()));

drop policy if exists "admins can update farmers" on public.farmer_registrations;
create policy "admins can update farmers"
  on public.farmer_registrations for update to authenticated
  using ((select public.is_mazareen_admin()))
  with check ((select public.is_mazareen_admin()));

drop policy if exists "admins can delete farmers" on public.farmer_registrations;
create policy "admins can delete farmers"
  on public.farmer_registrations for delete to authenticated
  using ((select public.is_mazareen_admin()));

drop policy if exists "admins can read machine registrations" on public.machine_registrations;
create policy "admins can read machine registrations"
  on public.machine_registrations for select to authenticated
  using ((select public.is_mazareen_admin()));

drop policy if exists "admins can update machine registrations" on public.machine_registrations;
create policy "admins can update machine registrations"
  on public.machine_registrations for update to authenticated
  using ((select public.is_mazareen_admin()))
  with check ((select public.is_mazareen_admin()));

drop policy if exists "admins can delete machine registrations" on public.machine_registrations;
create policy "admins can delete machine registrations"
  on public.machine_registrations for delete to authenticated
  using ((select public.is_mazareen_admin()));

-- Create an Auth user, then allowlist that user's ID using SQL Editor:
-- insert into public.mazareen_admins(user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
