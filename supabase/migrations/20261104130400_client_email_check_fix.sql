-- Correctif bloquant découvert par le parcours client complet.
-- La contrainte d'origine du noyau écrivait '\\.' dans le littéral SQL : la
-- regex exigeait donc un ANTISLASH littéral avant l'extension, et rejetait
-- toutes les adresses valides (« awa@example.com » compris). Aucune fiche
-- client ne pouvait donc porter un e-mail, ce qui rendait toute notification
-- e-mail impossible. On réécrit la contrainte avec l'échappement correct.
-- Le noyau appliqué n'est pas modifié : correctif versionné, comme exigé.

alter table public.clients drop constraint if exists clients_email_check;
alter table public.clients add constraint clients_email_check
  check (
    email is null
    or email = ''
    or (email = lower(btrim(email)) and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  );
