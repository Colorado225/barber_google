-- P1 : Synchronisation multi-postes via Supabase Realtime.
-- Active la diffusion Postgres Changes (sous contrôle RLS existant) uniquement
-- pour les tables opérationnelles partagées entre postes du même salon :
-- rendez-vous (planning + sans rendez-vous + demandes en ligne),
-- notifications clients, paiements et sessions de caisse.

alter table public.appointments replica identity full;
alter table public.appointment_notifications replica identity full;
alter table public.payments replica identity full;
alter table public.cash_sessions replica identity full;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'appointments',
      'appointment_notifications',
      'payments',
      'cash_sessions'
    ] loop
      if not exists (
        select 1
          from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
