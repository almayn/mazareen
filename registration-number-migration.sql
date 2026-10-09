-- Add shared, year-aware registration numbering and secure public registration RPCs.
-- Run once in Supabase SQL Editor after schema.sql has already been applied.
alter table public.farmer_registrations add column if not exists registration_number text;
alter table public.machine_registrations add column if not exists registration_number text;

create table if not exists public.registration_counters (
  registration_year integer primary key,
  last_serial bigint not null check (last_serial >= 1)
);
revoke all on public.registration_counters from public, anon, authenticated;

with combined as (
  select 'farmer'::text as source, id, extract(year from created_at)::integer as registration_year, created_at from public.farmer_registrations
  union all
  select 'machine'::text, id, extract(year from created_at)::integer, created_at from public.machine_registrations
), ranked as (
  select source, id, registration_year,
         row_number() over (partition by registration_year order by created_at, source, id) as serial
  from combined
)
update public.farmer_registrations f
set registration_number = right(r.registration_year::text, 2) || r.serial::text || (r.serial + 9)::text
from ranked r
where r.source = 'farmer' and r.id = f.id and f.registration_number is null;

with combined as (
  select 'farmer'::text as source, id, extract(year from created_at)::integer as registration_year, created_at from public.farmer_registrations
  union all
  select 'machine'::text, id, extract(year from created_at)::integer, created_at from public.machine_registrations
), ranked as (
  select source, id, registration_year,
         row_number() over (partition by registration_year order by created_at, source, id) as serial
  from combined
)
update public.machine_registrations m
set registration_number = right(r.registration_year::text, 2) || r.serial::text || (r.serial + 9)::text
from ranked r
where r.source = 'machine' and r.id = m.id and m.registration_number is null;

with numbered as (
  select extract(year from created_at)::integer as registration_year,
         row_number() over (partition by extract(year from created_at)::integer order by created_at, source, id) as serial
  from (
    select 'farmer'::text as source, id, created_at from public.farmer_registrations
    union all
    select 'machine'::text, id, created_at from public.machine_registrations
  ) all_rows
), yearly_counts as (
  select registration_year, max(serial)::bigint as last_serial
  from numbered group by registration_year
)
insert into public.registration_counters as counters(registration_year, last_serial)
select registration_year, last_serial from yearly_counts
on conflict (registration_year) do update
set last_serial = greatest(counters.last_serial, excluded.last_serial);

create unique index if not exists farmer_registration_number_unique on public.farmer_registrations(registration_number);
create unique index if not exists machine_registration_number_unique on public.machine_registrations(registration_number);
alter table public.farmer_registrations alter column registration_number set not null;
alter table public.machine_registrations alter column registration_number set not null;

create or replace function public.assign_registration_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare yr integer; serial bigint;
begin
  yr := extract(year from coalesce(new.created_at, now()))::integer;
  insert into public.registration_counters as counters(registration_year, last_serial) values (yr, 1)
  on conflict (registration_year) do update
    set last_serial = counters.last_serial + 1
  returning last_serial into serial;
  new.registration_number := right(yr::text, 2) || serial::text || (serial + 9)::text;
  return new;
end;
$$;
revoke all on function public.assign_registration_number() from public, anon, authenticated;

drop trigger if exists assign_farmer_registration_number on public.farmer_registrations;
create trigger assign_farmer_registration_number before insert on public.farmer_registrations
for each row execute function public.assign_registration_number();
drop trigger if exists assign_machine_registration_number on public.machine_registrations;
create trigger assign_machine_registration_number before insert on public.machine_registrations
for each row execute function public.assign_registration_number();

create or replace function public.register_farmer(p_name text, p_phone text, p_farm_count integer, p_location text)
returns text language plpgsql security definer set search_path = ''
as $$
declare assigned_number text;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120
     or char_length(trim(coalesce(p_phone, ''))) not between 8 and 20
     or p_farm_count not between 1 and 999
     or char_length(trim(coalesce(p_location, ''))) not between 1 and 180 then
    raise exception 'بيانات التسجيل غير مكتملة أو غير صحيحة' using errcode = '22023';
  end if;
  insert into public.farmer_registrations(name, phone, farm_count, location)
  values (trim(p_name), trim(p_phone), p_farm_count, trim(p_location))
  returning registration_number into assigned_number;
  return assigned_number;
end;
$$;

create or replace function public.register_machine(p_name text, p_phone text, p_machine_type text)
returns text language plpgsql security definer set search_path = ''
as $$
declare assigned_number text;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120
     or char_length(trim(coalesce(p_phone, ''))) not between 8 and 20
     or trim(coalesce(p_machine_type, '')) not in ('حراثة', 'حصادة', 'درّاسة') then
    raise exception 'بيانات التسجيل غير مكتملة أو غير صحيحة' using errcode = '22023';
  end if;
  insert into public.machine_registrations(name, phone, machine_type)
  values (trim(p_name), trim(p_phone), trim(p_machine_type))
  returning registration_number into assigned_number;
  return assigned_number;
end;
$$;

drop policy if exists "public can submit farmers" on public.farmer_registrations;
drop policy if exists "public can submit machinery owners" on public.machine_registrations;
revoke insert on public.farmer_registrations from anon, authenticated;
revoke insert on public.machine_registrations from anon, authenticated;
revoke all on function public.register_farmer(text, text, integer, text) from public;
revoke all on function public.register_machine(text, text, text) from public;
grant execute on function public.register_farmer(text, text, integer, text) to anon, authenticated;
grant execute on function public.register_machine(text, text, text) to anon, authenticated;
