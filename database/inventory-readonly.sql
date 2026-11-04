\set ON_ERROR_STOP on

-- Phase 0 inventory only. Run against the legacy database with a read-only role.
-- This reports relation names, row counts, storage sizes and FK metadata;
-- it never returns customer, staff, credential, payment, or appointment values.
begin transaction read only;

-- Refuse elevated credentials even though the transaction itself is read-only.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = current_user
      and (rolsuper or rolbypassrls)
  ) then
    raise exception 'Inventory requires a non-superuser role without BYPASSRLS';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_tables as tables
    where tables.schemaname = 'public'
      and tables.tablename like 'bc\_%' escape '\'
      and (
        has_table_privilege(current_user, format('%I.%I', tables.schemaname, tables.tablename), 'INSERT')
        or has_table_privilege(current_user, format('%I.%I', tables.schemaname, tables.tablename), 'UPDATE')
        or has_table_privilege(current_user, format('%I.%I', tables.schemaname, tables.tablename), 'DELETE')
      )
  ) then
    raise exception 'Inventory requires a role without write privileges on legacy tables';
  end if;
end
$$;

\echo 'Expected legacy relations and presence'
with expected(name) as (
  values
    ('bc_users'),
    ('bc_auth_accounts'),
    ('bc_auth_sessions'),
    ('bc_auth_tokens'),
    ('bc_organizations'),
    ('bc_salons'),
    ('bc_branches'),
    ('bc_memberships'),
    ('bc_branch_memberships'),
    ('bc_member_invitations'),
    ('bc_onboarding_state'),
    ('bc_admin_audit'),
    ('bc_clients'),
    ('bc_services'),
    ('bc_staff'),
    ('bc_staff_schedules'),
    ('bc_staff_absences'),
    ('bc_branch_hours'),
    ('bc_appointments'),
    ('bc_appointment_events'),
    ('bc_payment_entries'),
    ('bc_cash_registers'),
    ('bc_cash_sessions'),
    ('bc_expenses'),
    ('bc_stock_items'),
    ('bc_loyalty_rewards'),
    ('bc_reviews')
)
select expected.name, (tables.tablename is not null) as present
from expected
left join pg_catalog.pg_tables as tables
  on tables.schemaname = 'public'
  and tables.tablename = expected.name
order by expected.name;

\echo 'Exact row counts for existing expected relations'
select format(
  'select %L as relation, count(*)::bigint as row_count from %I.%I;',
  'public.' || expected.name,
  tables.schemaname,
  tables.tablename
)
from (
  values
    ('bc_users'),
    ('bc_auth_accounts'),
    ('bc_auth_sessions'),
    ('bc_auth_tokens'),
    ('bc_organizations'),
    ('bc_salons'),
    ('bc_branches'),
    ('bc_memberships'),
    ('bc_branch_memberships'),
    ('bc_member_invitations'),
    ('bc_onboarding_state'),
    ('bc_admin_audit'),
    ('bc_clients'),
    ('bc_services'),
    ('bc_staff'),
    ('bc_staff_schedules'),
    ('bc_staff_absences'),
    ('bc_branch_hours'),
    ('bc_appointments'),
    ('bc_appointment_events'),
    ('bc_payment_entries'),
    ('bc_cash_registers'),
    ('bc_cash_sessions'),
    ('bc_expenses'),
    ('bc_stock_items'),
    ('bc_loyalty_rewards'),
    ('bc_reviews')
) as expected(name)
join pg_catalog.pg_tables as tables
  on tables.schemaname = 'public'
  and tables.tablename = expected.name
order by expected.name
\gexec

\echo 'Storage sizes for existing expected relations'
select
  tables.tablename as relation,
  pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(
    pg_catalog.format('%I.%I', tables.schemaname, tables.tablename)::regclass
  )) as total_size
from pg_catalog.pg_tables as tables
where tables.schemaname = 'public'
  and tables.tablename like 'bc\_%' escape '\'
order by tables.tablename;

\echo 'Columns and SQL types for legacy relations'
select
  columns.table_name as relation,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from information_schema.columns as columns
where columns.table_schema = 'public'
  and columns.table_name like 'bc\_%' escape '\'
order by columns.table_name, columns.ordinal_position;

\echo 'Foreign key relationships and validation status'
select
  constraint_row.conrelid::regclass as relation,
  constraint_row.conname as constraint_name,
  constraint_row.confrelid::regclass as referenced_relation,
  constraint_row.convalidated as validated
from pg_catalog.pg_constraint as constraint_row
where constraint_row.contype = 'f'
  and constraint_row.connamespace = 'public'::regnamespace
order by relation::text, constraint_name;

commit;
