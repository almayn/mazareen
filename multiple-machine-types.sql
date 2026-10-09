create or replace function public.register_machine(p_name text, p_phone text, p_machine_type text)
returns text language plpgsql security definer set search_path = ''
as $$
declare assigned_number text;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120
     or char_length(trim(coalesce(p_phone, ''))) not between 8 and 20
     or char_length(trim(coalesce(p_machine_type, ''))) not between 1 and 120
     or exists (
       select 1
       from pg_catalog.regexp_split_to_table(trim(coalesce(p_machine_type, '')), '[,،]') as item(value)
       where trim(item.value) not in ('حراثة', 'حصادة', 'درّاسة', 'بذّارة')
     ) then
    raise exception 'بيانات التسجيل غير مكتملة أو غير صحيحة' using errcode = '22023';
  end if;
  insert into public.machine_registrations(name, phone, machine_type)
  values (trim(p_name), trim(p_phone), trim(p_machine_type))
  returning registration_number into assigned_number;
  return assigned_number;
end;
$$;

revoke all on function public.register_machine(text, text, text) from public;
grant execute on function public.register_machine(text, text, text) to anon, authenticated;
