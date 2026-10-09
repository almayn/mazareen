-- Permanently delete all farmer and machinery registrations and restart numbering.
-- Run only when you are certain the current rows can be discarded.
begin;

create or replace function public.assign_registration_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr integer;
  serial bigint;
begin
  yr := extract(year from coalesce(new.created_at, now()))::integer;
  insert into public.registration_counters as counters(registration_year, last_serial)
  values (yr, 1)
  on conflict (registration_year) do update
    set last_serial = counters.last_serial + 1
  returning last_serial into serial;
  new.registration_number := right(yr::text, 2) || case when serial < 10 then '0' || serial::text else serial::text end;
  return new;
end;
$$;

truncate table public.farmer_registrations, public.machine_registrations restart identity;
delete from public.registration_counters;

commit;
