-- Lot 6 — correctif : la refonte des permissions financières ne doit pas retirer
-- la permission de modération des avis ajoutée au Lot 5 (reviews.moderate).
-- Les migrations appliquées étant immuables, on remplace la fonction dans un
-- nouveau fichier versionné qui rétablit la carte complète.

create or replace function private.has_salon_permission(p_salon_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and case p_permission
        when 'dashboard.read' then true
        when 'services.read' then true
        when 'staff.read' then true
        when 'clients.read' then true
        when 'clients.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'appointments.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'appointments.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'catalog.write' then m.role in ('owner', 'manager')
        when 'team.write' then m.role in ('owner', 'manager')
        when 'expenses.read' then m.role in ('owner', 'manager', 'accountant')
        when 'expenses.manage' then m.role in ('owner', 'manager')
        when 'stock.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'stock.write' then m.role in ('owner', 'manager')
        when 'loyalty.read' then true
        when 'loyalty.write' then m.role in ('owner', 'manager')
        when 'reviews.read' then true
        when 'reviews.moderate' then m.role in ('owner', 'manager')
        when 'members.read' then m.role in ('owner', 'manager')
        when 'members.manage' then m.role = 'owner'
        when 'salon.read' then true
        when 'salon.update' then m.role = 'owner'
        when 'branch.create' then m.role in ('owner', 'manager')
        when 'branch.update' then m.role in ('owner', 'manager')
        when 'payments.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'payments.record' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.correct' then m.role in ('owner', 'manager')
        when 'cash.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'cash.open' then m.role in ('owner', 'manager', 'cashier')
        when 'cash.close' then m.role in ('owner', 'manager', 'cashier')
        when 'cash.reconcile' then m.role = 'owner'
        when 'reports.read' then m.role in ('owner', 'manager', 'accountant')
        when 'subscriptions.read' then m.role = 'owner'
        when 'payments.write' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.create' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.refund.read' then m.role in ('owner', 'manager')
        when 'payments.refund.write' then m.role in ('owner', 'manager')
        when 'cashier.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'cashier.write' then m.role in ('owner', 'manager', 'cashier')
        else false
      end
  )
$$;
revoke all on function private.has_salon_permission(uuid, text) from public, anon;
grant execute on function private.has_salon_permission(uuid, text) to authenticated;
